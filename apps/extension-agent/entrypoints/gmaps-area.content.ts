import { scrapeAreaOnPage } from '@terramap/scrapers/area';
import type { AreaScrapeResult, RunAreaScrape } from '@/lib/types';

export default defineContentScript({
  matches: ['https://www.google.com/maps/*', 'https://maps.google.com/*'],
  async main() {
    chrome.runtime.onMessage.addListener((msg: RunAreaScrape, _sender, sendResponse) => {
      if (msg?.type !== 'RUN_AREA_SCRAPE') return;
      (async () => {
        try {
          const places = await scrapeAreaOnPage({
            ...msg.params,
            sessionId: msg.sessionId,
          });
          const result: AreaScrapeResult = {
            type: 'AREA_SCRAPE_RESULT',
            sessionId: msg.sessionId,
            places,
          };
          sendResponse(result);
        } catch (e: any) {
          sendResponse({
            type: 'AREA_SCRAPE_RESULT',
            sessionId: msg.sessionId,
            places: [],
            error: e?.message ?? String(e),
          });
        }
      })();
      return true;
    });
  },
});
