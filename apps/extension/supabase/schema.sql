-- Run in Supabase SQL Editor (or `supabase db push`).
-- Creates tables + row-level security so each user only sees their own data.

-- Places scraped from Google Maps.
create table if not exists places (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users not null,
  name text not null,
  address text,
  category text,
  rating numeric,
  review_count int,
  lat double precision,
  lng double precision,
  maps_url text,
  price_level text,
  phone text,
  website text,
  plus_code text,
  hours jsonb,
  service_options text[],
  rating_breakdown int[],
  is_closed boolean,
  photo_count int,
  scrape_session_id uuid,
  area_center_lat double precision,
  area_center_lng double precision,
  area_radius_m int,
  keyword text,
  scraped_at timestamptz default now()
);

-- Migrate existing deployments: add deep-scrape columns if the table predates them.
alter table places add column if not exists price_level text;
alter table places add column if not exists phone text;
alter table places add column if not exists website text;
alter table places add column if not exists plus_code text;
alter table places add column if not exists hours jsonb;
alter table places add column if not exists service_options text[];
alter table places add column if not exists rating_breakdown int[];
alter table places add column if not exists is_closed boolean;
alter table places add column if not exists photo_count int;

-- Area-scrape metadata: groups rows from one radius-scrape session.
alter table places add column if not exists scrape_session_id uuid;
alter table places add column if not exists area_center_lat double precision;
alter table places add column if not exists area_center_lng double precision;
alter table places add column if not exists area_radius_m int;
alter table places add column if not exists keyword text;

create index if not exists places_session_idx on places (user_id, scrape_session_id);

-- Products scraped from Shopee / Tokopedia.
create table if not exists products (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users not null,
  source text not null check (source in ('shopee', 'tokopedia')),
  name text not null,
  price numeric,
  rating numeric,
  sold_count int,
  seller text,
  product_url text,
  image_url text,
  scraped_at timestamptz default now()
);

-- RLS: a user can only read/write rows they own.
alter table places enable row level security;
alter table products enable row level security;

create policy "own places" on places
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own products" on products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
