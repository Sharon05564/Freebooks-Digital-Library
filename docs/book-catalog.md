# Multi-source book discovery

Gutenberg/Gutendex is temporarily disabled (November 24, 2026). Public searches
query only Google Books and Open Library. The source selector and discovery
credits omit Gutenberg; old `source=gutendex` links fall back to all active
sources. Unknown Gutenberg seed IDs do not make API requests. The existing
40-book offline recommendation catalog and saved reading links still work.
The Gutendex adapter remains for later restoration; its fixture tests explicitly
opt in with `enableGutenberg: true`.


`GET /books/discover?q=Austen&source=all&access=all&page=1&category=fiction`
returns `{books, page, hasMore, providers}`. Sources are `all`, `google`,
`gutendex`, or `openlibrary`. Availability is `all` or `free`; categories are
fiction, fantasy, science, history, poetry, or empty. Queries have a 200-character
limit and pages range from 1 to 100. Existing `/books/search`, `/trending`, and
`/suggest` endpoints remain compatible for older clients and homepage categories.

Each selected provider contributes up to 12 books per page. Results interleave
providers and merge exact normalized titles with matching author surnames,
preferentially retaining the Gutenberg reading copy. This is a discovery heuristic,
not an ISBN-level edition merge; separate pages may contain editions of the same
work because provider rankings differ. No total result count is claimed.
Gutendex's native 32-book pages are sliced across boundaries without skipping books.

## Reading and metadata

- Google Books continues using the `free-ebooks` filter and existing volume IDs.
- Gutendex provides Project Gutenberg metadata and source reading links, plus
  Gutenberg-hosted EPUB links where available. IDs use `pg<id>`, compatible with
  the existing recommendation catalog. Public-domain status is edition-specific
  and US-based; copyrighted free editions are not labeled public domain.
- Open Library works use `ol-OL<id>W`. Records are labeled catalog listings unless
  `ebook_access=public` or `public_scan_b=true` signals a free edition. Links say
  “View editions”; a work listing is never treated as an unconditional download.
  Free-only queries also request `ebook_access:public` and verify the flags.

Saved-book storage accepts these IDs without a schema migration. Reading links
persist in the existing saved-book fields. Source labels are inferred from saved
links; Open Library saved records conservatively display “Catalog listing” because
edition availability is not persisted. More like this resolves new Gutenberg IDs
through Gutendex and Open Library works through its Works API. Recommendations
still select from the curated 40-book catalog; search expansion is not a new ML model.

## Provider protection and operation

Requests use fixed provider endpoints, 7-second HTTP timeouts, a 2 MiB response cap,
a bounded 300-entry / 15-minute metadata cache, and shared in-flight requests.
Failed responses are not cached. Open Library requests are serialized, with at
least 1.1 seconds between starts and a bounded queue. A public application User-Agent
identifies the repo; the conservative unidentified limit is used. No bulk harvesting,
account identity, authentication token, or private reading history is sent.

One unavailable provider does not block successful providers; its status is shown
in the search UI. If all providers fail, the endpoint returns 503. Upstream URLs
in paginated responses are never followed. EPUB and cover links from Gutendex are
restricted to Gutenberg hosts. Only public metadata and format URLs are fetched;
book files are not imported, proxied, or stored.

Gutendex recommends self-hosting for long-term use. `GUTENDEX_BASE_URL` can point
to your own trusted instance (default `https://gutendex.com`). This change does not
provision a new service or introduce API keys for the new providers. Open Library
requests are cached and intended for user-driven lookup. Review provider guidance
before increasing traffic or ingesting a larger local dataset.

Sources: https://gutendex.com/ ; https://openlibrary.org/developers/api ;
https://openlibrary.org/dev/docs/api/search

Validation: `npm test` (37 tests), real Open Library searches, and browser checks
in the local preview. Gutendex's public API timed out during live checks; its adapter
and format links were tested with fixtures. The production database is not used
for fixture tests.
