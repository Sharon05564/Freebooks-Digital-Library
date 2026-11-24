const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createBookCatalog, normalizeGutenberg, normalizeOpenLibrary, mergeBooks } = require('../services/bookCatalog');
const pg = (id, title = `Book ${id}`) => ({ id, title, authors: [{ name: 'Austen, Jane' }], copyright: false,
  formats: { 'application/epub+zip': `https://www.gutenberg.org/ebooks/${id}.epub3.images`, 'image/jpeg': `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg` } });
const ol = (id, title = `Book ${id}`, extra = {}) => ({ key: `/works/OL${id}W`, title, author_name: ['Jane Austen'], ...extra });

test('Gutenberg preserves namespaced identities, correct rights, and safe EPUB links', () => {
  const book = normalizeGutenberg(pg(1342, 'Pride and Prejudice'));
  assert.equal(book.id, 'pg1342');
  assert.equal(book.volumeInfo.authors[0], 'Jane Austen');
  assert.equal(book.availability, 'free');
  assert.match(book.downloadLink, /^https:\/\/www.gutenberg.org\//);
  assert.equal(normalizeGutenberg({ ...pg(5200), copyright: true }).accessInfo.publicDomain, false);
  assert.equal(normalizeGutenberg({ ...pg(1), formats: { 'application/epub+zip': 'https://attacker.example/file' } }).downloadLink, '');
});
test('Open Library records are catalog listings unless a public edition is signaled', () => {
  assert.equal(normalizeOpenLibrary(ol(1)).availability, 'catalog');
  assert.equal(normalizeOpenLibrary(ol(1, 'Example', { ebook_access: 'borrowable' })).availability, 'catalog');
  assert.equal(normalizeOpenLibrary(ol(1, 'Example', { ebook_access: 'public' })).availability, 'free');
  assert.equal(normalizeOpenLibrary({ ...ol(1), key: 'https://evil.example' }), null);
});
test('cross-source duplicate titles prefer Gutenberg and retain distinct works', () => {
  const pgBook = normalizeGutenberg(pg(1, 'Pride and Prejudice'));
  const google = { id: 'google-one', volumeInfo: { title: 'Pride and Prejudice', authors: ['Jane Austen'] } };
  const result = mergeBooks({ gutendex: [pgBook], google: [google], openlibrary: [normalizeOpenLibrary(ol(2, 'Emma'))] });
  assert.deepEqual(result.map(book => book.id), ['pg1', 'ol-OL2W']);
});
test('Gutendex pagination crosses a 32-book API boundary without skipping or repeating', async () => {
  const calls = [];
  const catalog = createBookCatalog({ get: async (url, { params }) => {
    calls.push(params.page);
    const start = (params.page - 1) * 32;
    return { data: { count: 70, next: 'https://untrusted.example/do-not-follow', results: Array.from({ length: Math.min(32, 70 - start) }, (_, i) => pg(start + i + 1)) } };
  } });
  const page3 = await catalog.search({ q: 'Austen', source: 'gutendex', page: 3 });
  assert.deepEqual(page3.books.map(book => book.id), Array.from({ length: 12 }, (_, i) => `pg${i + 25}`));
  const page4 = await catalog.search({ q: 'Austen', source: 'gutendex', page: 4 });
  assert.deepEqual(page4.books.map(book => book.id), Array.from({ length: 12 }, (_, i) => `pg${i + 37}`));
  assert.deepEqual(calls, [1, 2]);
  const last = await catalog.search({ q: 'Austen', source: 'gutendex', page: 6 });
  assert.equal(last.books.length, 10);
  assert.equal(last.hasMore, false);
});
test('a provider failure still returns other providers with an explicit warning status', async () => {
  const catalog = createBookCatalog({ get: async url => {
    if (url.includes('googleapis')) throw new Error('Quota exceeded');
    if (url.includes('openlibrary')) return { data: { docs: [ol(1)], numFound: 1 } };
    return { data: { results: [pg(2)], count: 1, next: null } };
  } });
  const result = await catalog.search({ q: 'books' });
  assert.equal(result.books.length, 2);
  assert.equal(result.providers.find(p => p.id === 'google').status, 'unavailable');
  assert.equal(result.hasMore, false);
});
test('all provider failures reject; no failed result is cached', async () => {
  let calls = 0;
  const catalog = createBookCatalog({ get: async () => { calls++; throw new Error('Offline'); } });
  await assert.rejects(catalog.search({ q: 'books', source: 'gutendex' }));
  await assert.rejects(catalog.search({ q: 'books', source: 'gutendex' }));
  assert.equal(calls, 2);
});
test('concurrent identical requests coalesce, cache expires, and filters stay in the key', async () => {
  let calls = 0, time = 0;
  const catalog = createBookCatalog({ now: () => time, get: async () => { calls++; return { data: { count: 1, results: [pg(1)] } }; } });
  await Promise.all([catalog.search({ q: 'books', source: 'gutendex' }), catalog.search({ q: 'books', source: 'gutendex' })]);
  assert.equal(calls, 1);
  await catalog.search({ q: 'books', source: 'gutendex', category: 'history' });
  assert.equal(calls, 2);
  time = 16 * 60 * 1000;
  await catalog.search({ q: 'books', source: 'gutendex' });
  assert.equal(calls, 3);
});
test('free availability queries exclude unconfirmed Open Library entries', async () => {
  let query;
  const catalog = createBookCatalog({ get: async (url, { params }) => {
    query = params.q;
    return { data: { docs: [ol(1), ol(2, 'Free', { ebook_access: 'public' })], numFound: 2 } };
  } });
  const result = await catalog.search({ q: 'books', source: 'openlibrary', access: 'free', category: 'fiction' });
  assert.match(query, /subject:fiction ebook_access:public/);
  assert.deepEqual(result.books.map(book => book.id), ['ol-OL2W']);
});
test('new provider book IDs resolve for More like this without being sent to Google', async () => {
  const calls = [];
  const catalog = createBookCatalog({ wait: async () => {}, get: async url => {
    calls.push(url);
    return { data: url.includes('gutendex') ? pg(9999) : { title: 'Another book', subjects: ['Fantasy'], description: { value: 'A journey' } } };
  } });
  assert.equal((await catalog.resolve('pg9999')).id, 'pg9999');
  assert.equal((await catalog.resolve('ol-OL123W')).volumeInfo.description, 'A journey');
  assert.equal(await catalog.resolve('ol-https://evil.example'), null);
  assert.ok(calls.every(url => !url.includes('googleapis')));
});
