-- Scrape runs / folders migration.
-- Run this AFTER the base schema.sql. Destructive: wipes old places/products
-- because pre-existing rows have no scrape_run_id and would orphan in Labs.

-- 1. Folder table.
create table if not exists scrape_runs (
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

create index if not exists scrape_runs_user_id_created_at_idx
  on scrape_runs (user_id, created_at desc);

alter table scrape_runs enable row level security;

drop policy if exists "scrape_runs owner select" on scrape_runs;
create policy "scrape_runs owner select" on scrape_runs
  for select using (auth.uid() = user_id);

drop policy if exists "scrape_runs owner insert" on scrape_runs;
create policy "scrape_runs owner insert" on scrape_runs
  for insert with check (auth.uid() = user_id);

drop policy if exists "scrape_runs owner update" on scrape_runs;
create policy "scrape_runs owner update" on scrape_runs
  for update using (auth.uid() = user_id);

drop policy if exists "scrape_runs owner delete" on scrape_runs;
create policy "scrape_runs owner delete" on scrape_runs
  for delete using (auth.uid() = user_id);

-- 2. Folder references on existing tables.
alter table places
  add column if not exists scrape_run_id uuid references scrape_runs(id) on delete cascade;

alter table products
  add column if not exists scrape_run_id uuid references scrape_runs(id) on delete cascade;

create index if not exists places_scrape_run_id_idx on places (scrape_run_id);
create index if not exists products_scrape_run_id_idx on products (scrape_run_id);

-- 3. Reset old mixed data (spec: existing rows are dropped during this migration).
truncate table places, products restart identity cascade;

-- 4. Force PostgREST to reload its schema cache so the new table/columns are
-- immediately visible to the extension and Labs (otherwise the first insert
-- fails with "Could not find the table 'public.scrape_runs'").
notify pgrst, 'reload schema';
