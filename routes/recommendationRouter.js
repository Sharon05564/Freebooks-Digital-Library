const express = require("express");
const jwt = require("jsonwebtoken");
const {
  recommend,
  GENRES,
  byId,
  findCatalogBook,
} = require("../services/recommendationEngine");

// Dependencies are injected so route tests exercise authentication and account
// isolation without connecting to, or writing into, a production database.
function createRecommendationRouter({
  SavedBook,
  Preference,
  Feedback,
  resolveSeed,
  transaction = async (work) => work(undefined),
}) {
  const router = express.Router();
  function optionalAuth(req, res, next) {
    const header = req.get("Authorization");
    if (!header) return next();
    try {
      if (!/^Bearer \S+$/.test(header))
        throw new Error("Invalid authorization");
      const claims = jwt.verify(header.slice(7), process.env.JWT_SECRET, {
        algorithms: ["HS256"],
      });
      if (!Number.isInteger(claims.userId) || claims.userId < 1)
        throw new Error("Invalid account");
      req.userId = claims.userId;
      next();
    } catch {
      res
        .status(401)
        .json({ message: "Please log in again to see your bookshelf picks." });
    }
  }
  const requireAuth = (req, res, next) =>
    req.userId
      ? next()
      : res
          .status(401)
          .json({ message: "Log in to save your reading preferences." });
  function validGenres(value) {
    return (
      Array.isArray(value) &&
      value.length <= 5 &&
      value.every(
        (genre) => typeof genre === "string" && Object.hasOwn(GENRES, genre),
      ) &&
      new Set(value).size === value.length
    );
  }
  router.use(optionalAuth);
  router.get("/recommendations", async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (
      req.query.seed !== undefined &&
      (typeof req.query.seed !== "string" ||
        !/^[A-Za-z0-9_-]{1,100}$/.test(req.query.seed))
    )
      return res
        .status(400)
        .json({ message: "Choose a valid book to find similar stories." });
    if (req.query.genres !== undefined && typeof req.query.genres !== "string")
      return res
        .status(400)
        .json({ message: "Choose up to five reading interests." });
    const override =
      req.query.genres === undefined
        ? null
        : req.query.genres.split(",").filter(Boolean);
    if (override && !validGenres(override))
      return res
        .status(400)
        .json({ message: "Choose up to five valid reading interests." });
    try {
      const [saved, preference, feedback] = req.userId
        ? await Promise.all([
            SavedBook.findAll({
              where: { userId: req.userId },
              order: [["updatedAt", "DESC"]],
              attributes: ["bookId", "title", "authors"],
            }),
            Preference.findByPk(req.userId),
            Feedback.findAll({ where: { userId: req.userId } }),
          ])
        : [[], null, []];
      let seed = null;
      if (req.query.seed) {
        try {
          seed = await resolveSeed(req.query.seed);
        } catch {
          return res
            .status(503)
            .json({
              message:
                "We couldn’t look up this book right now. Please try again.",
            });
        }
        if (!seed)
          return res
            .status(404)
            .json({
              message: "We couldn’t find that book. Try another story.",
            });
      }
      // Existing Google Books shelves contain titles/authors. Enrich only a
      // few recent books, transiently, to keep response time and quota bounded.
      const inputs = saved.map((book) =>
        book.get ? book.get({ plain: true }) : book,
      );
      const enriched = await Promise.all(
        inputs.slice(0, 3).map(async (book) => {
          const known = findCatalogBook(book);
          if (known) return known;
          try {
            return (await resolveSeed(book.bookId)) || book;
          } catch {
            return book;
          }
        }),
      );
      const genres = override || preference?.genres || [];
      const result = recommend({
        saved: [...enriched, ...inputs.slice(3)],
        seed,
        genres,
        feedback,
        limit: Math.min(12, Math.max(1, parseInt(req.query.limit, 10) || 8)),
      });
      res.json({
        ...result,
        availableGenres: Object.entries(GENRES).map(([id, label]) => ({
          id,
          label,
        })),
        signedIn: Boolean(req.userId),
      });
    } catch (error) {
      console.error("Recommendation request failed:", error.name);
      res
        .status(503)
        .json({
          message:
            "Your recommendations are taking a moment. Please try again.",
        });
    }
  });
  router.put("/recommendation-preferences", requireAuth, async (req, res) => {
    const genres = req.body?.genres;
    if (!validGenres(genres))
      return res
        .status(400)
        .json({ message: "Choose up to five valid reading interests." });
    try {
      await Preference.upsert({ userId: req.userId, genres });
      res.json({ genres });
    } catch (error) {
      console.error("Preference update failed:", error.name);
      res
        .status(503)
        .json({
          message: "We couldn’t save your reading interests. Please try again.",
        });
    }
  });
  router.delete(
    "/recommendation-preferences",
    requireAuth,
    async (req, res) => {
      try {
        await transaction(async (tx) => {
          await Preference.upsert(
            { userId: req.userId, genres: [] },
            { transaction: tx },
          );
          await Feedback.destroy({
            where: { userId: req.userId },
            transaction: tx,
          });
        });
        res.json({ genres: [], reset: true });
      } catch (error) {
        console.error("Recommendation reset failed:", error.name);
        res
          .status(503)
          .json({
            message:
              "We couldn’t reset your recommendations. Please try again.",
          });
      }
    },
  );
  router.post("/recommendation-feedback", requireAuth, async (req, res) => {
    const { bookId, value } = req.body || {};
    if (!byId.has(bookId) || ![-1, 0, 1].includes(value))
      return res
        .status(400)
        .json({ message: "Choose a valid recommendation and response." });
    try {
      if (value === 0)
        await Feedback.destroy({ where: { userId: req.userId, bookId } });
      else await Feedback.upsert({ userId: req.userId, bookId, value });
      res.json({ bookId, value });
    } catch (error) {
      console.error("Recommendation feedback failed:", error.name);
      res
        .status(503)
        .json({ message: "We couldn’t save your feedback. Please try again." });
    }
  });
  return router;
}
module.exports = createRecommendationRouter;
