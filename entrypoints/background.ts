import { supabase } from '@/lib/supabase';
import type { ScrapeResult, SaveStatus } from '@/lib/types';

/**
 * Service worker: receives scraped data from content scripts, stamps the
 * current user_id, batch-inserts into Supabase, and reports status to the
 * sender (popup forwards/displays it).
 */
export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((msg: ScrapeResult, _sender, sendResponse) => {
    if (msg?.type !== 'SCRAPE_RESULT') return;
    handleScrapeResult(msg).then(sendResponse);
    return true; // async response
  });
});

async function handleScrapeResult(msg: ScrapeResult): Promise<SaveStatus> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { type: 'SAVE_STATUS', ok: false, inserted: 0, error: 'Not logged in' };
  }
  const userId = userData.user.id;

  try {
    if (msg.source === 'gmaps' && msg.places?.length) {
      const rows = msg.places.map((p) => ({ ...p, user_id: userId }));
      const { error } = await supabase.from('places').insert(rows);
      if (error) throw error;
      return { type: 'SAVE_STATUS', ok: true, inserted: rows.length };
    }

    if ((msg.source === 'shopee' || msg.source === 'tokopedia') && msg.products?.length) {
      const rows = msg.products.map((p) => ({ ...p, user_id: userId }));
      const { error } = await supabase.from('products').insert(rows);
      if (error) throw error;
      return { type: 'SAVE_STATUS', ok: true, inserted: rows.length };
    }

    return { type: 'SAVE_STATUS', ok: true, inserted: 0, error: 'No items found' };
  } catch (e: any) {
    return { type: 'SAVE_STATUS', ok: false, inserted: 0, error: e?.message ?? String(e) };
  }
}
