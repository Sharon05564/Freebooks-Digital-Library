// Resolve against a fixed origin so encoded slashes and browser URL
// normalization cannot turn the return path into an external redirect.
function safeReturnPath(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\x00-\x20]/.test(value)
  )
    return "/saved.html";
  try {
    const url = new URL(value, "https://freebooks.invalid");
    if (
      url.origin !== "https://freebooks.invalid" ||
      /^\/auth(?:\/|$)/.test(url.pathname)
    )
      return "/saved.html";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/saved.html";
  }
}
module.exports = safeReturnPath;
