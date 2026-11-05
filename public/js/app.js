"use strict";
const classics = [
  {
    slug: "pride",
    title: "Pride and Prejudice",
    author: "Jane Austen",
    category: "Romance · 1813",
  },
  {
    slug: "alice",
    title: "Alice’s Adventures in Wonderland",
    author: "Lewis Carroll",
    category: "Fantasy · 1865",
  },
  {
    slug: "gatsby",
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    category: "Fiction · 1925",
  },
  {
    slug: "frankenstein",
    title: "Frankenstein",
    author: "Mary Shelley",
    category: "Gothic fiction · 1818",
  },
  {
    slug: "odyssey",
    title: "The Odyssey",
    author: "Homer",
    category: "Epic poetry · Ancient Greece",
  },
  {
    slug: "little-women",
    title: "Little Women",
    author: "Louisa May Alcott",
    category: "Fiction · 1868",
  },
  {
    slug: "dorian",
    title: "The Picture of Dorian Gray",
    author: "Oscar Wilde",
    category: "Gothic fiction · 1890",
  },
  {
    slug: "metamorphosis",
    title: "The Metamorphosis",
    author: "Franz Kafka",
    category: "Fiction · 1915",
  },
];
const classicSearch = (book) =>
  `/search.html?q=${encodeURIComponent(book.title + " " + book.author)}`;
const bookCache = new Map();
let savedIds = new Set();
let currentSearchController;
let homeRequest = 0;
const $ = (selector) => document.querySelector(selector);
const stateHTML = (
  title,
  description,
  link = "",
  label = "Explore the library",
) =>
  `<div class="empty-state">${icon("book")}<h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p>${link ? `<a class="button button-dark" href="${escapeHtml(link)}">${escapeHtml(label)} ${icon("arrow")}</a>` : ""}</div>`;
