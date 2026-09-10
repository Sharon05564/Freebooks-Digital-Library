const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user');
const dotenv = require('dotenv');

dotenv.config();

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findByPk(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});


// passport-google-oauth20's Strategy constructor throws synchronously if
// clientID/clientSecret are missing, which would crash the whole server at
// startup. Google Sign-In is an optional feature, so only register these
// strategies when it's actually configured - routes/authRoutes.js checks
// passport.googleEnabled before using them.
passport.googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

if (passport.googleEnabled) {
    passport.use('google-signin', new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/callback"
    }, async (token, tokenSecret, profile, done) => {
        try {

            let existingUser = await User.findOne({ where: { googleId: profile.id } });

            if (existingUser) {
                // User already exists
                return done(null, existingUser);
            }

            // If not found, return false (do not create a new account)
            return done(null, false, { message: 'No account associated with this Google account. Please sign up.' });
        } catch (error) {
            return done(error, null);
        }
    }));

    // Google Sign-Up Strategy
    passport.use('google-signup', new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/signup/callback"
    }, async (token, tokenSecret, profile, done) => {
        try {
            // Check if username already exists
            let existingUsername = await User.findOne({ where: { username: profile.displayName } });

            // If the username already exists, append a unique identifier
            let newUsername = profile.displayName;
            if (existingUsername) {
                newUsername = `${profile.displayName}_${profile.id.substring(0, 5)}`;
            }

            // Create a new user if not already in the database
            const newUser = await User.create({
                googleId: profile.id,
                username: newUsername,
                email: profile.emails[0].value,
                password: null
            });

            return done(null, newUser);
        } catch (error) {
            return done(error, null);
        }
    }));
} else {
    console.warn('GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set - Google Sign-In routes are disabled.');
}

module.exports = passport;
