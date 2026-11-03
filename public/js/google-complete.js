"use strict";
(async () => {
  try {
    const response = await fetch("/auth/google/session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-Requested-With": "FreeBooks" },
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok || !data.token || !data.user) throw new Error("expired");
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    // The server validates this path too; keep the client navigation local.
    const next = new URL(data.next || "/saved.html", location.origin);
    location.replace(
      next.origin === location.origin
        ? next.pathname + next.search + next.hash
        : "/saved.html",
    );
  } catch {
    document.getElementById("auth-status").textContent =
      "We couldn’t finish your sign-in. Please return to log in and try again.";
  }
})();
