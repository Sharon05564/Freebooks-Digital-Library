const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/user");
const resolveGoogleAccount = require("../services/googleAccount");
require("dotenv").config();

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    done(null, await User.findByPk(id));
  } catch (error) {
    done(error);
  }
});

const callbackBase = (process.env.APP_ORIGIN || "").replace(/\/$/, "");
passport.googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

if (passport.googleEnabled) {
  for (const mode of ["signin", "signup"]) {
    passport.use(
      `google-${mode}`,
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${callbackBase}/auth/google/${mode === "signup" ? "signup/" : ""}callback`,
          sessionKey: `oauth2:google-${mode}`,
          state: true,
          pkce: true,
          proxy: true,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const result = await resolveGoogleAccount(profile, mode);
            done(
              null,
              result.user || false,
              result.error ? { code: result.error } : {},
            );
          } catch (error) {
            done(error);
          }
        },
      ),
    );
  }
} else {
  console.warn(
    "Google Sign-In is disabled until its client credentials are configured.",
  );
}
module.exports = passport;
