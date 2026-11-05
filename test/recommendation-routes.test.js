const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const http = require("node:http");
const jwt = require("jsonwebtoken");
const { randomBytes } = require("node:crypto");
const createRouter = require("../routes/recommendationRouter");
const { byId } = require("../services/recommendationEngine");
process.env.JWT_SECRET = randomBytes(32).toString("hex");
const preferences = new Map(),
  feedback = new Map(),
  saved = new Map();
let server,
  origin,
  lookups = 0;
const models = {
  SavedBook: {
    async findAll({ where }) {
      return saved.get(where.userId) || [];
    },
  },
  Preference: {
    async findByPk(id) {
      return preferences.get(id) || null;
    },
    async upsert(value) {
      preferences.set(value.userId, value);
    },
  },
  Feedback: {
    async findAll({ where }) {
      return [...feedback.values()].filter(
        (item) => item.userId === where.userId,
      );
    },
    async upsert(item) {
      feedback.set(item.userId + ":" + item.bookId, item);
    },
    async destroy({ where }) {
      for (const [key, item] of feedback)
        if (
          item.userId === where.userId &&
          (!where.bookId || item.bookId === where.bookId)
        )
          feedback.delete(key);
    },
  },
  async resolveSeed(id) {
    lookups++;
    if (id === "upstream-failure") throw new Error("Unavailable");
    return byId.get(id) || null;
  },
};
before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api", createRouter(models));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = "http://127.0.0.1:" + server.address().port;
});
after(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => {
  preferences.clear();
  feedback.clear();
  saved.clear();
  lookups = 0;
});
function call(path, { user, method = "GET", body, authorization } = {}) {
  return fetch(origin + "/api" + path, {
    method,
    headers: {
      ...(user
        ? {
            Authorization:
              "Bearer " +
              jwt.sign({ userId: user }, process.env.JWT_SECRET, {
                expiresIn: "1h",
              }),
          }
        : {}),
      ...(authorization ? { Authorization: authorization } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
test("guests can discover books and get related recommendations without database writes", async () => {
  let response = await call("/recommendations?genres=romance");
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.context.basis, "preferences");
  assert.equal(data.signedIn, false);
  assert.equal(preferences.size, 0);
  response = await call("/recommendations?seed=pg84");
  assert.equal((await response.json()).context.seedTitle, "Frankenstein");
});
test("authentication is required for writes and invalid credentials cannot become guest reads", async () => {
  for (const [path, method, body] of [
    ["/recommendation-preferences", "PUT", { genres: ["romance"] }],
    ["/recommendation-feedback", "POST", { bookId: "pg84", value: 1 }],
    ["/recommendation-preferences", "DELETE", null],
  ])
    assert.equal((await call(path, { method, body })).status, 401);
  assert.equal(
    (await call("/recommendations", { authorization: "Bearer invalid" }))
      .status,
    401,
  );
});
test("account preferences and feedback are isolated and ignore submitted user IDs", async () => {
  assert.equal(
    (
      await call("/recommendation-preferences", {
        user: 1,
        method: "PUT",
        body: { genres: ["romance"], userId: 2 },
      })
    ).status,
    200,
  );
  await call("/recommendation-feedback", {
    user: 1,
    method: "POST",
    body: { bookId: "pg84", value: -1, userId: 2 },
  });
  const one = await (await call("/recommendations", { user: 1 })).json(),
    two = await (await call("/recommendations", { user: 2 })).json();
  assert.deepEqual(one.genres, ["romance"]);
  assert.deepEqual(two.genres, []);
  assert.ok(!one.books.some((book) => book.id === "pg84"));
  assert.ok(two.books.some((book) => book.id === "pg84"));
  assert.equal(preferences.has(2), false);
  assert.equal([...feedback.values()][0].userId, 1);
});
test("feedback undo and reset only affect the authenticated user and preserve saved books", async () => {
  for (const user of [1, 2]) {
    await call("/recommendation-preferences", {
      user,
      method: "PUT",
      body: { genres: ["horror"] },
    });
    await call("/recommendation-feedback", {
      user,
      method: "POST",
      body: { bookId: "pg84", value: -1 },
    });
  }
  saved.set(1, [
    { bookId: "pg1342", title: "Pride and Prejudice", authors: "Jane Austen" },
  ]);
  await call("/recommendation-feedback", {
    user: 1,
    method: "POST",
    body: { bookId: "pg84", value: 0 },
  });
  assert.equal(feedback.has("1:pg84"), false);
  await call("/recommendation-feedback", {
    user: 1,
    method: "POST",
    body: { bookId: "pg345", value: -1 },
  });
  assert.equal(
    (await call("/recommendation-preferences", { user: 1, method: "DELETE" }))
      .status,
    200,
  );
  assert.deepEqual(preferences.get(1).genres, []);
  assert.equal(feedback.has("1:pg345"), false);
  assert.equal(feedback.has("2:pg84"), true);
  assert.deepEqual(preferences.get(2).genres, ["horror"]);
  assert.equal(saved.get(1).length, 1);
});
test("invalid genres, scores, IDs and nested query parameters are rejected", async () => {
  for (const genres of [
    ["unknown"],
    ["romance", "romance"],
    ["fiction", "romance", "mystery", "fantasy", "history", "poetry"],
    "romance",
  ])
    assert.equal(
      (
        await call("/recommendation-preferences", {
          user: 1,
          method: "PUT",
          body: { genres },
        })
      ).status,
      400,
    );
  for (const body of [
    { bookId: "not-real", value: 1 },
    { bookId: "pg84", value: 2 },
    { bookId: "pg84", value: "1" },
  ])
    assert.equal(
      (
        await call("/recommendation-feedback", {
          user: 1,
          method: "POST",
          body,
        })
      ).status,
      400,
    );
  assert.equal((await call("/recommendations?genres[x]=romance")).status, 400);
  assert.equal(
    (await call("/recommendations?seed=https://evil.example")).status,
    400,
  );
  assert.equal(lookups, 0);
});
test("saved titles shape the user shelf and upstream failures have a useful response", async () => {
  saved.set(1, [
    {
      bookId: "google-pride",
      title: "Pride and Prejudice",
      authors: "Jane Austen",
    },
  ]);
  const result = await (await call("/recommendations", { user: 1 })).json();
  assert.equal(result.context.basis, "saved");
  assert.ok(!result.books.some((book) => book.id === "pg1342"));
  assert.equal((await call("/recommendations?seed=unknown-book")).status, 404);
  assert.equal(
    (await call("/recommendations?seed=upstream-failure")).status,
    503,
  );
});
