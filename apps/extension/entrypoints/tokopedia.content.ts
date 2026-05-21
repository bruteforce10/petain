import { INTERCEPT_MSG } from '@/utils/apiIntercept';
import { autoScroll, sleep } from '@/utils/scroll';
import { parseTokopediaApi, scrapeTokopediaDom } from '@/lib/scrapers/tokopedia';
import type { StartScrape, ScrapeResult, Product } from '@/lib/types';

export default defineContentScript({
  matches: ['https://www.tokopedia.com/*'],
  main() {
    const captured = new Map<string, Product>();
    const key = (p: Product) => p.product_url ?? p.name;

    window.addEventListener('message', (ev) => {
      if (ev.source !== window || ev.data?.source !== INTERCEPT_MSG) return;
      parseTokopediaApi(ev.data.body).forEach((p) => captured.set(key(p), p));
    });

    chrome.runtime.onMessage.addListener((msg: StartScrape, _s, sendResponse) => {
      if (msg?.type !== 'START_SCRAPE') return;
      (async () => {
        await autoScroll(null, { step: 1200, delay: 900, maxRounds: 30 });
        await sleep(500);
        scrapeTokopediaDom().forEach((p) => {
          if (!captured.has(key(p))) captured.set(key(p), p);
        });
        const result: ScrapeResult = {
          type: 'SCRAPE_RESULT',
          source: 'tokopedia',
          products: [...captured.values()],
        };
        chrome.runtime.sendMessage(result, sendResponse);
      })();
      return true;
    });
  },
});
