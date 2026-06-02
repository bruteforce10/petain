import { supabase } from '@/lib/supabase';
import { createScrapeRun, completeScrapeRun, failScrapeRun } from '@terramap/supabase';
import type { ScrapeResult, SaveStatus } from '@/lib/types';

/**
 * Service worker: receives scraped data from content scripts, stamps the
 * current user_id + a fresh scrape_run_id (one folder per scrape), batch-
 * inserts into Supabase, and reports status to the sender.
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
  const keyword = msg.keyword?.trim() || 'Untitled scrape';

  let runId: string;
  try {
    const run = await createScrapeRun(supabase, { source: msg.source, keyword });
    runId = run.id;
  } catch (e: any) {
    return {
      type: 'SAVE_STATUS',
      ok: false,
      inserted: 0,
      error: `Could not create folder: ${e?.message ?? e}`,
    };
  }

  try {
    if (msg.source === 'gmaps' && msg.places?.length) {
      const rows = msg.places.map((p) => ({
        ...p,
        user_id: userId,
        scrape_run_id: runId,
      }));
      const { error } = await supabase.from('places').insert(rows);
      if (error) throw error;
      await completeScrapeRun(supabase, runId, rows.length).catch(() => {});
      return { type: 'SAVE_STATUS', ok: true, inserted: rows.length };
    }

    if ((msg.source === 'shopee' || msg.source === 'tokopedia') && msg.products?.length) {
      const rows = msg.products.map((p) => ({
        ...p,
        user_id: userId,
        scrape_run_id: runId,
      }));
      const { error } = await supabase.from('products').insert(rows);
      if (error) throw error;
      await completeScrapeRun(supabase, runId, rows.length).catch(() => {});
      return { type: 'SAVE_STATUS', ok: true, inserted: rows.length };
    }

    // No rows scraped — folder stays visible as `failed` per spec.
    await failScrapeRun(supabase, runId, 'No items found').catch(() => {});
    return { type: 'SAVE_STATUS', ok: false, inserted: 0, error: 'No items found' };
  } catch (e: any) {
    const errMsg = e?.message ?? String(e);
    await failScrapeRun(supabase, runId, errMsg).catch(() => {});
    return { type: 'SAVE_STATUS', ok: false, inserted: 0, error: errMsg };
  }
}
