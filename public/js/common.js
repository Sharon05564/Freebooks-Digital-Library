"use strict";
const paths = {
  book: '<path d="M3 5.5c3-1 6-.5 9 2 3-2.5 6-3 9-2v14c-3-1-6-.5-9 2-3-2.5-6-3-9-2z"/><path d="M12 7.5v14"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  bookmark: '<path d="M6 4h12v17l-6-4-6 4z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  external: '<path d="M14 4h6v6m0-6L10 14M10 4H4v16h16v-6"/>',
};
function icon(name) {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;
}
function hydrateIcons(root = document) {
  root
    .querySelectorAll("[data-icon]")
    .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
}
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}
function safeUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value, location.origin);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
function notify(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => el.classList.remove("show"), 4200);
}
function loginLink() {
  return (
    "/login.html?next=" +
    encodeURIComponent(location.pathname + location.search)
  );
}
function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
function authExpired() {
  clearAuth();
  location.href = loginLink();
}
function updateNavbar() {
  const user = getStoredUser(),
    token = localStorage.getItem("token");
  const logged = Boolean(user && token);
  const slot = document.getElementById("nav-account");
  if (slot)
    slot.innerHTML = logged
      ? `<a class="nav-shelf" href="/saved.html">${icon("bookmark")}<span>My bookshelf</span></a><a class="user-link" href="/profile.html">${escapeHtml(user.username || "My account")}</a><button id="logoutBtn" class="nav-logout">Log out</button>`
      : `<a class="login-link" href="/login.html">Log in</a><a class="button button-dark button-small" href="/register.html">Create a shelf ${icon("arrow")}</a>`;
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    clearAuth();
    location.href = "/";
  });
}
async function request(path, options = {}) {
  const token = localStorage.getItem("token");
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Something went wrong. Please try again.");
  }
  if (!response.ok) {
    const error = new Error(
      data.message || data.error || "Something went wrong. Please try again.",
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
const currentPage = document.body.dataset.page;
document.getElementById("site-header").innerHTML =
  `<div class="announcement"><span>A world of stories. Open to everyone.</span><a href="/about.html">Meet FreeBooks <span aria-hidden="true">↗</span></a></div><header class="site-header"><div class="header-inner"><a class="brand" href="/" aria-label="FreeBooks home"><span class="brand-icon">${icon("book")}</span>FreeBooks<span class="brand-period">.</span></a><nav class="main-nav" aria-label="Main navigation"><a href="/#library" ${currentPage === "search" ? 'aria-current="page"' : ""}>Discover</a><a href="/search.html?q=classic+literature">The classics</a><a href="/about.html" ${currentPage === "about" ? 'aria-current="page"' : ""}>Our story</a></nav><div class="nav-account" id="nav-account"></div><button class="menu-toggle" aria-label="Open navigation" aria-expanded="false">${icon("menu")}</button></div></header>`;
document.querySelector(".menu-toggle").addEventListener("click", (event) => {
  const button = event.currentTarget,
    open = button.getAttribute("aria-expanded") !== "true";
  button.setAttribute("aria-expanded", String(open));
  button.setAttribute(
    "aria-label",
    open ? "Close navigation" : "Open navigation",
  );
  button.innerHTML = icon(open ? "close" : "menu");
  document.querySelector(".header-inner").classList.toggle("menu-open", open);
});
document.getElementById("site-footer").innerHTML =
  `<footer class="site-footer"><div class="footer-top"><div><a class="brand" href="/"><span class="brand-icon">${icon("book")}</span>FreeBooks<span class="brand-period">.</span></a><p>A world of stories. A shelf of your own.</p></div><nav aria-label="Footer navigation"><a href="/#library">Discover</a><a href="/about.html">Our story</a><a href="/contact.html">Say hello ${icon("arrow")}</a><a href="/privacy.html">Privacy</a></nav></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} FreeBooks. Read a little further.</span><span>Books discovered through Google Books ${icon("external")}</span></div></footer>`;
updateNavbar();
hydrateIcons();
