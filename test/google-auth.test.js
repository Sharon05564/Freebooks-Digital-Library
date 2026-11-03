const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const http = require("node:http");
const express = require("express");
const session = require("express-session");
const jwt = require("jsonwebtoken");
process.env.JWT_SECRET = randomBytes(32).toString("hex");
process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "test-only-client-secret";
process.env.APP_ORIGIN = "http://127.0.0.1";

const users = new Map();
let nextId = 1;
const User = {
  async findOne({ where }) {
    return (
      [...users.values()].find((user) =>
        Object.entries(where).every(([key, value]) => user[key] === value),
      ) || null
    );
  },
  async findByPk(id) {
    return users.get(id) || null;
  },
  async create(data) {
    const user = { id: nextId++, ...data };
    users.set(user.id, user);
    return user;
  },
  async findOrCreate({ where, defaults }) {
    const existing = await this.findOne({ where });
    return existing
      ? [existing, false]
      : [await this.create({ ...defaults, ...where }), true];
  },
};
const userPath = require.resolve("../models/user");
require.cache[userPath] = {
  id: userPath,
  filename: userPath,
  loaded: true,
  exports: User,
};
const passport = require("../config/passport");
const routes = require("../routes/authRoutes");
const safeReturnPath = require("../services/authRedirect");
let profile;
let tokenExchanges = 0;
for (const mode of ["signin", "signup"]) {
  const strategy = passport._strategy("google-" + mode);
  strategy._oauth2.getOAuthAccessToken = (code, params, done) => {
    tokenExchanges++;
    assert.ok(
      params.code_verifier,
      "PKCE verifier is sent to the token endpoint",
    );
    done(null, "mock-google-access-token", null, {});
  };
  strategy._loadUserProfile = (_token, done) => done(null, profile);
}
let server, origin;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: process.env.JWT_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: "lax" },
    }),
  );
  app.use(passport.initialize());
  app.use("/auth", routes);
  app.use((error, _req, res, _next) =>
    res.status(500).json({ error: error.name }),
  );
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => {
  users.clear();
  nextId = 1;
  tokenExchanges = 0;
  profile = {
    id: "google-reader-1",
    displayName: "Reader",
    emails: [{ value: "reader@example.com", verified: true }],
    photos: [],
  };
});
const cookieFrom = (response) =>
  response.headers.get("set-cookie")?.split(";")[0];
async function start(mode = "signup", next = "/saved.html") {
  const route = mode === "signup" ? "/auth/google/signup" : "/auth/google";
  const response = await fetch(
    origin + route + "?next=" + encodeURIComponent(next),
    { redirect: "manual" },
  );
  assert.equal(response.status, 302);
  const google = new URL(response.headers.get("location"));
  assert.equal(google.hostname, "accounts.google.com");
  assert.equal(google.searchParams.get("code_challenge_method"), "S256");
  assert.ok(google.searchParams.get("state"));
  const cookie = cookieFrom(response);
  assert.ok(cookie);
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  return { route, cookie, state: google.searchParams.get("state") };
}
async function finish(flow, state = flow.state) {
  return fetch(
    origin +
      flow.route +
      "/callback?" +
      new URLSearchParams({ code: "mock-code", state }),
    { headers: { Cookie: flow.cookie }, redirect: "manual" },
  );
}
async function exchange(cookie, headers = {}) {
  return fetch(origin + "/auth/google/session", {
    method: "POST",
    headers: { Cookie: cookie, "X-Requested-With": "FreeBooks", ...headers },
  });
}
test("Google signup uses state and PKCE, creates one account, and hands off a JWT without putting it in a URL", async () => {
  const flow = await start("signup", "/search.html?q=poetry");
  const callback = await finish(flow);
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get("location"), "/auth/google/complete");
  assert.equal(callback.headers.get("cache-control"), "no-store");
  const cookie = cookieFrom(callback);
  assert.notEqual(cookie, flow.cookie, "session is regenerated");
  const result = await exchange(cookie);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("cache-control"), "no-store");
  const data = await result.json();
  assert.equal(
    jwt.verify(data.token, process.env.JWT_SECRET).userId,
    data.user.id,
  );
  assert.equal(data.user.username, "Reader");
  assert.equal(data.next, "/search.html?q=poetry");
  assert.equal(users.size, 1);
  assert.equal((await exchange(cookie)).status, 401, "handoff is consumed");
});
test("an invalid or replayed OAuth state cannot authenticate", async () => {
  const flow = await start();
  const response = await finish(flow, "wrong-state");
  assert.match(response.headers.get("location"), /google_error=failed/);
  assert.equal(tokenExchanges, 0);
  assert.equal(users.size, 0);
  assert.match(
    (await finish(flow)).headers.get("location"),
    /google_error=failed/,
  );
});
test("Google signup and signin reuse a Google identity instead of creating duplicates", async () => {
  await User.create({
    googleId: profile.id,
    username: "Returning reader",
    email: "reader@example.com",
    password: null,
  });
  for (const mode of ["signup", "signin"]) {
    const response = await finish(await start(mode));
    assert.equal(response.headers.get("location"), "/auth/google/complete");
    const result = await exchange(cookieFrom(response));
    assert.equal((await result.json()).user.username, "Returning reader");
  }
  assert.equal(users.size, 1);
});
test("Google cannot silently take over a password account with the same email", async () => {
  await User.create({
    username: "Password reader",
    email: "reader@example.com",
    googleId: null,
    password: "existing-password-hash",
  });
  const response = await finish(await start());
  assert.match(response.headers.get("location"), /google_error=email_exists/);
  assert.equal(users.get(1).googleId, null);
  assert.equal(users.size, 1);
});
test("new readers are directed to signup and unverified email cannot create an account", async () => {
  const response = await finish(await start("signin"));
  assert.match(
    response.headers.get("location"),
    /google_error=account_missing/,
  );
  profile.emails[0].verified = false;
  assert.match(
    (await finish(await start())).headers.get("location"),
    /google_error=unverified_email/,
  );
  assert.equal(users.size, 0);
});
test("cancelled consent returns a readable error and cannot create an account", async () => {
  const flow = await start();
  const response = await fetch(
    origin + flow.route + "/callback?error=access_denied",
    { headers: { Cookie: flow.cookie }, redirect: "manual" },
  );
  assert.match(response.headers.get("location"), /google_error=cancelled/);
  assert.equal(users.size, 0);
});
test("handoff requires the same-origin request header and cannot be exchanged concurrently", async () => {
  const response = await finish(await start());
  const cookie = cookieFrom(response);
  assert.equal(
    (await exchange(cookie, { "X-Requested-With": "" })).status,
    403,
  );
  const results = await Promise.all([exchange(cookie), exchange(cookie)]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 401]);
  assert.equal((await exchange("")).status, 401);
});
test("Google-only accounts do not crash password login", async () => {
  await User.create({
    googleId: profile.id,
    username: "Reader",
    email: "reader@example.com",
    password: null,
  });
  const response = await fetch(origin + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "reader@example.com",
      password: "wrong-password",
    }),
  });
  assert.equal(response.status, 400);
});
test("return paths stay local and cannot loop into an OAuth route", () => {
  for (const path of [
    "//evil.example",
    "/\\evil.example",
    "https://evil.example",
    "/auth/google",
    "/auth/../auth/google",
    "/\n/evil.example",
  ])
    assert.equal(safeReturnPath(path), "/saved.html");
  assert.equal(
    safeReturnPath("/search.html?q=poetry"),
    "/search.html?q=poetry",
  );
});
