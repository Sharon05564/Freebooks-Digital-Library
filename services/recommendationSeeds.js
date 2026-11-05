const axios = require("axios");
const { byId } = require("./recommendationEngine");
const cache = new Map();
async function resolveSeed(id) {
  if (byId.has(id)) return byId.get(id);
  if (
    typeof id !== "string" ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(id) ||
    /^pg\d+$/.test(id)
  )
    return null;
  const cached = cache.get(id);
  if (cached && cached.expires > Date.now()) return cached.book;
  const { data } = await axios.get(
    `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(id)}`,
    {
      params: { key: process.env.GOOGLE_BOOKS_API_KEY },
      timeout: 6000,
    },
  );
  const info = data.volumeInfo;
  if (!info?.title) return null;
  const book = {
    id,
    title: info.title,
    authors: info.authors || [],
    description: String(info.description || "").slice(0, 12000),
    categories: info.categories || [],
  };
  if (cache.size >= 200) cache.delete(cache.keys().next().value);
  cache.set(id, { book, expires: Date.now() + 15 * 60 * 1000 });
  return book;
}
module.exports = resolveSeed;
