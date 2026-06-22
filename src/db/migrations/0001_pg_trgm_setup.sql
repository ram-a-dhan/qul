-- Run via: pnpm drizzle-kit generate --custom --name=pg_trgm_setup
-- Then:    pnpm drizzle-kit migrate

-- pg_trgm is a Postgres built-in extension — no install needed, just enable it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on text_normalized (the diacritic-stripped column),
-- not on text. The ASR output gets normalized the same way before querying,
-- so both sides of the similarity() call are diacritic-free and comparable.
CREATE INDEX verses_text_trgm_idx ON verses USING gin (text_normalized gin_trgm_ops);
