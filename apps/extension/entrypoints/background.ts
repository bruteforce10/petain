import { supabase } from '@/lib/supabase';
import { nextSessionId } from '@terramap/area';
import {
  createScrapeRun,
  completeScrapeRun,
  failScrapeRun,
} from '@terramap/supabase';
import type {
  AreaScrapeResult,
  RunAreaScrape,
  SaveStatus,
  StartAreaScrape,
} from '@/lib/types';

/**
 * Background flow:
 *   popup → START_AREA_SCRAPE → background opens Maps tab → RUN_AREA_SCRAPE → content
 *   Content pushes AREA_SCRAPE_RESULT back via runtime.sendMessage (not sendResponse) —
 *   the open-channel pattern is unreliable for multi-minute scrapes in MV3 (port closes,
 *   SW idles out). A chrome.alarm heartbeat keeps the SW alive during the wait.
 */
const GMAPS_URL_RE = /^https?:\/\/(www\.)?google\.[^/]+\/maps(\/|$|\?)|^https?:\/\/maps\.google\.[^/]+\//;

// Persist scrape progress to chrome.storage.local. The popup closes whenever
// the user clicks away (e.g. to watch Maps scroll), so single-shot sendResponse
// status gets lost. Popup re-reads STATUS_KEY on mount and subscribes via
// chrome.storage.onChanged for live updates.
const STATUS_KEY = 'terramap.lastScrape';
type ScrapeState = 'running' | 'success' | 'error';
interface PersistedStatus {
  state: ScrapeState;
  step?: string;
  message: string;
  inserted?: number;
  sessionId?: string;
  runId?: string;
  hint?: string;
  timestamp: number;
}
async function setStatus(s: Omit<PersistedStatus, 'timestamp'>): Promise<void> {
  await chrome.storage.local
    .set({ [STATUS_KEY]: { ...s, timestamp: Date.now() } satisfies PersistedStatus })
    .catch(() => {});
}

/** Map raw scraper errors to a friendlier hint shown in the popup banner. */
function diagnose(err: string): string | undefined {
  const e = err.toLowerCase();
  if (e.includes('timeout waiting for area_scrape_result')) {
    return 'Scrape timeout. Buka popup lagi — extension akan auto-resume jika scrape masih berjalan. Jika tetap gagal, kurangi "Max hasil" atau pakai query yang lebih spesifik.';
  }
  if (e.includes('halaman detail maps terbuka tapi data tempat gagal dibaca')) {
    return 'Maps berhasil buka halaman tempat tapi struktur halamannya berubah. Selector Maps perlu diupdate — laporkan ke developer.';
  }
  if (e.includes('search input') && e.includes('not found')) {
    return 'Kotak pencarian Maps tidak muncul. Tunggu sebentar lalu coba scrape lagi (Maps mungkin masih loading).';
  }
  if (e.includes('neither results feed nor place detail')) {
    return 'Maps tidak merespon dalam 20 detik. Cek koneksi internet, atau coba query yang berbeda.';
  }
  if (e.includes('tidak ada yang cocok filter')) {
    return 'Filter kecamatan menolak semua hasil. Bisnis yang dicari mungkin ada di kecamatan lain — coba nonaktifkan filter atau ganti kecamatan.';
  }
  if (e.includes('maps menampilkan feed hasil pencarian tapi 0 tempat terbaca')) {
    return 'Selector Maps mungkin sudah berubah (Maps update DOM-nya). Laporkan ke developer untuk fix selector.';
  }
  if (e.includes('not logged in')) {
    return 'Sesi login habis. Klik "logout" lalu masuk lagi.';
  }
  if (e.includes('tab open')) {
    return 'Tidak bisa buka tab Google Maps. Cek apakah ada extension blocker atau popup blocker yang aktif.';
  }
  if (e.includes('could not create folder')) {
    return 'Database tidak bisa menyimpan folder scrape. Cek koneksi internet atau tunggu sebentar.';
  }
  return undefined;
}

export default defineBackground(() => {
  console.log('[terramap/bg] background script booted');

  // Alarm listener is a no-op; its only job is to wake the SW periodically so it
  // doesn't get terminated mid-scrape.
  chrome.alarms.onAlarm.addListener(() => {});

  chrome.runtime.onMessage.addListener((msg: StartAreaScrape, _sender, sendResponse) => {
    if (msg?.type !== 'START_AREA_SCRAPE') return;
    console.log('[terramap/bg] START_AREA_SCRAPE received');
    handleStart(msg).then((r) => {
      console.log('[terramap/bg] handleStart resolved:', r);
      sendResponse(r);
    });
    return true;
  });
});

