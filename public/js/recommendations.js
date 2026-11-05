"use strict";
(() => {
  const section = document.getElementById("recommendations");
  const guestKey = "freebooks-reading-interests";
  const genreIds = new Set([
    "fiction",
    "romance",
    "mystery",
    "fantasy",
    "science-fiction",
    "horror",
    "adventure",
    "history",
    "poetry",
    "nonfiction",
    "philosophy",
  ]);
  let activeGenres = [];
  let activeRequest = 0;
  let loadController;
  const feedbackState = new Map();
  function readGuestGenres() {
    try {
      const value = JSON.parse(localStorage.getItem(guestKey));
      return Array.isArray(value)
        ? [...new Set(value.filter((item) => genreIds.has(item)))].slice(0, 5)
        : [];
    } catch {
      return [];
    }
  }
  function isSignedIn() {
    return Boolean(localStorage.getItem("token"));
  }
  function makeSimilarLink(id, title) {
    const link = document.createElement("a");
    link.className = "more-like-link";
    link.href = "/discover.html?book=" + encodeURIComponent(id);
    link.textContent = "More like this";
    link.setAttribute("aria-label", "More like " + title);
    return link;
  }
  function enhanceCards(root) {
    root.querySelectorAll(".book-card").forEach((card) => {
      if (card.querySelector(".more-like-link")) return;
      const info = card.querySelector(".book-info");
      if (!info) return;
      const save = card.querySelector("[data-book-id]");
      let id = save?.dataset.bookId;
      const title = info.querySelector("h3")?.textContent || "this book";
      if (!id) {
        const classic = classics.find((book) => book.title === title);
        const classicIds = {
          pride: "pg1342",
          alice: "pg11",
          gatsby: "pg64317",
          frankenstein: "pg84",
          odyssey: "pg1727",
          "little-women": "pg514",
          dorian: "pg174",
          metamorphosis: "pg5200",
        };
        id = classic && classicIds[classic.slug];
      }
      if (id) info.append(makeSimilarLink(id, title));
      const book = id && bookCache.get(id);
      if (book?.recommendation) {
        feedbackState.set(id, book.recommendation.feedback || 0);
        const reason = document.createElement("p");
        reason.className = "recommendation-reason";
        reason.textContent = book.recommendation.reason;
        info.append(reason);
        const controls = document.createElement("div");
        controls.className = "recommendation-feedback";
        for (const [value, label] of [
          [1, "Interested"],
          [-1, "Not for me"],
        ]) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = label;
          button.dataset.feedback = String(value);
          button.setAttribute("aria-label", label + ": " + title);
          button.setAttribute(
            "aria-pressed",
            String((feedbackState.get(id) || 0) === value),
          );
          button.addEventListener("click", () =>
            sendFeedback(id, value, card, button),
          );
          controls.append(button);
        }
        info.append(controls);
      }
    });
  }
  // Search, categories and saved books replace their grids asynchronously.
  // Observe only those containers and only enhance newly inserted book cards.
  for (const id of [
    "home-books",
    "results",
    "savedBooks",
    "recommendation-books",
  ]) {
    const grid = document.getElementById(id);
    if (!grid) continue;
    new MutationObserver((records) => {
      if (
        records.some((record) =>
          [...record.addedNodes].some(
            (node) => node.nodeType === 1 && node.matches(".book-card"),
          ),
        )
      )
        enhanceCards(grid);
    }).observe(grid, { childList: true });
    enhanceCards(grid);
  }
  async function sendFeedback(id, value, card, button) {
    if (!isSignedIn()) {
      location.href = loginLink();
      return;
    }
    const previous = feedbackState.get(id) || 0;
    const next = previous === value ? 0 : value;
    const buttons = [
      ...card.querySelectorAll(".recommendation-feedback button"),
    ];
    buttons.forEach((el) => (el.disabled = true));
    try {
      await request("/api/recommendation-feedback", {
        method: "POST",
        body: JSON.stringify({ bookId: id, value: next }),
      });
      feedbackState.set(id, next);
      if (next === -1) {
        card.classList.add("recommendation-hidden");
        const notice = document.createElement("div");
        notice.className = "feedback-undo";
        const text = document.createElement("p");
        text.textContent = "We’ll leave this one off your next shelf.";
        const undo = document.createElement("button");
        undo.className = "button button-outline";
        undo.type = "button";
        undo.textContent = "Undo";
        undo.addEventListener("click", async () => {
          undo.disabled = true;
          try {
            await request("/api/recommendation-feedback", {
              method: "POST",
              body: JSON.stringify({ bookId: id, value: previous }),
            });
            feedbackState.set(id, previous);
            card.classList.remove("recommendation-hidden");
            notice.remove();
            card
              .querySelectorAll("[data-feedback]")
              .forEach((el) =>
                el.setAttribute(
                  "aria-pressed",
                  String(Number(el.dataset.feedback) === previous),
                ),
              );
          } catch (error) {
            notify(error.message);
            undo.disabled = false;
          }
        });
        notice.append(text, undo);
        card.append(notice);
        undo.focus();
      }
      buttons.forEach((el) =>
        el.setAttribute(
          "aria-pressed",
          String(Number(el.dataset.feedback) === next),
        ),
      );
      if (next !== -1)
        notify(
          next
            ? "We’ll use this to shape your next picks."
            : "Recommendation feedback cleared.",
        );
    } catch (error) {
      if (error.status === 401) {
        authExpired();
        return;
      }
      notify(error.message);
    } finally {
      buttons.forEach((el) => (el.disabled = false));
    }
  }
  if (!section) return;
  const preferenceForm = document.getElementById("reading-preferences");
  const toggle = section.querySelector(".preference-toggle");
  toggle.addEventListener("click", () => {
    const open = preferenceForm.hidden;
    preferenceForm.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  });
  function renderGenreChoices(choices) {
    const container = document.getElementById("genre-options");
    container.replaceChildren();
    for (const genre of choices) {
      const label = document.createElement("label");
      label.className = "genre-choice";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "genres";
      input.value = genre.id;
      input.checked = activeGenres.includes(genre.id);
      const text = document.createElement("span");
      text.textContent = genre.label;
      label.append(input, text);
      container.append(label);
      input.addEventListener("change", () => {
        const count = container.querySelectorAll(":checked").length;
        if (count > 5) {
          input.checked = false;
          document.getElementById("preference-status").textContent =
            "Choose up to five genres.";
        } else document.getElementById("preference-status").textContent = "";
      });
    }
  }
  async function loadRecommendations() {
    const requestId = ++activeRequest;
    loadController?.abort();
    loadController = new AbortController();
    const grid = document.getElementById("recommendation-books");
    skeleton(grid, 4);
    const params = new URLSearchParams({ limit: "8" });
    const seed = new URLSearchParams(location.search).get("book");
    if (currentPage === "discover" && seed) params.set("seed", seed);
    if (!isSignedIn()) {
      activeGenres = readGuestGenres();
      params.set("genres", activeGenres.join(","));
    }
    try {
      const data = await request("/api/recommendations?" + params, {
        signal: loadController.signal,
      });
      if (requestId !== activeRequest) return;
      activeGenres = data.genres;
      const basis = data.context.basis;
      document.getElementById("recommendation-title").textContent =
        basis === "similar"
          ? "A different book. A familiar feeling."
          : basis === "saved" || basis === "feedback"
            ? "Picked for your shelf."
            : basis === "preferences"
              ? "A little more your kind of story."
              : "Where will your curiosity take you?";
      document.getElementById("recommendation-description").textContent =
        basis === "similar"
          ? "Related stories, chosen by themes, genres, and authors."
          : basis === "saved"
            ? "Inspired by the stories you’ve saved and the interests you’ve shared."
            : basis === "preferences"
              ? "A few classics chosen around your reading interests."
              : "Choose a few genres, or save a book to make this shelf your own.";
      if (data.context.seedTitle && document.getElementById("similar-title"))
        document.getElementById("similar-title").textContent =
          "More like “" + data.context.seedTitle + "”.";
      document.getElementById("recommendation-note").textContent =
        `Selected from our ${data.context.catalogSize}-book collection of public-domain classics from Project Gutenberg.`;
      renderGenreChoices(data.availableGenres);
      if (basis === "discovery") {
        preferenceForm.hidden = false;
        toggle.setAttribute("aria-expanded", "true");
      }
      renderBooks(grid, data.books);
      enhanceCards(grid);
      if (!data.books.length)
        grid.innerHTML = stateHTML(
          "You’ve explored this little collection.",
          "Try changing your reading interests or explore more books in the main library.",
          "/search.html?q=classic+literature",
        );
      await loadSavedIds();
    } catch (error) {
      if (requestId !== activeRequest || error.name === "AbortError") return;
      if (error.status === 401) {
        clearAuth();
        updateNavbar();
        return loadRecommendations();
      }
      grid.removeAttribute("aria-busy");
      grid.innerHTML = stateHTML(
        "A pause between stories.",
        error.message ||
          "We couldn’t load your recommendations. Please try again.",
      );
      const retry = document.createElement("button");
      retry.className = "button button-outline";
      retry.type = "button";
      retry.textContent = "Try again";
      retry.addEventListener("click", loadRecommendations);
      grid.querySelector(".empty-state").append(retry);
    }
  }
  preferenceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const genres = new FormData(preferenceForm).getAll("genres");
    const button = preferenceForm.querySelector("[type=submit]");
    const status = document.getElementById("preference-status");
    button.disabled = true;
    try {
      if (isSignedIn())
        await request("/api/recommendation-preferences", {
          method: "PUT",
          body: JSON.stringify({ genres }),
        });
      else localStorage.setItem(guestKey, JSON.stringify(genres));
      activeGenres = genres;
      status.textContent = isSignedIn()
        ? "Reading interests saved."
        : "Saved in this browser.";
      await loadRecommendations();
    } catch (error) {
      if (error.status === 401) {
        authExpired();
        return;
      }
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  section
    .querySelector(".reset-picks")
    .addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        if (isSignedIn())
          await request("/api/recommendation-preferences", {
            method: "DELETE",
          });
        localStorage.removeItem(guestKey);
        activeGenres = [];
        feedbackState.clear();
        await loadRecommendations();
        notify(
          "Reading interests and feedback reset. Your saved books are unchanged.",
        );
      } catch (error) {
        if (error.status === 401) {
          authExpired();
          return;
        }
        notify(error.message);
      } finally {
        button.disabled = false;
      }
    });
  let shelfTimer;
  window.addEventListener("bookshelfchange", () => {
    clearTimeout(shelfTimer);
    shelfTimer = setTimeout(loadRecommendations, 300);
  });
  loadRecommendations();
})();
