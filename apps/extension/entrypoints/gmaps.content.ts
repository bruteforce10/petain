import { scrapeGoogleMaps, scrapeGoogleMapsDeep } from '@/lib/scrapers/gmaps';
import type { StartScrape, ScrapeResult } from '@/lib/types';

function detectGmapsKeyword(): string | null {
  const m = location.pathname.match(/\/maps\/search\/([^/]+)/);
  if (m?.[1]) {
    try {
      return decodeURIComponent(m[1].replace(/\+/g, ' ')).trim() || null;
    } catch {
      return null;
    }
  }
  const input = document.querySelector<HTMLInputElement>('input#searchboxinput');
  return input?.value.trim() || null;
}

export default defineContentScript({
  matches: ['https://www.google.com/maps/*', 'https://maps.google.com/*'],
  async main() {
    chrome.runtime.onMessage.addListener((msg: StartScrape, _s, sendResponse) => {
      if (msg?.type !== 'START_SCRAPE') return;
      (async () => {
        // 1) list pass: cheap, gets every visible result.
        const list = await scrapeGoogleMaps();
        // 2) deep pass: click each result for detail-panel fields.
        const places = await scrapeGoogleMapsDeep(list);
        const result: ScrapeResult = {
          type: 'SCRAPE_RESULT',
          source: 'gmaps',
          keyword: detectGmapsKeyword(),
          places,
        };
        chrome.runtime.sendMessage(result, sendResponse);
      })().catch((e) =>
        sendResponse({ type: 'SAVE_STATUS', ok: false, inserted: 0, error: String(e) }),
      );
      return true;
    });
  },
});
