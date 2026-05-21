import { installInterceptor } from '@/utils/apiIntercept';
import { TOKOPEDIA_API_PATTERNS } from '@/lib/scrapers/tokopedia';

// Runs in the page's MAIN world to patch fetch/XHR before Tokopedia uses them.
export default defineContentScript({
  matches: ['https://www.tokopedia.com/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    installInterceptor(TOKOPEDIA_API_PATTERNS);
  },
});
