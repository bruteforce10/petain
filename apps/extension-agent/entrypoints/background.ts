import { supabase } from '@/lib/supabase';
import { buildGmapsSearchUrl, pickZoomForRadius, nextSessionId } from '@terramap/area';
import {
  createAgentClient,
  runAgent,
  type AgentEvent,
  type ToolExecutor,
  Anthropic,
} from '@terramap/agent';
import type {
  AgentChatStart,
  AgentStreamEvent,
  AreaScrapeResult,
  RunAreaScrape,
} from '@/lib/types';

// Per-popup chat history kept in-memory across turns. Service worker may be
// recycled at any time; if so, history is reset (acceptable for MVP).
let history: Anthropic.MessageParam[] = [];

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((msg: AgentChatStart, _sender, sendResponse) => {
    if (msg?.type !== 'AGENT_CHAT_START') return;
    handleChat(msg.message)
      .catch((e) => emit({ kind: 'error', error: e?.message ?? String(e) }))
      .finally(() => emit({ kind: 'done' }));
    sendResponse({ ok: true });
    return false;
  });
});

function emit(event: AgentStreamEvent['event']): void {
  const msg: AgentStreamEvent = { type: 'AGENT_STREAM_EVENT', event };
  // Popup may be closed; ignore "no receiving end" errors.
  chrome.runtime.sendMessage(msg).catch(() => {});
}

