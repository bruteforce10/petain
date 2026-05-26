import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ProductRow, PlaceRow } from '@terramap/types';

/** Minimal async storage shape Supabase's auth uses. */
export interface AuthStorage {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
}

export interface TerramapClientOptions {
  url: string;
  anonKey: string;
  /**
   * Custom auth storage. Extension passes a chrome.storage.local adapter
   * (service worker has no localStorage); web omits it to use the default.
   */
  storage?: AuthStorage;
  /** Parse `?access_token` from URL. False for extension, true for web OAuth. */
  detectSessionInUrl?: boolean;
}

export function createTerramapClient(opts: TerramapClientOptions): SupabaseClient {
  const { url, anonKey, storage, detectSessionInUrl = false } = opts;
  if (!url || !anonKey) {
    console.warn('[terramap] Supabase url / anon key not set.');
  }
  return createClient(url, anonKey, {
    auth: {
      ...(storage ? { storage } : {}),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl,
    },
  });
}

/** Fetch saved products for the current user (RLS scopes to the user). */
export async function fetchProducts(
  client: SupabaseClient,
  opts: { limit?: number } = {},
): Promise<ProductRow[]> {
  const { limit = 500 } = opts;
  const { data, error } = await client
    .from('products')
    .select('*')
    .order('scraped_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ProductRow[];
}

/** Fetch saved places for the current user. */
export async function fetchPlaces(
  client: SupabaseClient,
  opts: { limit?: number } = {},
): Promise<PlaceRow[]> {
  const { limit = 500 } = opts;
  const { data, error } = await client
    .from('places')
    .select('*')
    .order('scraped_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PlaceRow[];
}

/** Fetch all places belonging to a single area-scrape session. */
export async function fetchPlacesBySession(
  client: SupabaseClient,
  sessionId: string,
): Promise<PlaceRow[]> {
  const { data, error } = await client
    .from('places')
    .select('*')
    .eq('scrape_session_id', sessionId)
    .order('rating', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as PlaceRow[];
}

export interface SessionSummary {
  scrape_session_id: string;
  keyword: string | null;
  area_center_lat: number | null;
  area_center_lng: number | null;
  area_radius_m: number | null;
  count: number;
  latest_scraped_at: string;
}

/** List distinct area-scrape sessions with row counts (for dashboard filter). */
export async function fetchSessions(
  client: SupabaseClient,
  opts: { limit?: number } = {},
): Promise<SessionSummary[]> {
  const { limit = 50 } = opts;
  const { data, error } = await client
    .from('places')
    .select('scrape_session_id, keyword, area_center_lat, area_center_lng, area_radius_m, scraped_at')
    .not('scrape_session_id', 'is', null)
    .order('scraped_at', { ascending: false })
    .limit(2000);
  if (error) throw error;

  const groups = new Map<string, SessionSummary>();
  for (const row of (data ?? []) as Array<{
    scrape_session_id: string;
    keyword: string | null;
    area_center_lat: number | null;
    area_center_lng: number | null;
    area_radius_m: number | null;
    scraped_at: string;
  }>) {
    const id = row.scrape_session_id;
    const existing = groups.get(id);
    if (!existing) {
      groups.set(id, {
        scrape_session_id: id,
        keyword: row.keyword,
        area_center_lat: row.area_center_lat,
        area_center_lng: row.area_center_lng,
        area_radius_m: row.area_radius_m,
        count: 1,
        latest_scraped_at: row.scraped_at,
      });
    } else {
      existing.count++;
      if (row.scraped_at > existing.latest_scraped_at) existing.latest_scraped_at = row.scraped_at;
    }
  }
  return Array.from(groups.values()).slice(0, limit);
}

export type { SupabaseClient };
