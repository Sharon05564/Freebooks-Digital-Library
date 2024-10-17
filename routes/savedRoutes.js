const express = require('express');
const SavedBook = require('../models/SavedBook');
const authMiddleware = require('../middleware/authMiddleware'); // Ensure this middleware is correctly used
const router = express.Router();

// Route to save a book
router.post('/saved', authMiddleware, async (req, res) => {
    const { bookId, title, authors, imageUrl, bookLink } = req.body;
    const userId = req.user.userId;

    try {
        // Log data for debugging
        console.log('Received data to save:', { userId, bookId, title, authors, imageUrl, bookLink });

        // Check if the book is already saved by the user
        const existingBook = await SavedBook.findOne({ where: { userId, bookId } });
        if (existingBook) {
            return res.status(400).json({ message: 'Book is already saved.' });
        }

        // Save the new book entry
        const savedBook = await SavedBook.create({ userId, bookId, title, authors, imageUrl, bookLink });
        res.status(201).json(savedBook);
    } catch (error) {
        console.error('Error saving book:', error);
        res.status(500).json({ error: 'Failed to save book' });
    }
});

// Route to get saved books for a user
router.get('/saved', authMiddleware, async (req, res) => {
    const userId = req.user.userId;

    try {
        const savedBooks = await SavedBook.findAll({ where: { userId } });
        res.status(200).json(savedBooks);
    } catch (error) {
        console.error('Error retrieving saved books:', error);
        res.status(500).json({ error: 'Failed to retrieve saved books' });
    }
});

// Route to remove a saved book
router.delete('/saved/:bookId', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    const { bookId } = req.params;

    try {
        // Find the book to delete
        const savedBook = await SavedBook.findOne({ where: { userId, bookId } });

        if (!savedBook) {
            return res.status(404).json({ message: 'Book not found in saved items.' });
        }

        // Delete the book
        await savedBook.destroy();
        res.status(200).json({ message: 'Book removed successfully.' });
    } catch (error) {
        console.error('Error removing saved book:', error);
        res.status(500).json({ error: 'Failed to remove saved book' });
    }
});

module.exports = router;
