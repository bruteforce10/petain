-- AI market summary cache.
-- Run this AFTER scrape_runs.sql. Adds a per-folder cache for the Gemini-backed
-- market analysis so the dashboard only calls the AI once per run (free-tier
-- quota / latency), and the result persists across reloads.
--
-- Non-destructive: only adds nullable columns. Existing rows get NULL (no
-- summary yet) and the dashboard shows a "Generate" button for them.

alter table scrape_runs
  add column if not exists ai_summary jsonb,
  add column if not exists ai_summary_generated_at timestamptz;

-- The existing "scrape_runs owner update" policy already lets a user write these
-- columns on their own rows, so no new RLS policy is needed.

-- Force PostgREST to reload its schema cache so the new columns are immediately
-- selectable/updatable from the web app.
notify pgrst, 'reload schema';
