const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const createRouter = require('../routes/catalogRouter');
let server, origin, searches = [];
before(async () => {
  const app = express();
  app.use('/books', createRouter({ search: async params => {
    searches.push(params);
    if (params.q === 'failure') throw new Error('private upstream details');
    return { books: [], page: params.page, hasMore: false, providers: [{ id: params.source, status: 'ok' }] };
  } }));
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
test('discovery validates user query shapes before calling providers', async () => {
  for (const query of ['', 'q[]=book', 'q=book&source=unknown', 'q=book&page=-1', 'q=book&page=101', 'q=book&page=1.5', 'q=book&category[]=fiction', 'q=book&access=paid', 'q=' + 'x'.repeat(201)]) {
    const response = await fetch(`${origin}/books/discover?${query}`);
    assert.equal(response.status, 400, query);
  }
  assert.equal(searches.length, 0);
});
test('discovery forwards only bounded filters and returns a cacheable public response', async () => {
  const response = await fetch(`${origin}/books/discover?q=%20Austen%20&source=gutendex&category=fiction&page=2&access=free&userId=123`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=60');
  assert.deepEqual(searches.at(-1), { q: 'Austen', source: 'all', category: 'fiction', page: 2, access: 'free' });
});
test('discovery does not expose upstream error details', async () => {
  const response = await fetch(`${origin}/books/discover?q=failure`);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private/);
});
