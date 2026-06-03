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
    return 'Scrape timeout (3 menit). Buka popup lagi — extension akan auto-resume jika scrape masih berjalan. Jika tetap gagal, kurangi "Max hasil" atau pakai query yang lebih spesifik.';
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
  const { businessQuery, locationQuery } = msg.params;
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
      keyword: `${businessQuery} ${locationQuery}`.trim(),
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

  await setStatus({ state: 'running', step: 'tab', message: 'Membuka tab Google Maps…', sessionId });
  let tab: chrome.tabs.Tab;
  try {
    const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (active?.id && active.url && GMAPS_URL_RE.test(active.url)) {
      tab = await chrome.tabs.update(active.id, { url, active: true });
      if (active.windowId !== undefined) {
        await chrome.windows.update(active.windowId, { focused: true });
      }
      console.log('[terramap/bg] reused existing gmaps tab, id:', tab.id);
    } else {
      tab = await chrome.tabs.create({ url, active: true });
      console.log('[terramap/bg] tab created, id:', tab.id);
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
    await setStatus({ state: 'running', step: 'load', message: 'Menunggu Maps siap…', sessionId });
    await waitForTabComplete(tabId, 20_000);
    console.log('[terramap/bg] tab', tabId, 'reported complete');

    const runMsg: RunAreaScrape = { type: 'RUN_AREA_SCRAPE', params: msg.params, sessionId };

    await setStatus({
      state: 'running',
      step: 'scrape',
      message: 'Scraping POI di Google Maps… (jangan tutup tab Maps)',
      sessionId,
    });

    // Register push listener BEFORE sending the run message to avoid race.
    const resultPromise = waitForResultPush(sessionId, 180_000);

    try {
      await sendWithRetry(tabId, runMsg, 5, 800);
    } catch (e: any) {
      console.log('[terramap/bg] sendMessage to content failed:', e);
    }
    console.log('[terramap/bg] RUN_AREA_SCRAPE dispatched, waiting for push…');

    const result = await resultPromise;
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
    });
    return { type: 'SAVE_STATUS', ok: true, inserted: rows.length, sessionId };
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

/** Wait for the content script to push AREA_SCRAPE_RESULT for our sessionId. */
function waitForResultPush(
  sessionId: string,
  timeoutMs: number,
): Promise<AreaScrapeResult & { error?: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(handler);
      reject(new Error(`Timeout waiting for AREA_SCRAPE_RESULT (${timeoutMs}ms)`));
    }, timeoutMs);
    const handler = (incoming: any) => {
      if (incoming?.type === 'AREA_SCRAPE_RESULT' && incoming.sessionId === sessionId) {
        clearTimeout(timer);
        chrome.runtime.onMessage.removeListener(handler);
        resolve(incoming);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
  });
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
