// Shared data shapes used across scrapers, content scripts, background, and web.

export type Source = 'gmaps' | 'shopee' | 'tokopedia';

/** A place scraped from Google Maps (insert into `places`). */
export interface Place {
  name: string;
  address?: string | null;
  category?: string | null;
  rating?: number | null;
  review_count?: number | null;
  lat?: number | null;
  lng?: number | null;
  maps_url?: string | null;
}

/** A product scraped from Shopee/Tokopedia (insert into `products`). */
export interface Product {
  source: 'shopee' | 'tokopedia';
  name: string;
  price?: number | null;
  rating?: number | null;
  sold_count?: number | null;
  seller?: string | null;
  product_url?: string | null;
  image_url?: string | null;
}

/** Columns added by the DB on insert (see supabase/schema.sql). */
export interface DbColumns {
  id: number;
  user_id: string;
  scraped_at: string;
}

/** A `products` row as returned by `select(*)`. */
export type ProductRow = Product & DbColumns;

/** A `places` row as returned by `select(*)`. */
export type PlaceRow = Place & DbColumns;

/** Messages: content script -> background. */
export interface ScrapeResult {
  type: 'SCRAPE_RESULT';
  source: Source;
  places?: Place[];
  products?: Product[];
}

/** Messages: popup -> content script. */
export interface StartScrape {
  type: 'START_SCRAPE';
}

/** Messages: background -> popup (status). */
export interface SaveStatus {
  type: 'SAVE_STATUS';
  ok: boolean;
  inserted: number;
  error?: string;
}
