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

export type { SupabaseClient };
