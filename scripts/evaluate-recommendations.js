const {
  recommend,
  catalog,
  byId,
} = require("../services/recommendationEngine");
// Small, hand-labeled diagnostic set. It measures topical retrieval on this
// curated collection, not real-world recommendation quality or user outcomes.
const cases = [
  {
    query: "detective investigation clues crime London",
    relevant: ["pg1661", "pg43", "pg2554"],
  },
  { query: "journey time inventor distant future", relevant: ["pg35"] },
  {
    query: "sisters courtship marriage social class",
    relevant: ["pg1342", "pg161", "pg158", "pg105"],
  },
  { query: "solitude nature simple life philosophy", relevant: ["pg205"] },
  { query: "sea voyage pirates buried treasure map", relevant: ["pg120"] },
  { query: "aliens invasion technology survival", relevant: ["pg36"] },
  { query: "vampire castle supernatural horror", relevant: ["pg345"] },
  {
    query: "political rulers power leadership state",
    relevant: ["pg1232", "pg132"],
  },
];
function evaluate() {
  let hits = 0,
    baselineHits = 0,
    reciprocalRank = 0;
  const baseline = catalog.slice(0, 3).map((book) => book.id);
  const results = cases.map((item) => {
    const ids = recommend({
      saved: [{ title: "Reader interest", description: item.query }],
      limit: 3,
    }).books.map((book) => book.id);
    const rank = ids.findIndex((id) => item.relevant.includes(id));
    if (rank >= 0) {
      hits++;
      reciprocalRank += 1 / (rank + 1);
    }
    if (baseline.some((id) => item.relevant.includes(id))) baselineHits++;
    return { query: item.query, top3: ids, hit: rank >= 0 };
  });
  const discovery = recommend().books;
  const uniqueGenres = new Set(
    discovery.map((book) => byId.get(book.id).genres[0]),
  ).size;
  return {
    catalogSize: catalog.length,
    queries: cases.length,
    hitRateAt3: hits / cases.length,
    meanReciprocalRank: reciprocalRank / cases.length,
    baselineHitRateAt3: baselineHits / cases.length,
    discoveryUniqueGenres: uniqueGenres,
    results,
  };
}
if (require.main === module) {
  const results = evaluate();
  console.log(JSON.stringify(results, null, 2));
  if (results.hitRateAt3 < 0.75 || results.discoveryUniqueGenres < 5)
    process.exitCode = 1;
}
module.exports = { evaluate, cases };
