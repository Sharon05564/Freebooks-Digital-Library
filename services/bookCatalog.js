const axios = require('axios');

const SOURCES = { google: 'Google Books', gutendex: 'Project Gutenberg', openlibrary: 'Open Library' };
const ACTIVE_SOURCES = Object.freeze(['google', 'openlibrary']);
const CATEGORIES = new Set(['fiction', 'fantasy', 'science', 'history', 'poetry']);
const PAGE_SIZE = 12;
const words = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function identity(book) {
  const info = book.volumeInfo;
  const author = info.authors?.[0] || '';
  const surname = author.includes(',') ? author.split(',')[0] : author.trim().split(/\s+/).at(-1);
  // Merge matching titles and author surnames, preferring the free reading source.
  return surname ? `${words(info.title)}|${words(surname)}` : book.id;
}
function mergeBooks(groups) {
  const best = new Map();
  for (const name of ['gutendex', 'google', 'openlibrary'])
    for (const book of groups[name] || []) {
      const key = identity(book);
      if (!best.has(key)) best.set(key, book);
    }
  const output = [], seen = new Set();
  for (let i = 0; i < PAGE_SIZE; i++)
    for (const name of ['gutendex', 'google', 'openlibrary']) {
      const book = groups[name]?.[i];
      if (!book) continue;
      const key = identity(book);
      if (!seen.has(key)) { seen.add(key); output.push(best.get(key)); }
    }
  return output;
}
function gutenbergURL(value) {
  try {
    const url = new URL(value);
    return ['gutenberg.org', 'www.gutenberg.org'].includes(url.hostname) && ['https:', 'http:'].includes(url.protocol)
      ? url.href.replace(/^http:/, 'https:') : '';
  } catch { return ''; }
}
function normalizeGutenberg(book) {
  if (!Number.isSafeInteger(book.id) || book.id <= 0 || typeof book.title !== 'string') return null;
  const formats = book.formats || {};
  return {
    id: `pg${book.id}`, source: 'gutendex', sourceLabel: SOURCES.gutendex,
    availability: 'free', actionLabel: 'Read book',
    downloadLink: gutenbergURL(formats['application/epub+zip']),
    volumeInfo: {
      title: book.title, authors: (book.authors || []).map(author => { const parts = String(author.name || '').split(','); return parts.length === 2 ? `${parts[1].trim()} ${parts[0].trim()}` : author.name; }).filter(Boolean),
      categories: (book.bookshelves?.length ? book.bookshelves : book.subjects || []).slice(0, 12),
      description: (book.summaries || []).join(' ').slice(0, 12000),
      imageLinks: { thumbnail: gutenbergURL(formats['image/jpeg']) },
      infoLink: `https://www.gutenberg.org/ebooks/${book.id}`,
    },
    accessInfo: { webReaderLink: `https://www.gutenberg.org/ebooks/${book.id}`, publicDomain: book.copyright === false },
  };
}
function normalizeOpenLibrary(book) {
  const id = String(book.key || '').replace(/^\/works\//, '');
  if (!/^OL\d+W$/.test(id) || typeof book.title !== 'string') return null;
  return {
    id: `ol-${id}`, source: 'openlibrary', sourceLabel: SOURCES.openlibrary,
    availability: book.ebook_access === 'public' || book.public_scan_b === true ? 'free' : 'catalog',
    actionLabel: 'View editions',
    volumeInfo: {
      title: book.title, authors: book.author_name || [], categories: (book.subject || []).slice(0, 12),
      imageLinks: { thumbnail: Number.isSafeInteger(book.cover_i) && book.cover_i > 0 ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg?default=false` : '' },
      infoLink: `https://openlibrary.org/works/${id}`,
    },
    accessInfo: {},
  };
}
function createBookCatalog({ get = axios.get, now = Date.now, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), enableGutenberg = false } = {}) {
  const cache = new Map(), pending = new Map();
  const gutenbergBase = (process.env.GUTENDEX_BASE_URL || 'https://gutendex.com').replace(/\/+$/, '');
  let openLibraryTail = Promise.resolve(), openLibraryNext = 0, queued = 0;
  function limitOpenLibrary(work) {
    if (queued >= 2) return Promise.reject(new Error('Provider busy'));
    queued++;
    const result = openLibraryTail.then(async () => {
      const delay = openLibraryNext - now();
      if (delay > 0) await wait(delay);
      openLibraryNext = now() + 1100; // Public, unidentified request limit: one per second.
      return work();
    });
    openLibraryTail = result.catch(() => {}).finally(() => { queued--; });
    return result;
  }
  async function fetchJSON(url, params = {}, openLibrary = false) {
    const key = url + '?' + new URLSearchParams(params);
    const hit = cache.get(key);
    if (hit && hit.expires > now()) return hit.data;
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= 40) throw new Error('Catalog busy');
    const fetch = () => get(url, {
      params, timeout: 7000, maxContentLength: 2 * 1024 * 1024,
      headers: { 'User-Agent': 'FreeBooks/1.0 (+https://github.com/Sharon05564/Freebooks-Digital-Library)' },
    });
    const work = (openLibrary ? limitOpenLibrary(fetch) : fetch()).then(({ data }) => {
      if (cache.size >= 300) cache.delete(cache.keys().next().value);
      cache.set(key, { data, expires: now() + 15 * 60 * 1000 });
      return data;
    }).finally(() => pending.delete(key));
    pending.set(key, work);
    return work;
  }
  async function provider(name, { q, category, page, access }) {
    const offset = (page - 1) * PAGE_SIZE;
    if (name === 'google') {
      const data = await fetchJSON('https://www.googleapis.com/books/v1/volumes', {
        q: q + (category ? ` subject:${category}` : ''), filter: 'free-ebooks',
        startIndex: offset, maxResults: PAGE_SIZE,
        ...(process.env.GOOGLE_BOOKS_API_KEY ? { key: process.env.GOOGLE_BOOKS_API_KEY } : {}),
      });
      const raw = Array.isArray(data.items) ? data.items : [];
      return { books: raw.filter(book => book.id && book.volumeInfo?.title).map(book => ({
        ...book, source: name, sourceLabel: SOURCES[name], availability: 'free', actionLabel: 'Read book',
      })), hasMore: raw.length === PAGE_SIZE };
    }
    if (name === 'gutendex') {
      const apiPage = Math.floor(offset / 32) + 1, within = offset % 32;
      const params = { search: q, ...(category ? { topic: category } : {}), page: apiPage };
      const data = await fetchJSON(`${gutenbergBase}/books/`, params);
      if (!Array.isArray(data.results) || !Number.isFinite(data.count)) throw new Error('Invalid Gutenberg response');
      let raw = data.results.slice(within, within + PAGE_SIZE);
      if (within + PAGE_SIZE > 32 && data.next) {
        // Construct the next request locally; never follow an upstream-supplied URL.
        const next = await fetchJSON(`${gutenbergBase}/books/`, { ...params, page: apiPage + 1 });
        raw = raw.concat((next.results || []).slice(0, PAGE_SIZE - raw.length));
      }
      return { books: raw.map(normalizeGutenberg).filter(Boolean), hasMore: offset + PAGE_SIZE < data.count };
    }
    const data = await fetchJSON('https://openlibrary.org/search.json', {
      q: q + (category ? ` subject:${category}` : '') + (access === 'free' ? ' ebook_access:public' : ''),
      fields: 'key,title,author_name,cover_i,subject,ebook_access,public_scan_b', limit: PAGE_SIZE, offset,
    }, true);
    if (!Array.isArray(data.docs)) throw new Error('Invalid Open Library response');
    const books = data.docs.map(normalizeOpenLibrary).filter(Boolean).filter(book => access !== 'free' || book.availability === 'free');
    return { books, hasMore: offset + PAGE_SIZE < (data.numFound ?? data.num_found ?? 0) };
  }
  async function search({ q, category = '', source = 'all', page = 1, access = 'all' }) {
    const active = enableGutenberg ? Object.keys(SOURCES) : ACTIVE_SOURCES;
    // Keep old Gutenberg search links usable while the provider is disabled.
    if (source === 'gutendex' && !enableGutenberg) source = 'all';
    const names = source === 'all' ? active : [source];
    const settled = await Promise.allSettled(names.map(name => provider(name, { q, category, page, access })));
    const groups = {}, providers = [];
    let hasMore = false;
    settled.forEach((result, index) => {
      const name = names[index];
      if (result.status === 'fulfilled') {
        groups[name] = result.value.books;
        hasMore ||= result.value.hasMore;
        providers.push({ id: name, label: SOURCES[name], status: 'ok', count: result.value.books.length });
      } else providers.push({ id: name, label: SOURCES[name], status: 'unavailable', count: 0 });
    });
    if (providers.every(item => item.status === 'unavailable')) throw new Error('All book sources unavailable');
    return { books: mergeBooks(groups), page, hasMore: page < 100 && hasMore, providers };
  }
  async function resolve(id) {
    if (/^pg\d+$/.test(id)) {
      if (!enableGutenberg) return null;
      if (!Number.isSafeInteger(Number(id.slice(2))) || Number(id.slice(2)) < 1) return null;
      const data = await fetchJSON(`${gutenbergBase}/books/${Number(id.slice(2))}`);
      return normalizeGutenberg(data);
    }
    if (/^ol-OL\d+W$/.test(id)) {
      const workId = id.slice(3);
      const data = await fetchJSON(`https://openlibrary.org/works/${workId}.json`, {}, true);
      if (!data.title) return null;
      return { id, volumeInfo: { title: data.title, categories: (data.subjects || []).slice(0, 20),
        description: String(typeof data.description === 'object' ? data.description?.value || '' : data.description || '').slice(0, 12000) } };
    }
    return null;
  }
  return { search, resolve };
}
const catalog = createBookCatalog();
module.exports = { ...catalog, createBookCatalog, normalizeGutenberg, normalizeOpenLibrary, mergeBooks, SOURCES, ACTIVE_SOURCES, CATEGORIES };
