import type { AreaScrapeParams, Place } from '@terramap/types';
import { filterWithinRadius } from '@terramap/area';
import { scrapeGoogleMaps, scrapeGoogleMapsDeep } from './gmaps';

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

  const list = await scrapeGoogleMaps();
  const deep = await scrapeGoogleMapsDeep(list, { limit: deepLimit });

  const center = { lat, lng };
  const inside = filterWithinRadius(deep, center, radiusM);

  return inside.map((p) => ({
    ...p,
    scrape_session_id: sessionId,
    area_center_lat: lat,
    area_center_lng: lng,
    area_radius_m: radiusM,
    keyword,
  }));
}
