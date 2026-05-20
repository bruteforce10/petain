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
  scraped_at timestamptz default now()
);

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
