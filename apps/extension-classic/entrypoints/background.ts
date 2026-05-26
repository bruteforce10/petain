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
 *   popup → START_AREA_SCRAPE { keyword, lat, lng, radiusM }
 *   → background opens a new tab on the gmaps search URL
 *   → waits until the area-content script finishes loading
 *   → sends RUN_AREA_SCRAPE with sessionId + params
 *   → content returns AREA_SCRAPE_RESULT with rows
 *   → background inserts rows into Supabase with user_id
 *   → background returns SaveStatus to popup
 */
export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((msg: StartAreaScrape, _sender, sendResponse) => {
    if (msg?.type !== 'START_AREA_SCRAPE') return;
    handleStart(msg).then(sendResponse);
    return true; // keep channel open for async sendResponse
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

  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.create({ url, active: false });
  } catch (e: any) {
    return { type: 'SAVE_STATUS', ok: false, inserted: 0, error: `tab open: ${e?.message ?? e}` };
  }
  const tabId = tab.id!;

  try {
    await waitForTabComplete(tabId, 20_000);

    const runMsg: RunAreaScrape = { type: 'RUN_AREA_SCRAPE', params: msg.params, sessionId };
    // Send to content script. Retry briefly: WXT may inject the content
    // script a tick after the tab reports "complete".
    const result = (await sendWithRetry(tabId, runMsg, 5, 800)) as AreaScrapeResult | undefined;

    if (!result || result.type !== 'AREA_SCRAPE_RESULT') {
      return {
        type: 'SAVE_STATUS',
        ok: false,
        inserted: 0,
        error: 'Content script returned no result',
        sessionId,
      };
    }

    const rows = result.places.map((p) => ({ ...p, user_id: userId }));
    if (!rows.length) {
      return { type: 'SAVE_STATUS', ok: true, inserted: 0, sessionId };
    }
    const { error } = await supabase.from('places').insert(rows);
    if (error) throw error;
    return { type: 'SAVE_STATUS', ok: true, inserted: rows.length, sessionId };
  } catch (e: any) {
    return {
      type: 'SAVE_STATUS',
      ok: false,
      inserted: 0,
      error: e?.message ?? String(e),
      sessionId,
    };
  } finally {
    // Leave tab open so the user can inspect results; comment out close.
    // chrome.tabs.remove(tabId).catch(() => {});
  }
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
