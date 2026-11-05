const catalog = require("../data/recommendation-catalog.json");
const GENRES = Object.freeze({
  fiction: "Literary fiction",
  romance: "Romance",
  mystery: "Mystery",
  fantasy: "Fantasy",
  "science-fiction": "Science fiction",
  horror: "Gothic & horror",
  adventure: "Adventure",
  history: "History",
  poetry: "Poetry",
  nonfiction: "Nonfiction",
  philosophy: "Philosophy",
});
const stopwords = new Set(
  "a an and are as at be been by for from has have his her he in into is it its of on or that the their them they this through to was were which who with about also becomes can does one story book novel explores while".split(
    " ",
  ),
);
function tokens(text) {
  return (
    String(text || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/<[^>]*>/g, " ")
      .match(/[a-z]{3,}/g)
      ?.filter((word) => !stopwords.has(word)) || []
  );
}
const normalizedTitle = (value) => tokens(value).join(" ");
const byId = new Map(catalog.map((book) => [book.id, book]));
function titleOf(book) {
  return book.title || book.volumeInfo?.title || "";
}
function authorsOf(book) {
  const value = book.authors || book.volumeInfo?.authors || [];
  return Array.isArray(value) ? value.join(" ") : value;
}
function findCatalogBook(book) {
  const exact = byId.get(book.id || book.bookId);
  if (exact) return exact;
  const title = normalizedTitle(titleOf(book));
  if (!title) return null;
  return (
    catalog.find((candidate) => {
      const canonical = normalizedTitle(candidate.title);
      return (
        title === canonical ||
        (canonical.length > 8 && title.startsWith(canonical + " "))
      );
    }) || null
  );
}
function documentText(book) {
  const genres =
    book.genres || book.volumeInfo?.categories || book.categories || [];
  const title = titleOf(book),
    authors = authorsOf(book);
  const description = book.description || book.volumeInfo?.description || "";
  return `${title} ${title} ${authors} ${authors} ${genres.join(" ")} ${genres.join(" ")} ${(book.tags || []).join(" ")} ${description}`;
}
const documents = catalog.map((book) => tokens(documentText(book)));
const frequencies = new Map();
for (const terms of documents)
  for (const term of new Set(terms))
    frequencies.set(term, (frequencies.get(term) || 0) + 1);
