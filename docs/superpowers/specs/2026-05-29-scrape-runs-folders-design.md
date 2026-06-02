# Scrape Runs Folders Design

Date: 2026-05-29

## Goal

Scraping results must no longer be mixed together in Labs. Every scrape action creates a separate history folder so a user can distinguish runs such as "coffee shop" and "laundry" even when both target the same source. Folders can be renamed and deleted.

This applies to all scraping sources: Google Maps, Shopee, and Tokopedia.

## Decisions

- Use a new Supabase table, `scrape_runs`, as the folder/history entity.
- Every click on scrape creates a new `scrape_runs` row, even if source and keyword match an older run.
- Folder title format defaults to `YYYY-MM-DD - <keyword> - <source label>`.
- Location is not required in the folder title or metadata.
- Marketplace source location is not stored; source and keyword are enough.
- Existing old scraped data will be deleted during the database reset/migration process.
- Deleting a folder deletes all `places` and `products` rows inside that folder.
- Failed scrape attempts remain visible as folders with status `failed`.

## Database Design

Add a new table:

```sql
create table scrape_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('gmaps', 'shopee', 'tokopedia')),
  keyword text not null,
  title text not null,
  status text not null check (status in ('running', 'success', 'failed')),
  row_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Add folder references:

```sql
alter table places
  add column scrape_run_id uuid references scrape_runs(id) on delete cascade;

alter table products
  add column scrape_run_id uuid references scrape_runs(id) on delete cascade;
```

RLS should keep the same user isolation model: users can only select, update, and delete their own `scrape_runs`, and row access for `places` / `products` remains scoped to `user_id`.

Because old mixed data should be removed, the migration/setup must include an explicit destructive reset step:

```sql
truncate table places, products restart identity cascade;
```

After the reset, new saved rows should always include `scrape_run_id`.

## Scraping Flow

When a scrape starts:

1. The extension determines `source` and `keyword`.
2. The extension creates a `scrape_runs` row with status `running`.
3. The scraper runs normally.
4. Results are inserted into `places` or `products` with the new `scrape_run_id`.
5. On success, the extension updates the run to `success` and stores `row_count`.
6. On failure, the extension updates the run to `failed` and stores `error_message`.

Google Maps Classic already has an explicit keyword in the popup. Shopee and Tokopedia should derive the keyword from the current search page when possible. If the keyword cannot be detected, use `Untitled scrape`.

## Labs UX

Labs should open to a folder/history list instead of rendering all scraped rows immediately.

Each folder row shows:

- title
- source label
- created date/time
- status
- row count

Clicking a folder opens its detail view:

- `gmaps` folders show `AreaAnalysis` and `PlaceTable`.
- `shopee` and `tokopedia` folders show `ProductTable`.
- Failed folders show the saved error message.
- Successful folders with zero rows show an empty state.

Folder actions:

- Rename updates `scrape_runs.title`.
- Delete asks for confirmation, then deletes the `scrape_runs` row; database cascade deletes child rows.
- Back returns to the folder/history list.

Labs should stop using global `fetchPlaces()` and `fetchProducts()` as its primary display path. It should load runs first, then fetch rows by selected `scrape_run_id`.

## Shared API Changes

Add shared types for:

- `ScrapeSource`
- `ScrapeRun`
- `ScrapeRunStatus`
- `ScrapeRunSummary`

Add Supabase helpers for:

- `createScrapeRun`
- `completeScrapeRun`
- `failScrapeRun`
- `fetchScrapeRuns`
- `fetchPlacesByRun`
- `fetchProductsByRun`
- `renameScrapeRun`
- `deleteScrapeRun`

Existing `fetchPlacesBySession` can be replaced or kept temporarily for backwards compatibility, but Labs should move to run-based queries.

## Error Handling

- If run creation fails, scraping should not continue because results would become unfiled.
- If scraping fails, keep the run with status `failed`.
- If inserting scraped rows fails, mark the run as `failed`.
- If final run status update fails after rows are inserted, Labs may show a stale `running` state; this should be surfaced as an error state or recoverable status in a later improvement.
- Rename failures leave the old title unchanged.
- Delete failures leave the folder visible.

## Testing

Manual verification should cover:

- Google Maps scrape creates a new folder.
- Shopee scrape creates a new folder.
- Tokopedia scrape creates a new folder.
- Two scrapes with different keywords do not mix rows.
- Two scrapes with the same keyword still create separate folders.
- Opening a folder shows only rows from that `scrape_run_id`.
- Rename updates the folder title without changing child rows.
- Delete removes the folder and its child rows.
- Labs empty state appears after old data is cleared.
- Failed scrapes appear in Labs with their error message.

## Out Of Scope

- Reverse geocoding or storing human-readable locations.
- Recovering deleted folders.
- Merging multiple scrape runs into one folder.
- Comparing two folders side by side.
- Migrating old mixed data into folders.
