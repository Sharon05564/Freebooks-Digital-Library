const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const passport = require("../config/passport.js");
const User = require("../models/user");
const path = require("node:path");
const safeReturnPath = require("../services/authRedirect");

// Helper function to validate user input
const validateInput = (email, password) => {
  if (!email || !password) {
    return { valid: false, message: "Email and password are required." };
  }
  return { valid: true };
};

const registerValidators = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("Username must be 3-50 characters."),
  body("email")
    .trim()
    .isEmail()
    .withMessage("A valid email is required.")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 6, max: 100 })
    .withMessage("Password must be at least 6 characters."),
];

// Function to clear any existing sessions
function clearExistingSession(res) {
  console.log("Clearing existing session cookies...");
  res.clearCookie("jwt"); // Clear the cookie (if used)
  res.setHeader("Set-Cookie", "jwt=; HttpOnly; Path=/; Max-Age=0");
  res.setHeader("Authorization", "");
}

// User Registration
router.post("/register", registerValidators, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ success: false, message: errors.array()[0].msg });
    }

    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res
        .status(400)
        .json({
          success: false,
          message: "User with this email already exists.",
        });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(
      password,
      parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10,
    );

    // Create a new user with email included
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    return res
      .status(201)
      .json({
        success: true,
        message: "User registered successfully",
        userId: newUser.id,
      });
  } catch (error) {
    console.error("Registration error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Error registering user",
        error: error.message,
      });
  }
});

// User Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Clear existing session
    clearExistingSession(res);

    // Validate input
    const { valid, message } = validateInput(email, password);
    if (!valid) {
      return res.status(400).json({ success: false, message });
    }

    // Find the user by email
    const user = await User.findOne({ where: { email } });
    if (!user || !user.password) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Invalid credentials. Use Google if that is how you created your account.",
        });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid credentials." });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    return res
      .status(200)
      .json({
        success: true,
        message: "Login successful.",
        token,
        user: { id: user.id, username: user.username },
      });
  } catch (error) {
    console.error("Login error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Error logging in",
        error: error.message,
      });
  }
});

// OAuth callbacks only carry an authorization code. The application token is
// delivered once through a same-origin, no-store session exchange.
function authError(res, mode, code) {
  const allowed = new Set([
    "unavailable",
    "cancelled",
    "failed",
    "account_missing",
    "email_exists",
    "unverified_email",
    "expired",
  ]);
  const page = mode === "signup" ? "/register.html" : "/login.html";
  return res.redirect(
    page + "?google_error=" + (allowed.has(code) ? code : "failed"),
  );
}

for (const mode of ["signin", "signup"]) {
  const start = mode === "signup" ? "/google/signup" : "/google";
  router.get(start, (req, res, next) => {
    if (!passport.googleEnabled) return authError(res, mode, "unavailable");
    passport.authenticate(`google-${mode}`, {
      scope: ["profile", "email"],
      prompt: "select_account",
      session: false,
      state: { next: safeReturnPath(req.query.next) },
    })(req, res, next);
  });
  router.get(start + "/callback", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
    if (!passport.googleEnabled) return authError(res, mode, "unavailable");
    if (req.query.error)
      return authError(
        res,
        mode,
        req.query.error === "access_denied" ? "cancelled" : "failed",
      );
    if (!req.query.code || !req.query.state)
      return authError(res, mode, "failed");
    passport.authenticate(
      `google-${mode}`,
      { session: false },
      (error, user, info) => {
        if (error) {
          console.error("Google authentication failed:", error.name);
          return authError(res, mode, "failed");
        }
        if (!user) return authError(res, mode, info?.code || "failed");
        const nextPath = safeReturnPath(info?.state?.next);
        req.session.regenerate((error) => {
          if (error) return next(error);
          req.session.googleResult = {
            userId: user.id,
            next: nextPath,
            expiresAt: Date.now() + 120000,
          };
          req.session.save((error) => {
            if (error) return next(error);
            res.redirect("/auth/google/complete");
          });
        });
      },
    )(req, res, next);
  });
}

router.get("/google/complete", (req, res) => {
  res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  res.sendFile(path.join(__dirname, "../public/google-complete.html"));
});

const exchangedGoogleSessions = new Set();
router.post("/google/session", async (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (req.get("X-Requested-With") !== "FreeBooks")
    return res.status(403).json({ message: "Invalid sign-in request." });
  const result = req.session.googleResult;
  if (
    !result ||
    result.expiresAt < Date.now() ||
    exchangedGoogleSessions.has(req.sessionID)
  )
    return res
      .status(401)
      .json({ message: "Google sign-in expired. Please try again." });
  // Consume before any asynchronous work; a result can only be exchanged once.
  exchangedGoogleSessions.add(req.sessionID);
  const sessionId = req.sessionID;
  setTimeout(() => exchangedGoogleSessions.delete(sessionId), 120000).unref();
  delete req.session.googleResult;
  req.session.save(async (error) => {
    if (error) return next(error);
    try {
      const user = await User.findByPk(result.userId);
      if (!user)
        return res
          .status(401)
          .json({ message: "Account not found. Please try again." });
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
      res.json({
        token,
        user: { id: user.id, username: user.username, email: user.email },
        next: safeReturnPath(result.next),
      });
    } catch (error) {
      next(error);
    }
  });
});

// Old callback URLs containing bearer tokens are no longer accepted.
router.get("/success", (_req, res) => authError(res, "signin", "expired"));
module.exports = router;