const idf = new Map(
  [...frequencies].map(([term, count]) => [
    term,
    Math.log((catalog.length + 1) / (count + 1)) + 1,
  ]),
);
function normalize(vector) {
  const norm = Math.sqrt(
    [...vector.values()].reduce((sum, value) => sum + value * value, 0),
  );
  return norm
    ? new Map([...vector].map(([term, value]) => [term, value / norm]))
    : new Map();
}
function vectorize(text) {
  const counts = new Map();
  for (const term of tokens(text))
    if (idf.has(term)) counts.set(term, (counts.get(term) || 0) + 1);
  return normalize(
    new Map(
      [...counts].map(([term, count]) => [
        term,
        (1 + Math.log(count)) * idf.get(term),
      ]),
    ),
  );
}
const vectors = new Map(
  catalog.map((book) => [book.id, vectorize(documentText(book))]),
);
function vectorFor(book) {
  const known = findCatalogBook(book);
  return known ? vectors.get(known.id) : vectorize(documentText(book));
}
function cosine(a, b) {
  let score = 0;
  for (const [term, value] of a) score += value * (b.get(term) || 0);
  return score;
}
function addVector(target, vector, weight) {
  for (const [term, value] of vector)
    target.set(term, (target.get(term) || 0) + value * weight);
}
function explanation(book, seeds, genres, liked) {
  let closest = null,
    best = 0;
  for (const seed of [...seeds, ...liked]) {
    const score = cosine(vectors.get(book.id), vectorFor(seed));
    if (score > best) {
      best = score;
      closest = seed;
    }
  }
  const known = closest && findCatalogBook(closest);
  if (closest && best > 0.06) {
    const sharedGenre =
      known && book.genres.find((genre) => known.genres.includes(genre));
    const commonTags =
      known && book.tags.filter((tag) => known.tags.includes(tag));
    if (commonTags?.length)
      return `Shares themes of ${commonTags.slice(0, 2).join(" and ")} with ${titleOf(closest)}.`;
    if (sharedGenre)
      return `More ${GENRES[sharedGenre].toLowerCase()} to explore after ${titleOf(closest)}.`;
    const author = book.authors.find((name) =>
      authorsOf(closest).includes(name),
    );
    if (author)
      return `Another book by ${author}, an author you showed interest in.`;
  }
  const preferred = book.genres.find((genre) => genres.includes(genre));
  return preferred
    ? `A ${GENRES[preferred].toLowerCase()} pick for your reading interests.`
    : "A different corner of our classics collection to explore.";
}
function asVolume(book, reason) {
  return {
    id: book.id,
    volumeInfo: {
      title: book.title,
      authors: book.authors,
      description: book.description,
      categories: book.genres.map((genre) => GENRES[genre]),
      imageLinks: book.imageUrl ? { thumbnail: book.imageUrl } : {},
      infoLink: book.bookLink,
    },
    accessInfo: { webReaderLink: book.bookLink, publicDomain: true },
    recommendation: { reason, source: book.source, genres: book.genres },
  };
}
function recommend({
  saved = [],
  genres = [],
  feedback = [],
  seed = null,
  limit = 8,
} = {}) {
  const selectedGenres = [...new Set(genres)]
    .filter((genre) => Object.hasOwn(GENRES, genre))
    .slice(0, 5);
  const excluded = new Set(
    saved.map((book) => findCatalogBook(book)?.id).filter(Boolean),
  );
  if (seed) {
    const match = findCatalogBook(seed);
    if (match) excluded.add(match.id);
  }
  const liked = [],
    profile = new Map();
  const seeds = seed ? [seed] : saved.slice(0, 12);
  const usableSeeds = seeds.filter((book) => vectorFor(book).size);
  for (const book of usableSeeds)
    addVector(profile, vectorFor(book), (seed ? 3 : 2) / usableSeeds.length);
  for (const genre of selectedGenres)
    addVector(
      profile,
      vectorize(`${genre} ${GENRES[genre]}`),
      0.8 / selectedGenres.length,
    );
  for (const item of feedback) {
    const book = byId.get(item.bookId);
    if (!book) continue;
    if (item.value === -1) {
      excluded.add(book.id);
      addVector(profile, vectors.get(book.id), -0.25);
    }
    if (item.value === 1) {
      liked.push(book);
      addVector(profile, vectors.get(book.id), 0.6);
    }
  }
  const profileVector = normalize(profile);
  let candidates = catalog
    .filter((book) => !excluded.has(book.id))
    .map((book, order) => ({
      book,
      score: profileVector.size
        ? cosine(profileVector, vectors.get(book.id))
        : 0,
      order,
    }));
  const selected = [];
  // Maximal marginal relevance keeps relevance while reducing near-duplicate
  // authors/themes. New readers get a deliberately varied classics shelf.
  while (
    candidates.length &&
    selected.length < Math.min(12, Math.max(1, limit))
  ) {
    candidates.sort((a, b) => {
      const adjusted = (item) => {
        const repetition = selected.length
          ? Math.max(
              ...selected.map((previous) =>
                cosine(
                  vectors.get(item.book.id),
                  vectors.get(previous.book.id),
                ),
              ),
            )
          : 0;
        const sameAuthor = selected.filter((previous) =>
          previous.book.authors.some((author) =>
            item.book.authors.includes(author),
          ),
        ).length;
        const sameGenre = selected.filter(
          (previous) => previous.book.genres[0] === item.book.genres[0],
        ).length;
        return (
          item.score -
          0.12 * repetition -
          0.15 * sameAuthor -
          (profileVector.size ? 0.015 : 0.12) * sameGenre
        );
      };
      return adjusted(b) - adjusted(a) || a.order - b.order;
    });
    selected.push(candidates.shift());
  }
  const basis = seed
    ? "similar"
    : usableSeeds.length
      ? "saved"
      : selectedGenres.length
        ? "preferences"
        : liked.length
          ? "feedback"
          : "discovery";
  return {
    books: selected.map(({ book }) => {
      const volume = asVolume(
        book,
        explanation(book, usableSeeds, selectedGenres, liked),
      );
      volume.recommendation.feedback =
        feedback.find((item) => item.bookId === book.id)?.value || 0;
      return volume;
    }),
    context: {
      basis,
      seedTitle: seed ? titleOf(seed) : null,
      catalogSize: catalog.length,
    },
    genres: selectedGenres,
    model: "tfidf-content-v1",
  };
}
module.exports = {
  recommend,
  catalog,
  GENRES,
  byId,
  findCatalogBook,
  vectorize,
  vectorFor,
  cosine,
  asVolume,
};
