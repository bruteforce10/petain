import { installInterceptor } from '@/utils/apiIntercept';
import { SHOPEE_API_PATTERNS } from '@/lib/scrapers/shopee';

// Runs in the page's MAIN world to patch fetch/XHR before Shopee uses them.
export default defineContentScript({
  matches: ['https://shopee.co.id/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    installInterceptor(SHOPEE_API_PATTERNS);
  },
});
