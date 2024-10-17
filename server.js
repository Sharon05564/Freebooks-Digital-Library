const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const bodyParser = require('body-parser');
const passport = require('./config/passport.js'); // Import Passport
const session = require('express-session'); // Required for persistent login sessions
const sequelize = require('./config/database'); // Sequelize configuration
const sendEmail = require('./public/js/email'); // Email utility
const authRoutes = require('./routes/authRoutes'); // Authentication routes
const bookRoutes = require('./routes/bookRoutes'); // Book search routes
const savedRoutes = require('./routes/savedRoutes'); // Saved books routes

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(bodyParser.json()); // For parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(express.static('public')); // Serve static files

// **Initialize Passport**
require('./config/passport'); // Correctly require the Passport setup file
app.use(session({
    secret: process.env.JWT_SECRET, // Use the JWT_SECRET as the session secret
    resave: false,
    saveUninitialized: true
}));
app.use(passport.initialize()); // Initialize Passport
app.use(passport.session()); // Enable persistent login sessions

// Connect to MySQL using Sequelize
sequelize.authenticate()
    .then(() => {
        console.log('MySQL connected successfully');
        return sequelize.sync({ alter: true }); // Alter tables to match the model structure
    })
    .then(() => {
        console.log('Database synced successfully');
    })
    .catch(err => console.error('Error connecting to MySQL:', err));

// Routes
app.use('/auth', authRoutes); // Authentication routes
app.use('/books', bookRoutes); // Book search routes
app.use('/api', savedRoutes); // Saved books routes

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
