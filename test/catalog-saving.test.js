const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
// Exercise the real saved-book route with an isolated in-memory database boundary.
const records = [];
const modelPath = require.resolve('../models/savedBook');
const previous = require.cache[modelPath];
require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: {
  findOne: async ({ where }) => records.find(record => record.userId === where.userId && record.bookId === where.bookId),
  create: async record => { records.push(record); return record; },
} };
const savedRouter = require('../routes/savedRoutes');
if (previous) require.cache[modelPath] = previous;
else delete require.cache[modelPath];
let server, origin;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
before(async () => {
  const app = express(); app.use(express.json()); app.use('/api', savedRouter);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
test('Gutenberg and Open Library IDs save with their source links and authenticated ownership', async () => {
  const token = jwt.sign({ userId: 7 }, process.env.JWT_SECRET);
  for (const [bookId, bookLink] of [['pg1342', 'https://www.gutenberg.org/ebooks/1342'], ['ol-OL123W', 'https://openlibrary.org/works/OL123W']]) {
    const response = await fetch(origin + '/api/saved', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bookId, bookLink, title: 'Example book', authors: 'Example author', userId: 99 }),
    });
    assert.equal(response.status, 201);
    const saved = await response.json();
    assert.equal(saved.bookId, bookId); assert.equal(saved.bookLink, bookLink); assert.equal(saved.userId, 7);
  }
});
test('new provider books cannot be saved by guests', async () => {
  const response = await fetch(origin + '/api/saved', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: 'pg84', title: 'Frankenstein', authors: 'Mary Shelley' }) });
  assert.equal(response.status, 401);
  assert.equal(records.length, 2);
});
