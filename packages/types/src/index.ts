// Shared data shapes used across scrapers, content scripts, background, and web.

export type Source = 'gmaps' | 'shopee' | 'tokopedia';

/** A scrape source as persisted to `scrape_runs.source`. Alias of Source. */
export type ScrapeSource = Source;

export type ScrapeRunStatus = 'running' | 'success' | 'failed';

/** A `scrape_runs` row — one folder per scrape attempt. */
export interface ScrapeRun {
  id: string;
  user_id: string;
  source: ScrapeSource;
  keyword: string;
  title: string;
  status: ScrapeRunStatus;
  row_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/** Lightweight projection used by Labs folder list. */
export interface ScrapeRunSummary {
  id: string;
  source: ScrapeSource;
  keyword: string;
  title: string;
  status: ScrapeRunStatus;
  row_count: number;
  created_at: string;
}

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
  // Deep fields scraped from the detail panel (best-effort, often null).
  price_level?: string | null; // e.g. "Rp26.000–50.000"
  phone?: string | null;
  website?: string | null;
  plus_code?: string | null;
  hours?: Record<string, string> | null; // day -> "09:00–22:00"
  service_options?: string[] | null; // dine-in / takeaway / delivery
  rating_breakdown?: number[] | null; // [5★count, 4★, 3★, 2★, 1★]
  is_closed?: boolean | null; // permanently/temporarily closed
  photo_count?: number | null;
  // Area-scrape metadata. Populated when scraped via radius-area flow;
  // null for legacy keyword-only scrapes from apps/extension.
  scrape_session_id?: string | null;
  area_center_lat?: number | null;
  area_center_lng?: number | null;
  area_radius_m?: number | null;
  keyword?: string | null;
  scrape_run_id?: string | null;
}

/** Parameters to start one area scrape session. */
export interface AreaScrapeParams {
  businessQuery: string;
  locationQuery: string;
  maxResults: number;
  scrollDelayMs: number;
  geofence?: {
    enabled: boolean;
    provinsi: string;
    kabupaten: string;
    kecamatan: string;
  };
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
  scrape_run_id?: string | null;
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
  /** Search keyword detected on the page; used as the folder title hint. */
  keyword?: string | null;
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
  sessionId?: string;
}

/** Popup -> background: start a radius-area scrape session. */
export interface StartAreaScrape {
  type: 'START_AREA_SCRAPE';
  params: AreaScrapeParams;
}

/** Background -> content (in the spawned gmaps tab): run the scrape kernel. */
export interface RunAreaScrape {
  type: 'RUN_AREA_SCRAPE';
  params: AreaScrapeParams;
  sessionId: string;
}

/** Content -> background: scraped rows of a session. */
export interface AreaScrapeResult {
  type: 'AREA_SCRAPE_RESULT';
  sessionId: string;
  places: Place[];
}