function skeleton(container, count = 4) {
  container.innerHTML = Array.from(
    { length: count },
    () => '<div class="skeleton" aria-hidden="true"></div>',
  ).join("");
  container.setAttribute("aria-busy", "true");
}
function curatedCards() {
  return classics
    .map(
      (book) =>
        `<article class="book-card"><div class="book-art"><a href="${classicSearch(book)}" aria-label="Find ${escapeHtml(book.title)}"><img src="/assets/covers/${book.slug}.svg" width="360" height="520" alt="Illustrated cover of ${escapeHtml(book.title)}" loading="lazy"><span class="card-arrow">${icon("arrow")}</span></a></div><div class="book-info"><div class="book-meta">${escapeHtml(book.category)}</div><h3><a href="${classicSearch(book)}">${escapeHtml(book.title)}</a></h3><p>${escapeHtml(book.author)}</p></div></article>`,
    )
    .join("");
}
function normalizeBook(book, saved = false) {
  const info = book.volumeInfo || {};
  const access = book.accessInfo || {};
  return saved
    ? {
        id: book.bookId,
        title: book.title,
        authors: book.authors,
        imageUrl: book.imageUrl,
        bookLink: safeUrl(book.bookLink),
        category: "On your bookshelf",
      }
    : {
        id: book.id,
        recommendation: book.recommendation,
        title: info.title || "Untitled book",
        authors: info.authors?.join(", ") || "Author unknown",
        imageUrl: info.imageLinks?.thumbnail || "",
        bookLink: safeUrl(
          access.webReaderLink || info.previewLink || info.infoLink,
        ),
        category: info.categories?.[0] || "Free ebook",
      };
}
function coverFallback(book) {
  return `<span class="cover-fallback"><small>FREEBOOKS<br>THE OPEN LIBRARY</small><span>${escapeHtml(book.title.slice(0, 80))}</span><small>${escapeHtml(book.authors.slice(0, 50))}</small></span>`;
}
function renderBooks(container, rawBooks, saved = false) {
  const books = rawBooks.map((book) => normalizeBook(book, saved));
  container.removeAttribute("aria-busy");
  if (!books.length) {
    container.innerHTML = stateHTML(
      saved
        ? "A little space for your next story."
        : "No books on this shelf just yet.",
      saved
        ? "Save a book while exploring the library. You’ll find it right here."
        : "Try a different title, author, or category. There’s plenty more to discover.",
      saved ? "/search.html?q=classic+literature" : "",
    );
    return;
  }
  container.innerHTML = books
    .map((book) => {
      bookCache.set(book.id, book);
      const image = safeUrl(book.imageUrl)?.replace(/^http:/, "https:");
      const link =
        book.bookLink ||
        classicSearch({ title: book.title, author: book.authors });
      return `<article class="book-card"><div class="book-art"><a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" aria-label="Read ${escapeHtml(book.title)} (opens in a new tab)">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(book.title)} cover" loading="lazy">` : coverFallback(book)}<span class="card-arrow">${icon("external")}</span></a><button class="save-book" data-book-id="${escapeHtml(book.id)}" data-remove="${saved}" aria-label="${saved || savedIds.has(book.id) ? "Remove" : "Save"} ${escapeHtml(book.title)}${saved || savedIds.has(book.id) ? " from" : " to"} your bookshelf" aria-pressed="${saved || savedIds.has(book.id)}">${icon("bookmark")}</button></div><div class="book-info"><div class="book-meta">${escapeHtml(book.category.slice(0, 45))}</div><h3><a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(book.title)}</a></h3><p>${escapeHtml(book.authors)}</p></div></article>`;
    })
    .join("");
  container.querySelectorAll(".book-art img").forEach((img) =>
    img.addEventListener(
      "error",
      () => {
        const card = img.closest(".book-card"),
          book = bookCache.get(
            card.querySelector("[data-book-id]").dataset.bookId,
          );
        img.outerHTML = coverFallback(book);
      },
      { once: true },
    ),
  );
  container
    .querySelectorAll(".save-book")
    .forEach((button) =>
      button.addEventListener("click", () => toggleSaved(button)),
    );
}
async function loadSavedIds() {
  if (!localStorage.getItem("token")) return;
  try {
    const saved = await request("/api/saved");
    savedIds = new Set(saved.map((book) => book.bookId));
    document
      .querySelectorAll(".save-book")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(savedIds.has(button.dataset.bookId)),
        ),
      );
  } catch (error) {
    if (error.status === 401 || error.status === 400) {
      clearAuth();
      updateNavbar();
    }
  }
}
async function toggleSaved(button) {
  if (!localStorage.getItem("token")) {
    location.href = loginLink();
    return;
  }
  const book = bookCache.get(button.dataset.bookId),
    remove = button.getAttribute("aria-pressed") === "true";
  button.disabled = true;
  try {
    if (remove) {
      await request("/api/saved/" + encodeURIComponent(book.id), {
        method: "DELETE",
      });
      savedIds.delete(book.id);
      notify("Removed from your bookshelf.");
    } else {
      await request("/api/saved", {
        method: "POST",
        body: JSON.stringify({
          bookId: book.id,
          title: book.title.slice(0, 300),
          authors: book.authors.slice(0, 300),
          ...(safeUrl(book.imageUrl)
            ? { imageUrl: safeUrl(book.imageUrl).slice(0, 500) }
            : {}),
          ...(book.bookLink ? { bookLink: book.bookLink.slice(0, 500) } : {}),
        }),
      });
      savedIds.add(book.id);
      notify("A new story for your bookshelf.");
    }
    document.querySelectorAll(".save-book").forEach((el) => {
      if (el.dataset.bookId === book.id) {
        el.setAttribute("aria-pressed", String(!remove));
        el.setAttribute(
          "aria-label",
          `${remove ? "Save" : "Remove"} ${book.title} ${remove ? "to" : "from"} your bookshelf`,
        );
      }
    });
    if (currentPage === "saved") await loadSavedBooks();
    window.dispatchEvent(new Event("bookshelfchange"));
  } catch (error) {
    if (error.status === 401) {
      authExpired();
      return;
    }
    notify(error.message);
  } finally {
    button.disabled = false;
  }
}
function initializeHome() {
  const sequence = [
    classics[4],
    classics[6],
    classics[1],
    classics[0],
    classics[2],
    classics[3],
    classics[5],
    classics[7],
    classics[4],
  ];
  $("#hero-books").innerHTML = sequence
    .map(
      (book, index) =>
        `<a class="tunnel-book" href="${classicSearch(book)}" style="--i:${index - 4};--distance:${Math.abs(index - 4)}" aria-label="Explore ${escapeHtml(book.title)}"><img src="/assets/covers/${book.slug}.svg" width="360" height="520" alt="${escapeHtml(book.title)}"></a>`,
    )
    .join("");
  $("#home-books").innerHTML = curatedCards();
  const hero = $(".book-tunnel");
  if (
    !matchMedia("(prefers-reduced-motion: reduce)").matches &&
    matchMedia("(pointer:fine)").matches
  ) {
    hero.addEventListener("pointermove", (event) =>
      hero.style.setProperty(
        "--drift",
        `${(event.clientX / innerWidth - 0.5) * 22}px`,
      ),
    );
    hero.addEventListener("pointerleave", () =>
      hero.style.setProperty("--drift", "0px"),
    );
  }
  document.querySelectorAll("[data-category]").forEach((button) =>
    button.addEventListener("click", async () => {
      const id = ++homeRequest;
      document.querySelectorAll("[data-category]").forEach((tab) => {
        tab.classList.toggle("active", tab === button);
        tab.setAttribute("aria-pressed", String(tab === button));
      });
      const container = $("#home-books");
      if (button.dataset.category === "curated") {
        container.innerHTML = curatedCards();
        container.removeAttribute("aria-busy");
        return;
      }
      skeleton(container);
      try {
        const books = await request(
          `/books/search?q=${encodeURIComponent(button.dataset.category + " subject:" + button.dataset.category)}&maxResults=8`,
        );
        if (id === homeRequest) renderBooks(container, books);
      } catch {
        if (id === homeRequest) {
          container.removeAttribute("aria-busy");
          container.innerHTML = stateHTML(
            "This shelf needs a moment.",
            "We couldn’t load the books. Choose another category or try again.",
          );
        }
      }
    }),
  );
  loadSavedIds();
}
let offset = 0;
const pageSize = 12;
let activeCategory = "";
async function loadSearch() {
  const params = new URLSearchParams(location.search),
    query = params.get("q")?.trim() || "classic literature";
  $("#searchBar").value = query;
  $("#search-title").textContent = params.has("q")
    ? `A little more “${query}”.`
    : "Explore the library.";
  activeCategory = params.get("category") || "";
  $("#categorySelect").value = activeCategory;
  const container = $("#results");
  skeleton(container, 8);
  $("#result-summary").textContent = "Finding your next read…";
  $("#prevBtn").disabled = true;
  $("#nextBtn").disabled = true;
  currentSearchController?.abort();
  currentSearchController = new AbortController();
  try {
    const books = await request(
      "/books/search?" +
        new URLSearchParams({
          q: query,
          category: activeCategory,
          startIndex: offset,
          maxResults: pageSize,
        }),
      { signal: currentSearchController.signal },
    );
    renderBooks(container, books);
    $("#result-summary").textContent = books.length
      ? `${offset + 1}–${offset + books.length} · Free ebooks for curious minds`
      : "No books found";
    $("#prevBtn").disabled = offset === 0;
    $("#nextBtn").disabled = books.length < pageSize;
    $("#page-number").textContent = "Page " + (offset / pageSize + 1);
  } catch (error) {
    if (error.name === "AbortError") return;
    container.removeAttribute("aria-busy");
    container.innerHTML = stateHTML(
      "A pause between chapters.",
      "We couldn’t load your books. Please try your search again.",
    );
    $("#result-summary").textContent = "Books are temporarily unavailable";
    $("#prevBtn").disabled = offset === 0;
  }
}
function initializeSearch() {
  const params = new URLSearchParams(location.search);
  if (params.get("category")) {
    const field = document.createElement("input");
    field.type = "hidden";
    field.name = "category";
    field.value = params.get("category");
    $(".search-form").append(field);
  }
  $("#prevBtn").addEventListener("click", () => {
    offset = Math.max(0, offset - pageSize);
    loadSearch();
    $("#results").scrollIntoView({ block: "start" });
  });
  $("#nextBtn").addEventListener("click", () => {
    offset += pageSize;
    loadSearch();
    $("#results").scrollIntoView({ block: "start" });
  });
  $("#categorySelect").addEventListener("change", (event) => {
    const url = new URL(location.href);
    if (event.target.value)
      url.searchParams.set("category", event.target.value);
    else url.searchParams.delete("category");
    history.replaceState(null, "", url);
    let hidden = $(".search-form input[name=category]");
    if (hidden) hidden.value = event.target.value;
    else {
      hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = "category";
      hidden.value = event.target.value;
      $(".search-form").append(hidden);
    }
    offset = 0;
    loadSearch();
  });
  loadSearch();
  loadSavedIds();
}
async function loadSavedBooks() {
  const container = $("#savedBooks");
  if (!localStorage.getItem("token")) {
    container.innerHTML = stateHTML(
      "Your next chapter needs a home.",
      "Log in to save the books you love and build a bookshelf of your own.",
      loginLink(),
      "Log in to your bookshelf",
    );
    $("#saved-count").textContent = "Your stories, together";
    return;
  }
  skeleton(container);
  try {
    const books = await request("/api/saved");
    savedIds = new Set(books.map((book) => book.bookId));
    renderBooks(container, books, true);
    $("#saved-count").textContent =
      books.length +
      " " +
      (books.length === 1 ? "story" : "stories") +
      " on your shelf";
  } catch (error) {
    if (error.status === 401 || error.status === 400) {
      clearAuth();
      updateNavbar();
      return loadSavedBooks();
    }
    container.removeAttribute("aria-busy");
    container.innerHTML = stateHTML(
      "Your shelf is taking a moment.",
      "We couldn’t load your saved books. Please refresh to try again.",
    );
  }
}
function initializeAuth() {
  const form = $("#auth-form");
  const params = new URLSearchParams(location.search);
  const next = params.get("next");
  if (next) {
    const google = $("#google-auth");
    google.href += "?next=" + encodeURIComponent(next);
    const switchLink = $(".auth-switch a");
    switchLink.href += "?next=" + encodeURIComponent(next);
  }
  const googleErrors = {
    unavailable:
      "Google sign-in is temporarily unavailable. You can still use email.",
    cancelled:
      "Google sign-in was cancelled. You can try again when you’re ready.",
    failed: "We couldn’t complete Google sign-in. Please try again.",
    account_missing:
      "No FreeBooks account is linked to this Google account yet. Choose Create an account, then Sign up with Google.",
    email_exists:
      "This email already has a FreeBooks account. Please log in with its password. Your existing bookshelf has not been changed.",
    unverified_email:
      "Please use a Google account with a verified email address.",
    expired: "Your sign-in expired. Please try again.",
  };
  const googleError = params.get("google_error");
  if (googleError)
    $("#google-message").textContent =
      googleErrors[googleError] || googleErrors.failed;

  $("#toggle-password").addEventListener("click", (event) => {
    const input = $("#password"),
      show = input.type === "password";
    input.type = show ? "text" : "password";
    event.currentTarget.setAttribute(
      "aria-label",
      show ? "Hide password" : "Show password",
    );
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = $("#form-message"),
      button = form.querySelector("[type=submit]"),
      mode = form.dataset.mode;
    message.textContent = "";
    message.classList.remove("success");
    button.disabled = true;
    try {
      const data = await request("/auth/" + mode, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      if (mode === "register") {
        message.classList.add("success");
        message.textContent = "Your account is ready. Taking you to log in…";
        setTimeout(
          () =>
            (location.href =
              "/login.html" +
              (next ? "?next=" + encodeURIComponent(next) : "")),
          900,
        );
        return;
      }
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      location.href =
        next &&
        next.startsWith("/") &&
        !next.startsWith("//") &&
        !next.includes("\\")
          ? next
          : "/saved.html";
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}
async function initializeProfile() {
  const area = $("#profile-container");
  if (!localStorage.getItem("token")) {
    area.innerHTML = stateHTML(
      "A place for your next chapter.",
      "Log in to see your account and update your details.",
      loginLink(),
      "Log in",
    );
    return;
  }
  try {
    const profile = await request("/profile");
    $("#username").value = profile.username;
    $("#email").value = profile.email;
  } catch (error) {
    if (error.status === 401 || error.status === 400) {
      authExpired();
      return;
    }
    area.innerHTML = stateHTML(
      "Your account is taking a moment.",
      "Please refresh the page to try again.",
    );
    return;
  }
  $("#profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget,
      button = form.querySelector("[type=submit]"),
      message = $("#form-message");
    message.textContent = "";
    message.classList.remove("success");
    button.disabled = true;
    try {
      const payload = Object.fromEntries(new FormData(form));
      await request("/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      localStorage.setItem(
        "user",
        JSON.stringify({ ...getStoredUser(), ...payload }),
      );
      updateNavbar();
      message.textContent = "Your details are up to date.";
      message.classList.add("success");
    } catch (error) {
      if (error.status === 401) {
        authExpired();
        return;
      }
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}
function initializeContact() {
  $("#contact-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget,
      button = form.querySelector("[type=submit]"),
      message = $("#form-message");
    button.disabled = true;
    message.textContent = "";
    message.classList.remove("success");
    try {
      await request("/api/sendMessage", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      message.textContent =
        "Your message is on its way. Thanks for saying hello!";
      message.classList.add("success");
      form.reset();
    } catch {
      message.textContent =
        "We couldn’t send your message right now. Please try again later.";
    } finally {
      button.disabled = false;
    }
  });
}
if (currentPage === "index") initializeHome();
if (currentPage === "search") initializeSearch();
if (currentPage === "saved") loadSavedBooks();
if (currentPage === "login" || currentPage === "register") initializeAuth();
if (currentPage === "profile") initializeProfile();
if (currentPage === "contact") initializeContact();
