import { supabase } from '@/lib/supabase';
import { buildGmapsSearchUrl, pickZoomForRadius, nextSessionId } from '@terramap/area';
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
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { type: 'SAVE_STATUS', ok: false, inserted: 0, error: 'Not logged in' };
  }
  const userId = userData.user.id;
  const sessionId = nextSessionId();
  const { keyword, lat, lng, radiusM } = msg.params;
  const url = buildGmapsSearchUrl({ keyword, lat, lng, zoom: pickZoomForRadius(radiusM) });
  console.log('[terramap/bg] gmaps URL:', url, 'sessionId:', sessionId);

  const alarmName = `scrape-${sessionId}`;
  await chrome.alarms.create(alarmName, { periodInMinutes: 0.4 });

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
    return { type: 'SAVE_STATUS', ok: false, inserted: 0, error: `tab open: ${e?.message ?? e}` };
  }
  const tabId = tab.id!;

  try {
    await waitForTabComplete(tabId, 20_000);
    console.log('[terramap/bg] tab', tabId, 'reported complete');

    const runMsg: RunAreaScrape = { type: 'RUN_AREA_SCRAPE', params: msg.params, sessionId };

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

    const rows = result.places.map((p) => ({ ...p, user_id: userId }));
    if (!rows.length) {
      const err = (result as any).error;
      return {
        type: 'SAVE_STATUS',
        ok: false,
        inserted: 0,
        error:
          err ??
          'Scrape returned 0 places (selectors stale, or none inside radius). Check Maps tab console.',
        sessionId,
      };
    }
    console.log('[terramap/bg] inserting', rows.length, 'rows. sample:', rows[0]);
    const { error } = await supabase.from('places').insert(rows);
    if (error) {
      console.log('[terramap/bg] supabase insert error:', error);
      throw error;
    }
    console.log('[terramap/bg] insert OK, count:', rows.length);
    return { type: 'SAVE_STATUS', ok: true, inserted: rows.length, sessionId };
  } catch (e: any) {
    console.log('[terramap/bg] handleStart caught:', e);
    return {
      type: 'SAVE_STATUS',
      ok: false,
      inserted: 0,
      error: e?.message ?? String(e),
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