async function handleStart(msg: StartAreaScrape): Promise<SaveStatus> {
  await setStatus({ state: 'running', step: 'auth', message: 'Memeriksa sesi login…' });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    const errMsg = 'Not logged in';
    await setStatus({ state: 'error', message: errMsg, hint: diagnose(errMsg) });
    return { type: 'SAVE_STATUS', ok: false, inserted: 0, error: errMsg };
  }
  const userId = userData.user.id;
  const sessionId = nextSessionId();
  const { businessQuery, locationQuery, maxResults, scrollDelayMs } = msg.params;
  const geofenceLocation = msg.params.geofence?.enabled
    ? [
        msg.params.geofence.kecamatan,
        msg.params.geofence.kabupaten,
        msg.params.geofence.provinsi,
      ]
        .map((term) => term.trim())
        .filter(Boolean)
        .join(' ')
    : '';
  const keyword = `${businessQuery} ${geofenceLocation || locationQuery}`.trim();
  // Coordinate URL avoids Maps' geolocation-based redirect + keeps the page in
  // a predictable "map only" state. Bare `/maps/` lets Maps interpret the next
  // search aggressively and redirect to `/maps/place/` (single POI) instead of
  // `/maps/search/` (feed). Jakarta is just a sane default — actual search
  // location comes from the typed query.
  const url = 'https://www.google.com/maps/@-6.2088,106.8456,12z';
  console.log('[terramap/bg] gmaps URL:', url, 'sessionId:', sessionId);

  // Spec: every scrape click creates a new scrape_runs row. If creation fails,
  // bail BEFORE scraping — otherwise results would be unfiled.
  await setStatus({ state: 'running', step: 'folder', message: 'Membuat folder scrape…', sessionId });
  let runId: string;
  try {
    const run = await createScrapeRun(supabase, {
      source: 'gmaps',
      keyword,
    });
    runId = run.id;
    console.log('[terramap/bg] scrape_run created:', runId);
  } catch (e: any) {
    console.log('[terramap/bg] createScrapeRun failed:', e);
    const errMsg = `Could not create folder: ${e?.message ?? e}`;
    await setStatus({ state: 'error', message: errMsg, hint: diagnose(errMsg), sessionId });
    return {
      type: 'SAVE_STATUS',
      ok: false,
      inserted: 0,
      error: errMsg,
    };
  }

  const alarmName = `scrape-${sessionId}`;
  await chrome.alarms.create(alarmName, { periodInMinutes: 0.4 });

  await setStatus({ state: 'running', step: 'tab', message: 'Membuka Google Maps…', sessionId });
  let tab: chrome.tabs.Tab;
  let needsLoad = false;
  try {
    const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (active?.id && active.url && GMAPS_URL_RE.test(active.url)) {
      tab = active;
      if (active.windowId !== undefined) {
        await chrome.windows.update(active.windowId, { focused: true }).catch(() => {});
      }
      console.log('[terramap/bg] active tab already gmaps, no nav, id:', tab.id);
    } else if (active?.id) {
      tab = await chrome.tabs.update(active.id, { url, active: true });
      if (active.windowId !== undefined) {
        await chrome.windows.update(active.windowId, { focused: true }).catch(() => {});
      }
      needsLoad = true;
      console.log('[terramap/bg] navigated active tab to gmaps, id:', tab.id);
    } else {
      tab = await chrome.tabs.create({ url, active: true });
      needsLoad = true;
      console.log('[terramap/bg] no active tab, created new, id:', tab.id);
    }
  } catch (e: any) {
    await chrome.alarms.clear(alarmName);
    const errMsg = `tab open: ${e?.message ?? e}`;
    await failScrapeRun(supabase, runId, errMsg).catch(() => {});
    await setStatus({ state: 'error', message: errMsg, hint: diagnose(errMsg), sessionId });
    return { type: 'SAVE_STATUS', ok: false, inserted: 0, error: errMsg };
  }
  const tabId = tab.id!;

  try {
    if (needsLoad) {
      await setStatus({ state: 'running', step: 'load', message: 'Menunggu Maps siap…', sessionId });
      await waitForTabComplete(tabId, 20_000);
      console.log('[terramap/bg] tab', tabId, 'reported complete');
    }

    const runMsg: RunAreaScrape = { type: 'RUN_AREA_SCRAPE', params: msg.params, sessionId };

    await setStatus({
      state: 'running',
      step: 'scrape',
      message: 'Scraping POI di Google Maps… (jangan tutup tab Maps)',
      sessionId,
    });

    // Register push listener BEFORE sending the run message to avoid race.
    const scrapeTimeoutMs = estimateScrapeTimeoutMs(maxResults, scrollDelayMs);
    const waiter = waitForResultPush(sessionId, scrapeTimeoutMs);

    try {
      await sendWithRetry(tabId, runMsg, 5, 800);
    } catch (e: any) {
      console.log('[terramap/bg] sendMessage to content failed:', e);
      // All retries failed → no content script in the tab, so it persisted no
      // resume state and a result push can never arrive. Fail fast instead of
      // pinning the SW (and the alarm heartbeat) for the full ~3–20 min timeout.
      waiter.cancel(new Error(`tab open: ${e?.message ?? e}`));
    }
    console.log('[terramap/bg] RUN_AREA_SCRAPE dispatched, waiting for push…');

    const result = await waiter.promise;
    console.log('[terramap/bg] received push:', {
      placeCount: result.places.length,
      error: (result as any).error,
    });

    const rows = result.places.map((p) => ({
      ...p,
      user_id: userId,
      scrape_run_id: runId,
    }));
    if (!rows.length) {
      const err = (result as any).error;
      const errMsg =
        err ??
        'Scrape selesai tapi 0 tempat terbaca. Kemungkinan: filter terlalu strict, query terlalu spesifik, atau Maps tidak menampilkan hasil. Buka tab Maps + DevTools console untuk detail.';
      await failScrapeRun(supabase, runId, errMsg).catch(() => {});
      await setStatus({ state: 'error', message: errMsg, hint: diagnose(errMsg), sessionId });
      return {
        type: 'SAVE_STATUS',
        ok: false,
        inserted: 0,
        error: errMsg,
        sessionId,
      };
    }
    await setStatus({
      state: 'running',
      step: 'save',
      message: `Menyimpan ${rows.length} POI ke database…`,
      sessionId,
    });
    console.log('[terramap/bg] inserting', rows.length, 'rows. sample:', rows[0]);
    const { error } = await supabase.from('places').insert(rows);
    if (error) {
      console.log('[terramap/bg] supabase insert error:', error);
      throw error;
    }
    console.log('[terramap/bg] insert OK, count:', rows.length);
    await completeScrapeRun(supabase, runId, rows.length).catch((e) => {
      // Rows are saved but the folder will stay 'running'. Spec calls this out
      // as a known recoverable gap for a later improvement.
      console.log('[terramap/bg] completeScrapeRun failed:', e);
    });
    await setStatus({
      state: 'success',
      message: `Tersimpan ${rows.length} POI`,
      inserted: rows.length,
      sessionId,
      runId,
    });
    return { type: 'SAVE_STATUS', ok: true, inserted: rows.length, sessionId, runId };
  } catch (e: any) {
    console.log('[terramap/bg] handleStart caught:', e);
    const errMsg = e?.message ?? String(e);
    await failScrapeRun(supabase, runId, errMsg).catch(() => {});
    await setStatus({ state: 'error', message: errMsg, hint: diagnose(errMsg), sessionId });
    return {
      type: 'SAVE_STATUS',
      ok: false,
      inserted: 0,
      error: errMsg,
      sessionId,
    };
  } finally {
    await chrome.alarms.clear(alarmName);
  }
}

