-- NOTE: see 0000_flat_ben_parker.sql for why `drizzle-kit migrate` will never
-- reach this file against the real database (it fails at 0000 on the
-- pre-existing `files`/`snippets` tables). Use `npx drizzle-kit push` instead
-- to apply the full intended schema (including this index) directly.

CREATE INDEX "files_user_id_idx" ON "files" USING btree ("user_id");