const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const passport = require('../config/passport.js');
const User = require('../models/user');

// Helper function to validate user input
const validateInput = (email, password) => {
    if (!email || !password) {
        return { valid: false, message: 'Email and password are required.' };
    }
    return { valid: true };
};

const registerValidators = [
    body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters.'),
    body('email').trim().isEmail().withMessage('A valid email is required.').normalizeEmail(),
    body('password').isLength({ min: 6, max: 100 }).withMessage('Password must be at least 6 characters.'),
];

// Function to clear any existing sessions
function clearExistingSession(res) {
    console.log('Clearing existing session cookies...');
    res.clearCookie('jwt'); // Clear the cookie (if used)
    res.setHeader('Set-Cookie', 'jwt=; HttpOnly; Path=/; Max-Age=0');
    res.setHeader('Authorization', '');
}

// User Registration
router.post('/register', registerValidators, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: errors.array()[0].msg });
        }

        const { username, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User with this email already exists.' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10);

        // Create a new user with email included
        const newUser = await User.create({ username, email, password: hashedPassword });

        return res.status(201).json({ success: true, message: 'User registered successfully', userId: newUser.id });
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ success: false, message: 'Error registering user', error: error.message });
    }
});

// User Login
router.post('/login', async (req, res) => {
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
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid credentials.' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid credentials.' });
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        return res.status(200).json({ success: true, message: 'Login successful.', token, user: { id: user.id, username: user.username } });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ success: false, message: 'Error logging in', error: error.message });
    }
});

// Passport throws "Unknown authentication strategy" if these routes are hit
// while Google Sign-In isn't configured (see config/passport.js) - guard
// them so that returns a clear message instead of a generic 500.
const requireGoogleAuth = (req, res, next) => {
    if (!passport.googleEnabled) {
        return res.status(503).json({ success: false, message: 'Google Sign-In is not configured on this server.' });
    }
    next();
};

// Google OAuth Sign-In Route
router.get('/google',
    requireGoogleAuth,
    passport.authenticate('google-signin', { scope: ['profile', 'email'] })
);

// Google OAuth Sign-In Callback Route
router.get('/google/callback',
    requireGoogleAuth,
    passport.authenticate('google-signin', { failureRedirect: '/login' }),
    async (req, res) => {
        try {
            // Clear any existing sessions before proceeding
            clearExistingSession(res);

            // Generate JWT token after successful Google login
            const token = jwt.sign({
                userId: req.user.id,
                username: req.user.username,
                email: req.user.email
            }, process.env.JWT_SECRET, { expiresIn: '1h' });

            // Redirect to success route with token as query parameter
            res.redirect(`/auth/success?token=${token}`);
        } catch (error) {
            console.error('Google OAuth error:', error);
            res.status(500).send('Error during Google authentication.');
        }
    }
);

// Google OAuth Sign-Up Route
router.get('/google/signup',
    requireGoogleAuth,
    passport.authenticate('google-signup', { scope: ['profile', 'email'] })
);

// Google OAuth Sign-Up Callback Route
router.get('/google/signup/callback',
    requireGoogleAuth,
    passport.authenticate('google-signup', { failureRedirect: '/register' }),
    async (req, res) => {
        try {
            // Generate JWT token after successful Google signup
            const token = jwt.sign({
                userId: req.user.id,
                username: req.user.username,
                email: req.user.email
            }, process.env.JWT_SECRET, { expiresIn: '1h' });

            // Redirect to success route with token as query parameter
            res.redirect(`/auth/success?token=${token}`);
        } catch (error) {
            console.error('Google OAuth Sign-Up error:', error);
            res.status(500).send('Error during Google sign-up.');
        }
    }
);

// Add this in authRoutes.js
router.get('/success', (req, res) => {
    const token = req.query.token;
    if (!token) {
        return res.status(400).send('Invalid request: No token found.');
    }

    // Verify the token was actually issued by us before ever reflecting it back
    // into the page - an unverified token here is a reflected-XSS vector since
    // anyone can hit this route with an arbitrary ?token= value.
    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(400).send('Invalid or expired token.');
    }

    const user = {
        username: payload.username,
        id: payload.userId,
        email: payload.email,
    };

    // JSON.stringify escapes quotes; also escape "<" so a value like
    // "</script>" in the payload can't break out of the inline script tag.
    const safeToken = JSON.stringify(token).replace(/</g, '\\u003c');
    const safeUser = JSON.stringify(user).replace(/</g, '\\u003c');

    res.send(`
        <script>
            localStorage.setItem('token', ${safeToken});
            localStorage.setItem('user', ${safeUser});
            window.location.href = '/';
        </script>
    `);
});

module.exports = router;
