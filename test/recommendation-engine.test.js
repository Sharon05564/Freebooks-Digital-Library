const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  recommend,
  catalog,
  byId,
  findCatalogBook,
} = require("../services/recommendationEngine");
const { evaluate } = require("../scripts/evaluate-recommendations");
test("catalog has real unique source IDs, original descriptions, and free source links", () => {
  assert.equal(catalog.length, 40);
  assert.equal(new Set(catalog.map((book) => book.id)).size, 40);
  for (const book of catalog) {
    assert.match(book.bookLink, /^https:\/\/www\.gutenberg\.org\/ebooks\/\d+$/);
    assert.equal(typeof book.publicDomainUSA, "boolean");
    assert.ok(book.rightsStatus);
    assert.ok(book.description.length > 80);
  }
});
test("related books are relevant and the seed and saved editions are excluded", () => {
  const result = recommend({
    seed: byId.get("pg84"),
    saved: [
      {
        bookId: "google-austen",
        title: "Pride and Prejudice: An illustrated edition",
        authors: "Jane Austen",
      },
    ],
  });
  const ids = result.books.map((book) => book.id);
  assert.equal(ids[0], "pg43");
  assert.ok(!ids.includes("pg84"));
  assert.ok(!ids.includes("pg1342"));
  assert.equal(result.context.basis, "similar");
  assert.match(result.books[0].recommendation.reason, /Frankenstein/);
  assert.equal(findCatalogBook({ title: "Pride and Prejudice" }).id, "pg1342");
});
test("a saved romance book shapes recommendations without requiring a pretrained neural service", () => {
  const result = recommend({
    saved: [
      {
        bookId: "google-pride",
        title: "Pride and Prejudice",
        authors: "Jane Austen",
      },
    ],
    limit: 4,
  });
  assert.equal(result.context.basis, "saved");
  assert.ok(
    result.books
      .slice(0, 3)
      .some((book) => ["pg161", "pg158", "pg105"].includes(book.id)),
  );
  assert.ok(!result.books.some((book) => book.id === "pg1342"));
});
test("new readers get varied discoveries and can express genre preferences", () => {
  const discovery = recommend();
  assert.equal(discovery.context.basis, "discovery");
  assert.equal(discovery.books.length, 8);
  assert.ok(
    new Set(discovery.books.map((book) => book.recommendation.genres[0]))
      .size >= 5,
  );
  const picks = recommend({ genres: ["romance"] });
  assert.equal(picks.context.basis, "preferences");
  assert.ok(
    picks.books
      .slice(0, 3)
      .every((book) => book.recommendation.genres.includes("romance")),
  );
});
test("negative feedback is excluded, positive feedback is retained in responses, and reset removes it", () => {
  const result = recommend({
    feedback: [
      { bookId: "pg84", value: -1 },
      { bookId: "pg1342", value: 1 },
    ],
  });
  assert.ok(!result.books.some((book) => book.id === "pg84"));
  assert.ok(
    result.books.some(
      (book) => book.id === "pg1342" && book.recommendation.feedback === 1,
    ),
  );
  assert.equal(result.context.basis, "feedback");
  assert.ok(recommend().books.some((book) => book.id === "pg84"));
});
test("no duplicates and no more picks than the catalog when users have explored everything", () => {
  const ids = recommend({ limit: 12 }).books.map((book) => book.id);
  assert.equal(ids.length, new Set(ids).size);
  assert.equal(recommend({ saved: catalog }).books.length, 0);
});
test("small labeled evaluation beats a fixed first-three baseline and preserves discovery diversity", () => {
  const metrics = evaluate();
  assert.ok(metrics.hitRateAt3 >= 0.75);
  assert.ok(metrics.hitRateAt3 > metrics.baselineHitRateAt3);
  assert.ok(metrics.discoveryUniqueGenres >= 5);
});

test("free copyrighted translations are not labeled public domain", () => {
  assert.equal(byId.get("pg5200").publicDomainUSA, false);
  const result = recommend({ genres: ["fiction"], limit: 12 });
  for (const volume of result.books)
    assert.equal(
      volume.accessInfo.publicDomain,
      byId.get(volume.id).publicDomainUSA,
    );
});
