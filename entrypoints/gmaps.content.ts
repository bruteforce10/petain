import { scrapeGoogleMaps } from '@/lib/scrapers/gmaps';
import type { StartScrape, ScrapeResult } from '@/lib/types';

export default defineContentScript({
  matches: ['https://www.google.com/maps/*', 'https://maps.google.com/*'],
  async main() {
    chrome.runtime.onMessage.addListener((msg: StartScrape, _s, sendResponse) => {
      if (msg?.type !== 'START_SCRAPE') return;
      scrapeGoogleMaps()
        .then((places) => {
          const result: ScrapeResult = { type: 'SCRAPE_RESULT', source: 'gmaps', places };
          chrome.runtime.sendMessage(result, sendResponse);
        })
        .catch((e) => sendResponse({ type: 'SAVE_STATUS', ok: false, inserted: 0, error: String(e) }));
      return true;
    });
  },
});
