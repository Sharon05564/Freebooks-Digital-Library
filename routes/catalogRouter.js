const express = require('express');
const { SOURCES, CATEGORIES } = require('../services/bookCatalog');
module.exports = function createCatalogRouter(catalog) {
  const router = express.Router();
  router.get('/discover', async (req, res) => {
    const { q, source = 'all', category = '', page = '1', access = 'all' } = req.query;
    if (typeof q !== 'string' || !q.trim() || q.length > 200 ||
        !['all', ...Object.keys(SOURCES)].includes(source) ||
        (category !== '' && !CATEGORIES.has(category)) || !['all', 'free'].includes(access) ||
        typeof page !== 'string' || !/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 100) {
      return res.status(400).json({ error: 'Use a title or author (up to 200 characters), a valid source, and page 1–100.' });
    }
    try {
      const result = await catalog.search({ q: q.trim(), source, category, page: Number(page), access });
      res.set('Cache-Control', 'public, max-age=60').json(result);
    } catch {
      res.status(503).json({ error: 'Book sources are temporarily unavailable. Please try again.' });
    }
  });
  return router;
};
