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
                startIndex: parseInt(0), //
                maxResults: parseInt(10), //
                key: apiKey,
            },
        });

        const books = response.data.items || [];
        res.json(books);
    } catch (error) {
        console.error('Error fetching books:', error.message);
        res.status(500).json({ error: 'Error fetching books from Google API' });
    }
});

// Trending books for the homepage
router.get('/trending', async (req, res) => {
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

    try {
        const response = await axios.get('https://www.googleapis.com/books/v1/volumes', {
            params: {
                q: 'computer+action+fiction+OR+nonfiction',
                filter: 'free-ebooks',
                maxResults: 5,
                key: apiKey,
            },
        });

        res.json(response.data.items || []);
    } catch (error) {
        console.error('Error fetching trending books:', error.message);
        res.status(500).json({ error: 'Error fetching trending books' });
    }
});

// Lightweight title suggestions for the search autocomplete box
router.get('/suggest', async (req, res) => {
    const { query = '' } = req.query;
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

    if (!query.trim()) {
        return res.json([]);
    }

    try {
        const response = await axios.get('https://www.googleapis.com/books/v1/volumes', {
            params: {
                q: query.trim(),
                filter: 'free-ebooks',
                maxResults: 5,
                key: apiKey,
            },
        });

        const suggestions = (response.data.items || []).map((book) => ({
            title: book.volumeInfo?.title || 'Untitled',
        }));
        res.json(suggestions);
    } catch (error) {
        console.error('Error fetching suggestions:', error.message);
        res.status(500).json({ error: 'Error fetching suggestions' });
    }
});

module.exports = router;
