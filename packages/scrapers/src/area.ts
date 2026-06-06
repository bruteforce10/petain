import type { AreaScrapeParams, Place } from '@terramap/types';
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
  const geofenceTerms = geofence?.enabled
    ? [geofence.kecamatan, geofence.kabupaten, geofence.provinsi]
        .map((term) => term.trim())
        .filter(Boolean)
    : [];
  const geofenceLocation = geofenceTerms.join(' ');
  const hasGeofenceFilter = geofenceTerms.length > 0;

  const query = `${businessQuery} ${geofenceLocation || locationQuery}`.trim();

  // Resumed runs (content script reinjected after Maps full-reloaded into
  // /maps/place/) skip the search step — we're already on the target POI.
  if (!location.pathname.startsWith('/maps/place/')) {
    await searchOnMaps(query);
  } else {
    console.log('[terramap/scrape] already on /maps/place/, skipping searchOnMaps');
  }

  // Maps redirects to /maps/place/ when the query strongly matches a single
  // POI (e.g. "Mie Gacoan Pondok Aren" → one specific store). Treat that as a
  // valid 1-result scrape instead of failing.
  const onPlacePage = location.pathname.startsWith('/maps/place/');
  if (onPlacePage) {
    console.log('[terramap/scrape] single place page detected');
    const single = await scrapeCurrentPlace();
    if (!single) {
      throw new Error(
        'Halaman detail Maps terbuka tapi data tempat gagal dibaca (selector h1.DUwDvf stale atau panel kosong).',
      );
    }
    // Skip geofence on single-POI: the user already pinned the location in the
    // query (e.g. "Gacoan Pondok Aren"). The filter exists to drop out-of-area
    // hits from the multi-result feed — it would only reject the very place
    // the user explicitly searched for.
    if (hasGeofenceFilter) {
      console.log('[terramap/scrape] single place: skipping geofence (location is in query)');
    }
    return [{ ...single, scrape_session_id: sessionId, keyword: query }];
  }

  const list = await scrapeGoogleMaps(scrollDelayMs, {
    maxResults,
    maxRounds: Math.max(80, Math.ceil(maxResults * 1.5)),
  });
  console.log('[terramap/scrape] list pass:', list.length);

  if (!list.length) {
    throw new Error(
      `Maps menampilkan feed hasil pencarian tapi 0 tempat terbaca. Query: "${query}". Kemungkinan selector Maps berubah — laporkan ke developer.`,
    );
  }

  const limited = list.slice(0, maxResults);
  console.log('[terramap/scrape] capped to:', limited.length);

  const deep = await scrapeGoogleMapsDeep(limited, { limit: maxResults, delay: scrollDelayMs });
  console.log('[terramap/scrape] deep pass:', deep.length);

  if (!hasGeofenceFilter) {
    return deep.map((p) => ({ ...p, scrape_session_id: sessionId, keyword: query }));
  }

  const filtered = deep.filter((p) => addressContainsAny(p.address, geofenceTerms));

  if (!filtered.length) {
    const filterLabel = geofenceTerms.join(', ');
    throw new Error(
      `Ditemukan ${deep.length} tempat tapi tidak ada yang cocok filter "${filterLabel}". Coba longgarkan filter lokasi, atau nonaktifkan filter untuk simpan semuanya.`,
    );
  }

  return filtered.map((p) => ({ ...p, scrape_session_id: sessionId, keyword: query }));
}

/**
 * Match address text against location terms with Indonesian abbreviation
 * normalization. Maps addresses often write "Kec. Pd. Aren" instead of
 * "Kecamatan Pondok Aren" — naive substring match would reject those.
 */
function addressContainsAny(address: string | null | undefined, terms: string[]): boolean {
  if (!address) return false;
  const normalized = normalizeIndoAddress(address);
  const normalizedTerms = terms.map(normalizeIndoTerm).filter(Boolean);
  return normalizedTerms.some((term) => normalized.includes(term));
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