function estimateScrapeTimeoutMs(maxResults: number, scrollDelayMs: number): number {
  const delay = Math.max(scrollDelayMs || 0, 800);
  const listPassMs = maxResults * delay * 2;
  const detailPassMs = maxResults * delay * 4;
  return Math.max(180_000, Math.min(20 * 60_000, 90_000 + listPassMs + detailPassMs));
}

interface ResultWaiter {
  promise: Promise<AreaScrapeResult & { error?: string }>;
  /** Abort the wait early (e.g. a dead dispatch) and tear down its listener/timer. */
  cancel: (err: Error) => void;
}

/** Wait for the content script to push AREA_SCRAPE_RESULT for our sessionId. */
function waitForResultPush(sessionId: string, timeoutMs: number): ResultWaiter {
  let cancel: (err: Error) => void = () => {};
  const promise = new Promise<AreaScrapeResult & { error?: string }>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      chrome.runtime.onMessage.removeListener(handler);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for AREA_SCRAPE_RESULT (${timeoutMs}ms)`));
    }, timeoutMs);
    const handler = (incoming: any) => {
      if (incoming?.type === 'AREA_SCRAPE_RESULT' && incoming.sessionId === sessionId) {
        cleanup();
        resolve(incoming);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    cancel = (err: Error) => {
      cleanup();
      reject(err);
    };
  });
  return { promise, cancel };
}

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
