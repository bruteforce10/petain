import { scrapeAreaOnPage } from '@terramap/scrapers/area';
import type { AreaScrapeParams, AreaScrapeResult, RunAreaScrape } from '@/lib/types';

// Maps redirects to /maps/place/... when a search matches one POI (e.g.
// "Gacoan Pondok Aren"). The redirect is sometimes a full reload that tears
// down the content script mid-scrape and orphans the runAndPush promise.
// Persist {sessionId, params, startedAt} so the reinjected script can resume.
const STATE_KEY = 'terramap.activeScrape';
const STALE_MS = 5 * 60_000;

interface ActiveScrape {
  sessionId: string;
  params: AreaScrapeParams;
  startedAt: number;
}

export default defineContentScript({
  matches: ['https://www.google.com/maps/*', 'https://maps.google.com/*'],
  async main() {
    console.log('[terramap/content] gmaps-area content script loaded at', location.href);
    chrome.runtime.onMessage.addListener((msg: RunAreaScrape) => {
      if (msg?.type !== 'RUN_AREA_SCRAPE') return;
      console.log('[terramap/content] RUN_AREA_SCRAPE received, session', msg.sessionId);
      void startScrape(msg);
    });
    await maybeResume();
  },
});

async function startScrape(msg: RunAreaScrape): Promise<void> {
  const state: ActiveScrape = {
    sessionId: msg.sessionId,
    params: msg.params,
    startedAt: Date.now(),
  };
  try {
    await chrome.storage.session.set({ [STATE_KEY]: state });
  } catch (e) {
    console.log('[terramap/content] storage.session.set failed:', e);
  }
  await runAndPush(msg);
}

async function maybeResume(): Promise<void> {
  let active: ActiveScrape | undefined;
  try {
    const stored = await chrome.storage.session.get(STATE_KEY);
    active = stored[STATE_KEY] as ActiveScrape | undefined;
  } catch (e) {
    console.log('[terramap/content] storage.session.get failed:', e);
    return;
  }
  if (!active) return;

  if (Date.now() - active.startedAt > STALE_MS) {
    console.log('[terramap/content] clearing stale scrape state, session', active.sessionId);
    await chrome.storage.session.remove(STATE_KEY).catch(() => {});
    return;
  }

  console.log(
    '[terramap/content] resuming scrape session',
    active.sessionId,
    'at',
    location.href,
  );
  // forceSearch: a resume can wake up parked on the place page of whichever
  // card the dead run last clicked. Re-running the search puts the scrape back
  // on the results feed instead of returning that one place as the result.
  await runAndPush({
    type: 'RUN_AREA_SCRAPE',
    params: { ...active.params, forceSearch: true },
    sessionId: active.sessionId,
  });
}

async function runAndPush(msg: RunAreaScrape): Promise<void> {
  try {
    const places = await scrapeAreaOnPage({ ...msg.params, sessionId: msg.sessionId });
    console.log('[terramap/content] scrape finished, places:', places.length, 'sample:', places[0]);
    const result: AreaScrapeResult = {
      type: 'AREA_SCRAPE_RESULT',
      sessionId: msg.sessionId,
      places,
    };
    await chrome.runtime.sendMessage(result);
  } catch (e: any) {
    console.log('[terramap/content] scrape threw:', e);
    await chrome.runtime.sendMessage({
      type: 'AREA_SCRAPE_RESULT',
      sessionId: msg.sessionId,
      places: [],
      error: e?.message ?? String(e),
    });
  } finally {
    await chrome.storage.session.remove(STATE_KEY).catch(() => {});
  }
}
