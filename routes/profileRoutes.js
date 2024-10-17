const express = require('express');
const User = require('models/user.js');
const authMiddleware = require('middleware/authMiddleware.js');
const router = express.Router();

// Get User Profile
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ username: user.username, email: user.email });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching profile', error });
    }
});

// Update User Profile
router.put('/profile', authMiddleware, async (req, res) => {
    const { username, email } = req.body;
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        await user.update({ username, email });
        res.status(200).json({ message: 'Profile updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating profile', error });
    }
});

module.exports = router;
