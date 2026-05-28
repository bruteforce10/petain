import type { AreaScrapeParams, Place } from '@terramap/types';
import { filterWithinRadius } from '@terramap/area';
import { scrapeGoogleMaps, scrapeGoogleMapsDeep, searchOnMaps } from './gmaps';

/**
 * Scrape kernel for an area-bounded search.
 *
 * Assumes the active tab is already on a Google Maps search URL centered
 * on `lat/lng` (caller is responsible for navigating with
 * `buildGmapsSearchUrl(...)`). The kernel itself only:
 *
 *   1. Runs the list-pass scraper (already auto-scrolls the feed).
 *   2. Runs the deep-pass scraper (clicks each card for detail fields).
 *   3. Filters results by haversine distance — Maps frequently returns
 *      POIs outside the visible viewport, so we strictly cap to radiusM.
 *   4. Stamps each row with area metadata so the dashboard can group it.
 *
 * Returns the enriched, filtered places. The session_id is allocated by
 * the caller and passed in so background can reuse the same id for any
 * follow-up (e.g. retry, additional keyword pass).
 */
export async function scrapeAreaOnPage(
  params: AreaScrapeParams & { sessionId: string; deepLimit?: number },
): Promise<Place[]> {
  const { keyword, lat, lng, radiusM, sessionId, deepLimit = 60 } = params;

  await searchOnMaps(keyword);
  const list = await scrapeGoogleMaps();
  console.log('[terramap/scrape] list pass:', list.length, 'sample:', list[0]);

  // Filter by radius BEFORE the deep pass. A generic keyword fills the feed
  // with 100+ cards but only a handful sit inside a small radius; deep-scraping
  // all 60 (clicking each card) blows past the background's 180s push timeout.
  // The list pass already extracts lat/lng, so cap the deep pass to the POIs
  // actually inside the circle.
  const center = { lat, lng };
  const inside = filterWithinRadius(list, center, radiusM);
  console.log('[terramap/scrape] inside radius:', inside.length, '/', list.length);

  const deep = await scrapeGoogleMapsDeep(inside, { limit: deepLimit });
  console.log(
    '[terramap/scrape] deep pass:',
    deep.length,
    'sample lat/lng:',
    deep[0]?.lat,
    deep[0]?.lng,
  );

  return deep.map((p) => ({
    ...p,
    scrape_session_id: sessionId,
    area_center_lat: lat,
    area_center_lng: lng,
    area_radius_m: radiusM,
    keyword,
  }));
}
