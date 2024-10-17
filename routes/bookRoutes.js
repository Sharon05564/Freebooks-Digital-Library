const express = require('express');
const axios = require('axios');
require('dotenv').config(); // Load environment variables

const router = express.Router();

// Search books with pagination and category filtering
router.get('/search', async (req, res) => {
    const { q = '', category, startIndex = 0, maxResults = 10 } = req.query;

    if (!q) {
        return res.status(400).json({ error: 'Search query is required' });
    }

    let query = q.trim();
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

    if (category) query += `+subject:${category}`; // Add category filter if provided

    try {
        const response = await axios.get('https://www.googleapis.com/books/v1/volumes', {
            params: {
                q: query,
                filter: 'free-ebooks',
                startIndex: parseInt(startIndex), // Ensure it's an integer
                maxResults: parseInt(maxResults), // Ensure it's an integer
                key: apiKey,
            },
        });

        const books = response.data.items || []; // Default to empty array if no items
        res.json(books);
    } catch (error) {
        console.error('Error fetching books:', error.message);
        res.status(500).json({ error: 'Error fetching books from Google API' });
    }
});

module.exports = router;
