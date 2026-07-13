import type {
  AreaScrapeParams,
  OnScrapeProgress,
  Place,
  ScrapeProgress,
  ScrapeProgressItem,
} from '@terramap/types';
import {
  scrapeCurrentPlace,
  scrapeGoogleMaps,
  scrapeGoogleMapsDeep,
  searchOnMaps,
} from './gmaps';

const toProgressItem = (p: Place): ScrapeProgressItem => ({
  name: p.name,
  rating: p.rating ?? null,
  category: p.category ?? null,
  address: p.address ?? null,
});

// Phase header copy + step index (out of phaseTotal=3) the sidebar renders.
const PHASE_META: Record<Exclude<ScrapePhase, 'idle'>, { step: number; label: string }> = {
  searching: { step: 1, label: 'Mencari di Maps' },
  listing: { step: 2, label: 'Mengambil daftar' },
  details: { step: 3, label: 'Mengambil detail' },
  filtering: { step: 3, label: 'Memfilter area' },
  done: { step: 3, label: 'Selesai' },
  error: { step: 3, label: 'Gagal' },
};

type ScrapePhase = ScrapeProgress['phase'];

export async function scrapeAreaOnPage(
  params: AreaScrapeParams & { sessionId: string },
  onProgress?: OnScrapeProgress,
): Promise<Place[]> {
  const { businessQuery, locationQuery, maxResults, scrollDelayMs, geofence, sessionId } = params;

  let progress: ScrapeProgress = {
    phase: 'idle',
    phaseStep: 0,
    phaseTotal: 3,
    label: '',
    current: 0,
    total: 0,
    items: [],
  };
  const emit = (patch: Partial<ScrapeProgress>): void => {
    const phase = patch.phase ?? progress.phase;
    const meta = phase !== 'idle' ? PHASE_META[phase] : undefined;
    progress = {
      ...progress,
      ...patch,
      phaseStep: patch.phaseStep ?? meta?.step ?? progress.phaseStep,
      label: patch.label ?? meta?.label ?? progress.label,
    };
    onProgress?.(progress);
  };
  const geofenceTerms = geofence?.enabled
    ? [geofence.kecamatan, geofence.kabupaten, geofence.provinsi]
        .map((term) => term.trim())
        .filter(Boolean)
    : [];
  const geofenceLocation = geofenceTerms.join(' ');
  const hasGeofenceFilter = geofenceTerms.length > 0;

  const query = `${businessQuery} ${geofenceLocation || locationQuery}`.trim();

  // A fresh run landing on /maps/place/ means the query itself pinned one POI —
  // skip the search. A RESUMED run (forceSearch) can be parked on the last
  // clicked card's place page after a mid-scrape reload; without re-searching
  // it would take the single-place path below and push 1 row for what was a
  // multi-result scrape.
  emit({ phase: 'searching', current: 0, total: 0 });
  if (params.forceSearch || !location.pathname.startsWith('/maps/place/')) {
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
    emit({ phase: 'done', items: [toProgressItem(single)], current: 1, total: 1 });
    return [{ ...single, scrape_session_id: sessionId, keyword: query }];
  }

  // List pass: stream each card into the live list as it parses, while still
  // honouring the maxResults cap + bounded scroll rounds from the area scraper.
  const listItems: ScrapeProgressItem[] = [];
  emit({ phase: 'listing', current: 0, total: 0, items: [] });
  const list = await scrapeGoogleMaps(
    scrollDelayMs,
    { maxResults, maxRounds: Math.max(80, Math.ceil(maxResults * 1.5)) },
    ({ item, current, total }) => {
      listItems.push(item);
      emit({ phase: 'listing', current, total, items: [...listItems] });
    },
  );
  console.log('[terramap/scrape] list pass:', list.length);

  if (!list.length) {
    throw new Error(
      `Maps menampilkan feed hasil pencarian tapi 0 tempat terbaca. Query: "${query}". Kemungkinan selector Maps berubah — laporkan ke developer.`,
    );
  }

  const limited = list.slice(0, maxResults);
  console.log('[terramap/scrape] capped to:', limited.length);

  // Detail pass: replace each item in place as enrichment lands.
  const detailItems: ScrapeProgressItem[] = limited.map(toProgressItem);
  emit({ phase: 'details', current: 0, total: limited.length, items: [...detailItems] });
  const deep = await scrapeGoogleMapsDeep(
    limited,
    { limit: maxResults, delay: scrollDelayMs },
    ({ item, current, total }) => {
      detailItems[current - 1] = item;
      emit({ phase: 'details', current, total, items: [...detailItems] });
    },
  );
  console.log('[terramap/scrape] deep pass:', deep.length);

  if (!hasGeofenceFilter) {
    emit({ phase: 'done', current: deep.length, total: deep.length, items: deep.map(toProgressItem) });
    return deep.map((p) => ({ ...p, scrape_session_id: sessionId, keyword: query }));
  }

  emit({ phase: 'filtering', current: 0, total: deep.length });
  const filtered = deep.filter((p) => passesGeofence(p.address, geofenceTerms));

  if (!filtered.length) {
    const filterLabel = geofenceTerms.join(', ');
    throw new Error(
      `Ditemukan ${deep.length} tempat tapi tidak ada yang cocok filter "${filterLabel}". Coba longgarkan filter lokasi, atau nonaktifkan filter untuk simpan semuanya.`,
    );
  }

  emit({ phase: 'done', current: filtered.length, total: filtered.length, items: filtered.map(toProgressItem) });
  return filtered.map((p) => ({ ...p, scrape_session_id: sessionId, keyword: query }));
}

/**
 * Geofence acceptance for one scraped row. Only a FULL address (detail-panel
 * style, comma-separated locality segments) can prove a place sits outside
 * the filtered area. List-pass card addresses are street-only
 * ("Jl. Ganesha No.3") and carry no kecamatan/kabupaten information at all,
 * so rows whose detail enrichment failed must be kept — rejecting them turned
 * partial enrichment failures into "20 scraped, 2 saved".
 */
export function passesGeofence(
  address: string | null | undefined,
  terms: string[],
): boolean {
  if (!address || !address.includes(',')) return true;
  return addressContainsAny(address, terms);
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
