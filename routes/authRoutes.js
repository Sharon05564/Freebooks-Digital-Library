const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // For password hashing
const jwt = require('jsonwebtoken'); // For generating JWT tokens
const passport = require('../config/passport.js'); // For Google OAuth
const User = require('../models/user'); // Adjust the path to your user model

// Helper function to validate user input
const validateInput = (email, password) => {
    if (!email || !password) {
        return { valid: false, message: 'Email and password are required.' };
    }
    return { valid: true };
};

// Function to clear any existing sessions
function clearExistingSession(res) {
    console.log('Clearing existing session cookies...');
    res.clearCookie('jwt'); // Clear the cookie (if used)
    res.setHeader('Set-Cookie', 'jwt=; HttpOnly; Path=/; Max-Age=0'); // Invalidate cookie
    res.setHeader('Authorization', ''); // Clear any authorization headers if present
}

// User Registration
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body; // Ensure email is included

        // Validate input
        const { valid, message } = validateInput(email, password);
        if (!valid) {
            return res.status(400).json({ success: false, message });
        }

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

// Google OAuth Sign-In Route
router.get('/google',
    passport.authenticate('google-signin', { scope: ['profile', 'email'] })
);

// Google OAuth Sign-In Callback Route
router.get('/google/callback',
    passport.authenticate('google-signin', { failureRedirect: '/login' }),
    async (req, res) => {
        try {
            // Clear any existing sessions before proceeding
            clearExistingSession(res);

            // Log the user object obtained from Google authentication
            console.log('User authenticated via Google:', req.user);

            // Generate JWT token after successful Google login
            const token = jwt.sign({
                userId: req.user.id,
                username: req.user.username,
                email: req.user.email
            }, process.env.JWT_SECRET, { expiresIn: '1h' });

            // Log the generated token
            console.log('Generated JWT Token:', token);

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
    passport.authenticate('google-signup', { scope: ['profile', 'email'] })
);

// Google OAuth Sign-Up Callback Route
router.get('/google/signup/callback',
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
    if (token) {
        // Send a script that stores the token in localStorage and redirects to the homepage
        res.send(`
            <script>
                console.log('Token received:', '${token}');
                localStorage.setItem('token', '${token}');
                const payload = JSON.parse(atob('${token}'.split('.')[1]));
                const user = {
                    username: payload.username,
                    id: payload.userId,
                    email: payload.email,
                };
                console.log('User decoded from token:', user);
                localStorage.setItem('user', JSON.stringify(user));
                window.location.href = '/';
            </script>
        `);
    } else {
        res.status(400).send('Invalid request: No token found.');
    }
});

module.exports = router;
