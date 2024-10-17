const jwt = require('jsonwebtoken');

// Middleware to verify JWT tokens
const authMiddleware = (req, res, next) => {
    // Check for the token in both the Authorization header and cookies
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies.jwt;

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