async function handleChat(userMessage: string): Promise<void> {
  const { anthropic_api_key } = await chrome.storage.local.get('anthropic_api_key');
  const apiKey = (anthropic_api_key as string | undefined) ?? (import.meta.env.WXT_ANTHROPIC_API_KEY as string | undefined);
  if (!apiKey) {
    emit({ kind: 'error', error: 'No Anthropic API key set. Open the popup, click "api key", and paste one.' });
    return;
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    emit({ kind: 'error', error: 'Not logged in to Supabase' });
    return;
  }
  const userId = userData.user.id;

  const client = createAgentClient({ apiKey });

  const executeTool: ToolExecutor = async (name, input) => {
    try {
      switch (name) {
        case 'scrape_area':
          return await execScrapeArea(input, userId);
        case 'query_places':
          return await execQueryPlaces(input);
        case 'analyze_session':
          return await execAnalyzeSession(input);
        default:
          return { ok: false, error: `Unknown tool: ${name}` };
      }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  };

  const gen = runAgent({
    client,
    userMessage,
    history,
    executeTool,
    model: 'claude-sonnet-4-6',
  });

  let finalHistory: Anthropic.MessageParam[] = history;
  while (true) {
    const next = await gen.next();
    if (next.done) {
      finalHistory = next.value;
      break;
    }
    forwardEvent(next.value);
  }
  history = finalHistory;
}

function forwardEvent(ev: AgentEvent): void {
  if (ev.type === 'text_delta') {
    emit({ kind: 'text_delta', text: ev.text });
  } else if (ev.type === 'tool_use') {
    emit({ kind: 'tool_use', name: ev.name, input: ev.input });
  } else if (ev.type === 'tool_result') {
    emit({
      kind: 'tool_result',
      name: ev.name,
      ok: ev.result.ok,
      summary: ev.result.ok ? summarize(ev.name, ev.result.data) : ev.result.error,
    });
  } else if (ev.type === 'turn_end') {
    emit({ kind: 'turn_end' });
  } else if (ev.type === 'error') {
    emit({ kind: 'error', error: ev.error });
  }
}

function summarize(name: string, data: unknown): string {
  if (name === 'scrape_area' && data && typeof data === 'object') {
    const d = data as { session_id?: string; inserted?: number };
    return `${d.inserted ?? 0} POI saved (${d.session_id?.slice(0, 8)}…)`;
  }
  if (name === 'analyze_session' && data && typeof data === 'object') {
    const d = data as { count?: number; avg_rating?: number };
    return `n=${d.count}, avg=${(d.avg_rating ?? 0).toFixed(2)}`;
  }
  if (name === 'query_places' && Array.isArray(data)) {
    return `${data.length} rows`;
  }
  return 'ok';
}

/* ─── Tool implementations ────────────────────────────────────────────── */

async function execScrapeArea(
  input: Record<string, unknown>,
  userId: string,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const keyword = String(input.keyword ?? '').trim();
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  const radiusM = Math.round(Number(input.radius_m));
  if (!keyword || !Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radiusM)) {
    return { ok: false, error: 'scrape_area: missing/invalid keyword|lat|lng|radius_m' };
  }
  if (radiusM < 250 || radiusM > 5000) {
    return { ok: false, error: `scrape_area: radius_m must be 250..5000 (got ${radiusM})` };
  }

  const sessionId = nextSessionId();
  const url = buildGmapsSearchUrl({
    keyword,
    lat,
    lng,
    zoom: pickZoomForRadius(radiusM),
  });

  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.create({ url, active: false });
  } catch (e: any) {
    return { ok: false, error: `tab open failed: ${e?.message ?? e}` };
  }
  const tabId = tab.id!;

  try {
    await waitForTabComplete(tabId, 25_000);
    const runMsg: RunAreaScrape = {
      type: 'RUN_AREA_SCRAPE',
      params: { keyword, lat, lng, radiusM },
      sessionId,
    };
    const result = (await sendWithRetry(tabId, runMsg, 6, 1000)) as AreaScrapeResult | undefined;
    if (!result || result.type !== 'AREA_SCRAPE_RESULT') {
      return { ok: false, error: 'content script returned no result' };
    }
    if (!result.places.length) {
      return { ok: true, data: { session_id: sessionId, inserted: 0, note: 'no POIs in radius' } };
    }
    const rows = result.places.map((p) => ({ ...p, user_id: userId }));
    const { error } = await supabase.from('places').insert(rows);
    if (error) throw error;
    return { ok: true, data: { session_id: sessionId, inserted: rows.length } };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

async function execQueryPlaces(
  input: Record<string, unknown>,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const sessionId = String(input.session_id ?? '');
  const limit = Math.min(50, Math.max(1, Number(input.limit ?? 10)));
  if (!sessionId) return { ok: false, error: 'query_places: missing session_id' };

  const { data, error } = await supabase
    .from('places')
    .select('name, category, address, rating, review_count, phone, website, price_level, is_closed')
    .eq('scrape_session_id', sessionId)
    .order('rating', { ascending: false, nullsFirst: false })
    .order('review_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

async function execAnalyzeSession(
  input: Record<string, unknown>,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const sessionId = String(input.session_id ?? '');
  if (!sessionId) return { ok: false, error: 'analyze_session: missing session_id' };

  const { data, error } = await supabase
    .from('places')
    .select('name, category, rating, review_count, is_closed, price_level')
    .eq('scrape_session_id', sessionId);
  if (error) return { ok: false, error: error.message };

  const rows = data ?? [];
  if (!rows.length) return { ok: true, data: { count: 0 } };

  const ratings = rows.map((r) => r.rating).filter((v): v is number => typeof v === 'number');
  const reviews = rows.map((r) => r.review_count).filter((v): v is number => typeof v === 'number');
  const closed = rows.filter((r) => r.is_closed === true).length;

  const catMap = new Map<string, { count: number; ratingSum: number; ratingN: number }>();
  for (const r of rows) {
    const c = r.category ?? 'Uncategorized';
    const e = catMap.get(c) ?? { count: 0, ratingSum: 0, ratingN: 0 };
    e.count++;
    if (typeof r.rating === 'number') {
      e.ratingSum += r.rating;
      e.ratingN++;
    }
    catMap.set(c, e);
  }
  const top_categories = Array.from(catMap.entries())
    .map(([category, v]) => ({
      category,
      count: v.count,
      avg_rating: v.ratingN ? Number((v.ratingSum / v.ratingN).toFixed(2)) : null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const priceMap = new Map<string, number>();
  for (const r of rows) {
    const p = r.price_level ?? null;
    if (!p) continue;
    priceMap.set(p, (priceMap.get(p) ?? 0) + 1);
  }

  return {
    ok: true,
    data: {
      count: rows.length,
      avg_rating: ratings.length
        ? Number((ratings.reduce((s, v) => s + v, 0) / ratings.length).toFixed(2))
        : null,
      total_reviews: reviews.reduce((s, v) => s + v, 0),
      percent_closed: rows.length ? Number(((closed / rows.length) * 100).toFixed(1)) : 0,
      top_categories,
      price_level_distribution: Object.fromEntries(priceMap),
    },
  };
}

/* ─── Tab + messaging helpers (same as extension-classic) ────────────── */

function waitForTabComplete(tabId: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Timeout waiting for tab to load'));
    }, timeoutMs);
    const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function sendWithRetry(
  tabId: number,
  msg: unknown,
  attempts: number,
  delayMs: number,
): Promise<unknown> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await chrome.tabs.sendMessage(tabId, msg);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}
