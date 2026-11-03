const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const bodyParser = require('body-parser');
const passport = require('./config/passport.js'); // Import Passport
const session = require('express-session'); // Required for persistent login sessions
const sequelize = require('./config/database'); // Sequelize configuration
const sendEmail = require('./services/email'); // Email utility
const authRoutes = require('./routes/authRoutes'); // Authentication routes
const bookRoutes = require('./routes/bookRoutes'); // Book search routes
const savedRoutes = require('./routes/savedRoutes'); // Saved books routes
const profileRoutes = require('./routes/profileRoutes'); // Profile routes

// Load environment variables
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.JWT_SECRET) {
    console.error('JWT_SECRET must be set in production.');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Render terminates TLS at its proxy; trusting it keeps secure cookies and
// OAuth callback URLs on https.
app.set('trust proxy', 1);

app.get('/healthz', (req, res) => res.status(200).send('ok'));

// Middleware
const allowedOrigin = process.env.APP_ORIGIN || `http://localhost:${process.env.PORT || 3000}`;
app.use(cors({ origin: allowedOrigin, credentials: true })); // Restrict CORS to this app's own origin
app.use(bodyParser.json()); // For parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(express.static('public')); // Serve static files

// **Initialize Passport**
require('./config/passport'); // Correctly require the Passport setup file
app.use(session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: isProduction }
}));
app.use(passport.initialize()); // Initialize Passport
app.use(passport.session()); // Enable persistent login sessions

// Connect to Postgres using Sequelize. `alter` rewrites tables to match the
// models, which is only safe in development.
sequelize.authenticate()
    .then(() => {
        console.log('Database connected successfully');
        return sequelize.sync(isProduction ? {} : { alter: true });
    })
    .then(() => {
        console.log('Database synced successfully');
    })
    .catch(err => console.error('Error connecting to the database:', err));

// Routes
app.use('/auth', authRoutes); // Authentication routes
app.use('/books', bookRoutes); // Book search routes
app.use('/api', savedRoutes); // Saved books routes
app.use('/', profileRoutes); // Profile routes (GET/PUT /profile)

// Endpoint to send messages
app.post('/api/sendMessage', async (req, res) => {
    const formData = req.body;

    // Validate the data
    if (!formData.name || !formData.email || !formData.message) {
        return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
    }

    try {
        const emailSent = await sendEmail(formData);

        if (emailSent) {
            return res.status(200).json({ success: true, message: 'Message sent successfully!' });
        } else {
            throw new Error('Failed to send email');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        return res.status(500).json({ success: false, message: 'There was an error sending your message.' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
