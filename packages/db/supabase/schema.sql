-- Petain / TerraMap — full database schema for a brand new Supabase project.
-- Paste this whole file into the Supabase Dashboard SQL Editor and run it once.
-- Creates every table, index, and RLS policy the extension + web app need.
--
-- Supersedes scrape_runs.sql / ai_summary.sql for fresh projects (those two
-- files only exist to document how the schema evolved on the old project;
-- their changes are already folded into the tables below).

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------------
-- scrape_runs: one row per scrape "folder" (Labs / dashboard run history).
-- ------------------------------------------------------------------------
create table if not exists scrape_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('gmaps', 'shopee', 'tokopedia')),
  keyword text not null,
  title text not null,
  status text not null check (status in ('running', 'success', 'failed')),
  row_count integer not null default 0,
  error_message text,
  -- Cached Gemini market-analysis result for this run (see /api/ai-summary).
  ai_summary jsonb,
  ai_summary_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- In case scrape_runs already existed from an older/partial run without
-- these columns (create table if not exists above would have no-opped).
alter table scrape_runs add column if not exists ai_summary jsonb;
alter table scrape_runs add column if not exists ai_summary_generated_at timestamptz;

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

-- ------------------------------------------------------------------------
-- places: rows scraped from Google Maps (extension background.ts insert).
-- ------------------------------------------------------------------------
create table if not exists places (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  scrape_run_id uuid references scrape_runs(id) on delete cascade,
  name text not null,
  address text,
  category text,
  rating numeric,
  review_count integer,
  lat double precision,
  lng double precision,
  maps_url text,
  price_level text,
  phone text,
  website text,
  plus_code text,
  hours jsonb,
  service_options text[],
  rating_breakdown integer[],
  is_closed boolean,
  photo_count integer,
  scrape_session_id uuid,
  area_center_lat double precision,
  area_center_lng double precision,
  area_radius_m integer,
  keyword text,
  scraped_at timestamptz not null default now()
);

-- In case places already existed from an older/partial run without this
-- column (create table if not exists above would have no-opped).
alter table places add column if not exists scrape_run_id uuid references scrape_runs(id) on delete cascade;

create index if not exists places_user_id_scraped_at_idx
  on places (user_id, scraped_at desc);
create index if not exists places_scrape_run_id_idx on places (scrape_run_id);
create index if not exists places_scrape_session_id_idx on places (scrape_session_id);

alter table places enable row level security;

drop policy if exists "places owner select" on places;
create policy "places owner select" on places
  for select using (auth.uid() = user_id);

drop policy if exists "places owner insert" on places;
create policy "places owner insert" on places
  for insert with check (auth.uid() = user_id);

drop policy if exists "places owner update" on places;
create policy "places owner update" on places
  for update using (auth.uid() = user_id);

drop policy if exists "places owner delete" on places;
create policy "places owner delete" on places
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------------------
-- products: rows scraped from Shopee/Tokopedia.
-- ------------------------------------------------------------------------
create table if not exists products (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  scrape_run_id uuid references scrape_runs(id) on delete cascade,
  source text not null check (source in ('shopee', 'tokopedia')),
  name text not null,
  price numeric,
  rating numeric,
  sold_count integer,
  seller text,
  product_url text,
  image_url text,
  scraped_at timestamptz not null default now()
);

-- In case products already existed from an older/partial run without this
-- column (create table if not exists above would have no-opped).
alter table products add column if not exists scrape_run_id uuid references scrape_runs(id) on delete cascade;

create index if not exists products_user_id_scraped_at_idx
  on products (user_id, scraped_at desc);
create index if not exists products_scrape_run_id_idx on products (scrape_run_id);

alter table products enable row level security;

drop policy if exists "products owner select" on products;
create policy "products owner select" on products
  for select using (auth.uid() = user_id);

drop policy if exists "products owner insert" on products;
create policy "products owner insert" on products
  for insert with check (auth.uid() = user_id);

drop policy if exists "products owner update" on products;
create policy "products owner update" on products
  for update using (auth.uid() = user_id);

drop policy if exists "products owner delete" on products;
create policy "products owner delete" on products
  for delete using (auth.uid() = user_id);

-- Force PostgREST to reload its schema cache so every table above is
-- immediately visible to the extension and web app (otherwise the first
-- request fails with "Could not find the table 'public.x'").
notify pgrst, 'reload schema';
