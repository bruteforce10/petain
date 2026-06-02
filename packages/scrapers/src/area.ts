import type { AreaScrapeParams, Place } from '@petain/types';
import {
  scrapeCurrentPlace,
  scrapeGoogleMaps,
  scrapeGoogleMapsDeep,
  searchOnMaps,
} from './gmaps';

export async function scrapeAreaOnPage(
  params: AreaScrapeParams & { sessionId: string },
): Promise<Place[]> {
  const { businessQuery, locationQuery, maxResults, scrollDelayMs, geofence, sessionId } = params;

  const query = geofence?.enabled
    ? `${businessQuery} ${geofence.kecamatan} ${geofence.kabupaten}`
    : `${businessQuery} ${locationQuery}`;

  await searchOnMaps(query);

  // Maps redirects to /maps/place/ when the query strongly matches a single
  // POI (e.g. "Mie Gacoan Pondok Aren" → one specific store). Treat that as a
  // valid 1-result scrape instead of failing.
  const onPlacePage = location.pathname.startsWith('/maps/place/');
  if (onPlacePage) {
    console.log('[petain/scrape] single place page detected');
    const single = await scrapeCurrentPlace();
    if (!single) return [];
    if (geofence?.enabled && !addressContains(single.address, geofence.kecamatan, geofence.kabupaten)) {
      console.log('[petain/scrape] single place filtered out by geofence:', single.address);
      return [];
    }
    return [{ ...single, scrape_session_id: sessionId, keyword: query }];
  }

  const list = await scrapeGoogleMaps(scrollDelayMs);
  console.log('[petain/scrape] list pass:', list.length);

  const limited = list.slice(0, maxResults);
  console.log('[petain/scrape] capped to:', limited.length);

  const deep = await scrapeGoogleMapsDeep(limited, { limit: maxResults, delay: scrollDelayMs });
  console.log('[petain/scrape] deep pass:', deep.length);

  const filtered =
    geofence?.enabled
      ? deep.filter((p) => addressContains(p.address, geofence.kecamatan, geofence.kabupaten))
      : deep;

  return filtered.map((p) => ({ ...p, scrape_session_id: sessionId, keyword: query }));
}

/**
 * Match address text against location terms with Indonesian abbreviation
 * normalization. Maps addresses often write "Kec. Pd. Aren" instead of
 * "Kecamatan Pondok Aren" — naive substring match would reject those.
 */
function addressContains(address: string | null | undefined, ...terms: string[]): boolean {
  if (!address) return false;
  const normalized = normalizeIndoAddress(address);
  return terms.some((t) => normalized.includes(normalizeIndoTerm(t)));
}

function normalizeIndoAddress(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bpd\.\s*/g, 'pondok ')
    .replace(/\bjl\.\s*/g, 'jalan ')
    .replace(/\bkec\.\s*/g, 'kecamatan ')
    .replace(/\bkel\.\s*/g, 'kelurahan ')
    .replace(/\bkab\.\s*/g, 'kabupaten ')
    .replace(/\bds\.\s*/g, 'desa ');
}

function normalizeIndoTerm(s: string): string {
  // Strip leading "Kabupaten "/"Kota "/"Kecamatan " — Maps addresses sometimes
  // omit the prefix (e.g. "Bandung" vs "Kota Bandung").
  return s
    .toLowerCase()
    .replace(/^(kabupaten|kota|kab\.?|kel\.?|kec\.?)\s+/, '')
    .trim();
}
