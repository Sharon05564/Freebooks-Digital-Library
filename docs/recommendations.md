# FreeBooks recommendations

The initial recommender is a content-based TF-IDF model, not a generative chatbot or a pretrained neural embedding service. It runs in the existing Node process and does not need a paid AI API, an external model server, or a vector database extension.

## Collection and provenance

`data/recommendation-catalog.json` contains 40 selected Project Gutenberg classics. IDs, source titles, and creator names were checked against Project Gutenberg's official `pg_catalog.csv` machine-readable catalog; the Great Gatsby record was checked against ebook 64317. Project Gutenberg grants its catalog metadata to the public domain. The descriptions and thematic tags in this repository were written for FreeBooks. The app links to the source ebooks rather than importing book text. Public-domain status in this collection refers to the USA; source pages provide availability and copyright details.

Sources:

- https://www.gutenberg.org/ebooks/offline_catalogs.html
- https://www.gutenberg.org/policy/robot_access.html
- https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv
- https://www.gutenberg.org/ebooks/64317

Recommendations only search this collection. Google Books search still searches Google's catalog. A Google Books result can be used as a recommendation seed: the server looks up its public metadata transiently, with a six-second timeout and a bounded 15-minute cache. No reader identity is sent with that lookup. If a lookup fails, personal picks can fall back to saved titles/authors; explicit More like this requests show a retryable error.

## Model

The model extracts case-folded word tokens, removes stop words, and builds a vocabulary and inverse document frequencies from the collection. Title and author fields are weighted by repetition. Term frequency uses `1 + log(count)`, smoothed inverse document frequency uses `log((N + 1) / (df + 1)) + 1`, and vectors are normalized before cosine scoring.

Up to 12 recent saved books form a reading profile. Genre preferences and positive feedback add signals; negative feedback downweights related features and excludes the rejected title. A seed book is weighted more strongly for More like this. Saved works and the seed itself are excluded across recognized editions, and maximal marginal relevance plus author/genre penalties add variety. Explanations are deterministic statements of shared catalog themes, genres, or authors, rather than generated claims about unread text.

Known limits: this is a small, English-language classics catalog; vocabulary matching is lexical, not neural semantic understanding. Missing descriptions, ambiguous editions, and unknown vocabulary reduce personalization. The model does not infer private traits or use browsing/click history. A larger collection and real reader feedback are needed to judge recommendation quality beyond diagnostic examples.

## Storage and endpoints

The additive `recommendation_preferences` and `recommendation_feedback` tables are registered before Sequelize's production `sync()`. Existing tables are not altered. Preferences are keyed by authenticated user ID; feedback uses `(userId, bookId)` as its primary key. Both reference `Users` with cascading deletion. Saved books remain in the existing table.

- `GET /api/recommendations?seed=pg84&limit=8` is available to guests. An optional Bearer token adds that account's saved books, preferences, and feedback. `genres=romance,mystery` can supply temporary interests.
- `PUT /api/recommendation-preferences` saves `{genres: [...]}` for the authenticated account.
- `POST /api/recommendation-feedback` saves `{bookId, value}` with `1` for Interested, `-1` for Not for me, and `0` to undo.
- `DELETE /api/recommendation-preferences` atomically resets genre preferences and feedback for that account. It does not delete saved books.

Guests' genre choices remain in browser local storage. Signed-in preferences persist in Postgres. No request body can select another user's account. Responses containing personal recommendations use `Cache-Control: no-store`.

## Verification

Run `npm test` for relevance, exclusion, cold start, feedback/reset, authentication, invalid-input, account-isolation, and existing OAuth tests. Database models are injected with isolated stores in route tests; deployment additionally verifies table creation and live guest endpoints.

Run `npm run evaluate:recommendations` for eight small, hand-labeled topical retrieval examples and discovery diversity. Compare Hit Rate@3 to an unpersonalized fixed first-three baseline. This is a reproducible diagnostic, not a held-out benchmark, user study, or evidence of production uplift. Extend it with independently labeled reader requests before drawing broader conclusions.
