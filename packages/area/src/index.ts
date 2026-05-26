// Area-scrape helpers: geo math, gmaps URL builder, session id.
// Pure functions, browser-safe. No Supabase, no DOM.

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in meters between two coordinates (haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Pick a Google Maps zoom that roughly frames a circle of the given radius.
 * Heuristic: at zoom Z, one screen ≈ 256 * 2^(20-Z) meters across (at equator).
 * Radius 250m → 17, 1km → 16, 3km → 15, 10km → 13. Clamped to [12, 18].
 */
export function pickZoomForRadius(radiusM: number): number {
  if (radiusM <= 0) return 17;
  // Half the visible span ≈ radius; pick zoom so span ≈ 4 * radius.
  const targetSpan = 4 * radiusM;
  const z = Math.round(20 - Math.log2(targetSpan / 256));
  return Math.max(12, Math.min(18, z));
}

export interface BuildUrlParams extends LatLng {
  keyword: string;
  zoom?: number;
}

/** Build a Google Maps search URL centered on lat/lng for a keyword. */
export function buildGmapsSearchUrl({
  keyword,
  lat,
  lng,
  zoom,
}: BuildUrlParams): string {
  const q = encodeURIComponent(keyword.trim());
  const z = zoom ?? 15;
  return `https://www.google.com/maps/search/${q}/@${lat},${lng},${z}z`;
}

/** Crypto-safe uuid v4 for grouping a scrape session's rows. */
export function nextSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older runtimes: RFC4122-ish v4 from Math.random.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Filter places whose lat/lng falls within radiusM of center. */
export function filterWithinRadius<T extends { lat?: number | null; lng?: number | null }>(
  rows: T[],
  center: LatLng,
  radiusM: number,
): T[] {
  return rows.filter((r) => {
    if (typeof r.lat !== 'number' || typeof r.lng !== 'number') return false;
    return haversineMeters(center, { lat: r.lat, lng: r.lng }) <= radiusM;
  });
}
