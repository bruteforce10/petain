import { INTERCEPT_MSG } from '@/utils/apiIntercept';
import { autoScroll, sleep } from '@/utils/scroll';
import { parseShopeeApi, scrapeShopeeDom } from '@/lib/scrapers/shopee';
import type { StartScrape, ScrapeResult, Product } from '@/lib/types';

function detectShopeeKeyword(): string | null {
  const params = new URLSearchParams(location.search);
  const q = params.get('keyword') ?? params.get('q');
  return q?.trim() || null;
}

export default defineContentScript({
  matches: ['https://shopee.co.id/*'],
  main() {
    // Accumulate products captured from intercepted API responses.
    const captured = new Map<string, Product>();
    const key = (p: Product) => p.product_url ?? p.name;

    window.addEventListener('message', (ev) => {
      if (ev.source !== window || ev.data?.source !== INTERCEPT_MSG) return;
      parseShopeeApi(ev.data.body).forEach((p) => captured.set(key(p), p));
    });

    chrome.runtime.onMessage.addListener((msg: StartScrape, _s, sendResponse) => {
      if (msg?.type !== 'START_SCRAPE') return;
      (async () => {
        // Scroll to trigger lazy API calls + lazy DOM cards.
        await autoScroll(null, { step: 1200, delay: 900, maxRounds: 30 });
        await sleep(500);
        // Merge DOM fallback in case API capture missed items.
        scrapeShopeeDom().forEach((p) => {
          if (!captured.has(key(p))) captured.set(key(p), p);
        });
        const result: ScrapeResult = {
          type: 'SCRAPE_RESULT',
          source: 'shopee',
          keyword: detectShopeeKeyword(),
          products: [...captured.values()],
        };
        chrome.runtime.sendMessage(result, sendResponse);
      })();
      return true;
    });
  },
});
