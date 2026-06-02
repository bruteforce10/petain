import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  ProductRow,
  PlaceRow,
  ScrapeRun,
  ScrapeRunStatus,
  ScrapeRunSummary,
  ScrapeSource,
} from '@terramap/types';

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

const SOURCE_LABELS: Record<ScrapeSource, string> = {
  gmaps: 'Google Maps',
  shopee: 'Shopee',
  tokopedia: 'Tokopedia',
};

function todayIso(): string {
  // YYYY-MM-DD in local time — matches "today" the way the user thinks.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Default folder title: `YYYY-MM-DD - <keyword> - <source label>`. */
export function buildScrapeRunTitle(source: ScrapeSource, keyword: string): string {
  return `${todayIso()} - ${keyword} - ${SOURCE_LABELS[source]}`;
}

export interface CreateScrapeRunInput {
  source: ScrapeSource;
  keyword: string;
  title?: string;
}

/** Create a `running` scrape run row and return it. */
export async function createScrapeRun(
  client: SupabaseClient,
  input: CreateScrapeRunInput,
): Promise<ScrapeRun> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || !userData.user) throw new Error('Not logged in');
  const keyword = input.keyword.trim() || 'Untitled scrape';
  const title = input.title?.trim() || buildScrapeRunTitle(input.source, keyword);
  const { data, error } = await client
    .from('scrape_runs')
    .insert({
      user_id: userData.user.id,
      source: input.source,
      keyword,
      title,
      status: 'running' satisfies ScrapeRunStatus,
      row_count: 0,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ScrapeRun;
}

/** Mark a run as success and store its final row count. */
export async function completeScrapeRun(
  client: SupabaseClient,
  runId: string,
  rowCount: number,
): Promise<void> {
  const { error } = await client
    .from('scrape_runs')
    .update({
      status: 'success' satisfies ScrapeRunStatus,
      row_count: rowCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId);
  if (error) throw error;
}

/** Mark a run as failed and store the error message. */
export async function failScrapeRun(
  client: SupabaseClient,
  runId: string,
  errorMessage: string,
): Promise<void> {
  const { error } = await client
    .from('scrape_runs')
    .update({
      status: 'failed' satisfies ScrapeRunStatus,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId);
  if (error) throw error;
}

/** List the current user's scrape runs, newest first. */
export async function fetchScrapeRuns(
  client: SupabaseClient,
  opts: { limit?: number } = {},
): Promise<ScrapeRunSummary[]> {
  const { limit = 200 } = opts;
  const { data, error } = await client
    .from('scrape_runs')
    .select('id, source, keyword, title, status, row_count, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ScrapeRunSummary[];
}

/** Fetch all places belonging to a single scrape run. */
export async function fetchPlacesByRun(
  client: SupabaseClient,
  runId: string,
): Promise<PlaceRow[]> {
  const { data, error } = await client
    .from('places')
    .select('*')
    .eq('scrape_run_id', runId)
    .order('rating', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as PlaceRow[];
}

/** Fetch all products belonging to a single scrape run. */
export async function fetchProductsByRun(
  client: SupabaseClient,
  runId: string,
): Promise<ProductRow[]> {
  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('scrape_run_id', runId)
    .order('scraped_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProductRow[];
}

/** Rename a scrape run (folder title). */
export async function renameScrapeRun(
  client: SupabaseClient,
  runId: string,
  title: string,
): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('Title cannot be empty');
  const { error } = await client
    .from('scrape_runs')
    .update({ title: trimmed, updated_at: new Date().toISOString() })
    .eq('id', runId);
  if (error) throw error;
}

/** Delete a scrape run; ON DELETE CASCADE removes child places/products. */
export async function deleteScrapeRun(
  client: SupabaseClient,
  runId: string,
): Promise<void> {
  const { error } = await client.from('scrape_runs').delete().eq('id', runId);
  if (error) throw error;
}

export type { SupabaseClient };
