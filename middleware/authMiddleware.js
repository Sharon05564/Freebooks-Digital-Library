const jwt = require('jsonwebtoken');

// Middleware to verify JWT tokens
const authMiddleware = (req, res, next) => {
    // Only the Authorization header is used anywhere in this app - there's no
    // cookie-parser middleware registered, so reading req.cookies would throw.
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET); // Attach the user information to the request object
        next(); // Call the next middleware or route handler
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Session expired. Please log in again.' });
        }
        return res.status(400).json({ message: 'Invalid token.' });
    }
};

module.exports = authMiddleware;
