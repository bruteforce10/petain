import type { Place } from '@terramap/types';
import { autoScroll, sleep, waitForSelector } from './scroll';

/**
 * Scrape Google Maps search-result feed (the left-hand list panel).
 * DOM-based: Maps does not expose a clean JSON API. Selectors are best-effort
 * and may break when Maps ships a redesign — adjust here if scraping yields 0.
 */

const FEED = 'div[role="feed"]';
// Omnibox: name="q" + role="combobox" excludes the two ZBTq6e directions inputs.
const SEARCH_INPUT = 'input[name="q"][role="combobox"]';

/**
 * Type a keyword into the Maps search box and submit. Used instead of
 * loading a /maps/search/<q>/ URL directly — URL-based searches redirect
 * to /maps/place/ when the query matches one POI tightly. SPA submits don't.
 *
 * Submit via Enter, NOT by clicking the omnibox search button: clicking the
 * button accepts the highlighted autocomplete suggestion, which for most
 * keywords is one specific place → Maps navigates to /maps/place/, triggers a
 * full reload, and the content script is torn down mid-scrape. Enter runs the
 * plain text query → /maps/search/ feed via SPA push (no reload).
 */
export async function searchOnMaps(keyword: string): Promise<void> {
  const input = (await waitForSelector(SEARCH_INPUT, 10_000)) as HTMLInputElement | null;
  if (!input) throw new Error(`Search input ${SEARCH_INPUT} not found on Maps page`);

  // React inputs ignore .value=; use the native setter so the framework sees the change.
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, keyword);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
  await sleep(600);

  // Dismiss autocomplete dropdown before Enter. Specific queries (e.g. with
  // kecamatan + kabupaten) often highlight a single POI suggestion — pressing
  // Enter while a suggestion is highlighted accepts it and Maps navigates to
  // /maps/place/ (single page) instead of /maps/search/ (feed). Two Escapes
  // guard against the dropdown re-opening on the next render tick.
  for (let i = 0; i < 2; i++) {
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }),
    );
    await sleep(150);
  }

  // keyCode/which 13 required — Maps' handler reads the legacy keyCode, not `key`.
  for (const t of ['keydown', 'keypress', 'keyup']) {
    input.dispatchEvent(
      new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }),
    );
  }

  // Maps either shows the feed (list of POIs) OR redirects to /maps/place/
  // when the query matches one POI. Both valid. Polling location.pathname
  // catches the single-POI case earliest — URL flips to /maps/place/ before
  // the detail panel finishes rendering h1.DUwDvf.
  const start = Date.now();
  while (Date.now() - start < 20_000) {
    if (
      document.querySelector(FEED) ||
      document.querySelector(DETAIL_NAME) ||
      location.pathname.startsWith('/maps/place/')
    ) return;
    await sleep(250);
  }
  throw new Error(
    `Neither results feed nor place detail appeared after searching "${keyword}". ` +
      `Path: ${location.pathname}.`,
  );
}

/**
 * Extract the currently-open place detail panel as a single Place. Used when
 * Maps redirected to /maps/place/ because the search query strongly matched
 * one POI — better than returning 0 results.
 *
 * The detail panel renders progressively after h1 appears: address, phone,
 * hours, and rating histogram populate over the next ~1s. Waiting after the
 * h1 hit avoids parsing a half-rendered panel that would leave most fields
 * null. Longer timeout (12s) covers slow connections + post-reload paint.
 */
export async function scrapeCurrentPlace(): Promise<Place | null> {
  const h1 = (await waitForSelector(DETAIL_NAME, 12_000)) as HTMLElement | null;
  if (!h1) return null;
  await sleep(1200);
  const panel = (h1.closest('[role="main"]') ?? document.body) as Element;
  return parseDetail(panel, { name: h1.textContent?.trim() || '' } as Place);
}

function extractLatLng(href: string | null): { lat: number | null; lng: number | null } {
  if (!href) return { lat: null, lng: null };
  // /maps/place/.../@-6.2,106.8,17z/ or !3dLAT!4dLNG
  const at = href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
  const bang = href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (bang) return { lat: parseFloat(bang[1]), lng: parseFloat(bang[2]) };
  return { lat: null, lng: null };
}

// Last-resort: scan a card's full markup for !3d/!4d coords. Some list-card
// hrefs no longer include `@lat,lng` but a nested data-* still carries them.
function extractLatLngFromHtml(html: string): { lat: number | null; lng: number | null } {
  const m = html.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return { lat: null, lng: null };
}

function parseCard(card: Element): Place | null {
  const link = card.querySelector('a[href*="/maps/place"]') as HTMLAnchorElement | null;
  // Name: bold title class, fallback to link aria-label.
  const name =
    card.querySelector('.qBF1Pd')?.textContent?.trim() ||
    link?.getAttribute('aria-label')?.trim() ||
    '';
  if (!name) return null;

  const ratingTxt = card.querySelector('.MW4etd')?.textContent?.trim();
  const reviewTxt = card.querySelector('.UY7F9')?.textContent?.replace(/[(),.]/g, '').trim();

  // Maps wraps the rating in a `.W4Efsd` AND nests info rows inside another
  // `.W4Efsd` parent. Keep only leaf rows: no `.MW4etd` child (rating wrapper)
  // and no `.W4Efsd` descendant (parent wrapper). What remains is the
  // "category · · address" row, descriptor row, and hours row.
  const meta = Array.from(card.querySelectorAll('.W4Efsd'))
    .filter((e) => !e.querySelector('.MW4etd') && !e.querySelector('.W4Efsd'))
    .map((e) => e.textContent?.trim() || '')
    .filter(Boolean);

  // First leaf row: "Category · <a11y noise> · Address". Split on `·` and
  // pick the address-looking segment (digits + letters), category = first.
  const firstParts = (meta[0] ?? '').split('·').map((s) => s.trim()).filter(Boolean);
  const category = firstParts[0] || null;
  const address =
    firstParts.find((p, i) => i > 0 && /\d/.test(p) && /[A-Za-z]/.test(p)) || null;

  let { lat, lng } = extractLatLng(link?.getAttribute('href') ?? null);
  if (lat == null || lng == null) {
    const fallback = extractLatLngFromHtml(card.outerHTML);
    lat = lat ?? fallback.lat;
    lng = lng ?? fallback.lng;
  }

  return {
    name,
    category,
    address,
    rating: ratingTxt ? parseFloat(ratingTxt.replace(',', '.')) : null,
    review_count: reviewTxt ? parseInt(reviewTxt, 10) || null : null,
    lat,
    lng,
    maps_url: link?.href ?? null,
  };
}

export async function scrapeGoogleMaps(delayMs = 800): Promise<Place[]> {
  const feed = (await waitForSelector(FEED)) as HTMLElement | null;
  if (!feed) return [];

  await autoScroll(feed, { step: 1000, delay: delayMs, maxRounds: 50 });

  const cards = feed.querySelectorAll('div[role="article"], div.Nv2PK');
  const places: Place[] = [];
  const seen = new Set<string>();

  cards.forEach((card) => {
    const p = parseCard(card);
    if (p && !seen.has(p.name + p.maps_url)) {
      seen.add(p.name + p.maps_url);
      places.push(p);
    }
  });

  return places;
}

/* ------------------------------------------------------------------ *
 * Detail-panel deep scrape.                                          *
 * Clicks each result to read fields the list cards omit: phone,      *
 * website, hours, price level, star breakdown, closed flag.          *
 * Selectors are best-effort — null when Maps doesn't render a field. *
 * ------------------------------------------------------------------ */

const DETAIL_NAME = 'h1.DUwDvf';
const BACK_BTN =
  'button[aria-label="Kembali"], button[aria-label="Back"], button.hYBOP';

const ariaText = (el: Element | null): string | null =>
  el?.getAttribute('aria-label')?.trim() || null;

/** Strip a leading "Label: " prefix (e.g. "Alamat: Jl ...", "Telepon: 0813..."). */
const stripLabel = (s: string | null): string | null =>
  s ? s.replace(/^[^:]{1,20}:\s*/, '').trim() || null : null;

function parsePhone(panel: Element): string | null {
  const btn = panel.querySelector('[data-item-id^="phone"]');
  if (!btn) return null;
  const id = btn.getAttribute('data-item-id') ?? '';
  const m = id.match(/phone:tel:(.+)$/);
  if (m) return m[1];
  return stripLabel(ariaText(btn));
}

function parseHours(panel: Element): Record<string, string> | null {
  // Hours table: <tr.y0skZc><td.ylH6lf>Day</td><td><li.G8aQO>HH.MM–HH.MM</li></td>
  const rows = panel.querySelectorAll('tr.y0skZc');
  const out: Record<string, string> = {};
  rows.forEach((row) => {
    const day = row.querySelector('td.ylH6lf')?.textContent?.trim();
    const time = row.querySelector('li.G8aQO')?.textContent?.trim();
    if (day && time) out[day] = time.replace(/\s+/g, ' ');
  });
  return Object.keys(out).length ? out : null;
}

function parseRatingBreakdown(panel: Element): number[] | null {
  // Histogram rows: aria-label like "5 stars, 120 reviews" / "5 bintang, 120 ulasan".
  const bars = panel.querySelectorAll('[role="img"][aria-label*="bintang"], [role="img"][aria-label*="stars"]');
  const counts: number[] = [];
  bars.forEach((b) => {
    const lbl = ariaText(b) ?? '';
    // Only single-digit star rows (1..5), not aggregate "4,7 bintang".
    const m = lbl.match(/^([1-5])\s*(bintang|stars)\D+([\d.,]+)/i);
    if (m) counts[5 - parseInt(m[1], 10)] = parseInt(m[3].replace(/[.,]/g, ''), 10) || 0;
  });
  return counts.length === 5 ? counts : null;
}

function parseDetail(panel: Element, base: Place): Place {
  const name = panel.querySelector(DETAIL_NAME)?.textContent?.trim() || base.name;
  const category = panel.querySelector('button.DkEaL')?.textContent?.trim() || base.category || null;

  const address =
    stripLabel(ariaText(panel.querySelector('[data-item-id="address"]'))) || base.address || null;

  const website =
    (panel.querySelector('a[data-item-id="authority"]') as HTMLAnchorElement | null)?.href ||
    stripLabel(ariaText(panel.querySelector('a[data-item-id="authority"]'))) ||
    null;

  const plus_code =
    stripLabel(ariaText(panel.querySelector('[data-item-id="oloc"]'))) || null;

  const ratingTxt = panel.querySelector('.MW4etd, div.fontDisplayLarge')?.textContent?.trim();
  const rating = ratingTxt ? parseFloat(ratingTxt.replace(',', '.')) || base.rating || null : base.rating ?? null;

  const text = (panel as HTMLElement).innerText || '';
  const priceMatch = text.match(/Rp\s?[\d.]+(?:\s?[–-]\s?Rp?\s?[\d.]+)?|\$\$?\$?\$?/);
  const price_level = priceMatch ? priceMatch[0].trim() : null;

  const service_options = ['Makan di tempat', 'Bawa pulang', 'Pengiriman', 'Dine-in', 'Takeaway', 'Delivery']
    .filter((s) => text.includes(s));

  const is_closed = /Tutup permanen|Permanently closed|Tutup sementara|Temporarily closed/i.test(text);

  // When the detail panel opens, Maps rewrites the URL to /maps/place/.../@LAT,LNG,17z/data=...
  // This is the canonical coordinate source — more reliable than the list-card href, which
  // recently dropped `@lat,lng` in many regions. Fall back to base.lat/lng (list pass) if
  // the URL hasn't updated yet, then to !3d/!4d scan over the panel markup.
  const urlMatch = location.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  let lat: number | null = urlMatch ? parseFloat(urlMatch[1]) : base.lat ?? null;
  let lng: number | null = urlMatch ? parseFloat(urlMatch[2]) : base.lng ?? null;
  if (lat == null || lng == null) {
    const fallback = extractLatLngFromHtml((panel as HTMLElement).outerHTML);
    lat = lat ?? fallback.lat;
    lng = lng ?? fallback.lng;
  }

  return {
    ...base,
    name,
    category,
    address,
    rating,
    lat,
    lng,
    phone: parsePhone(panel),
    website,
    plus_code,
    hours: parseHours(panel),
    service_options: service_options.length ? service_options : null,
    rating_breakdown: parseRatingBreakdown(panel),
    is_closed,
  };
}

/**
 * Open each result card, scrape its detail panel, merge into the list `Place`.
 * Throttled and capped to avoid rate-limiting. One failing card is skipped,
 * not fatal. Returns places enriched in place (same order).
 */
export async function scrapeGoogleMapsDeep(
  places: Place[],
  { limit = 60, delay = 800 } = {},
): Promise<Place[]> {
  const feed = document.querySelector(FEED);
  if (!feed) return places;

  const enriched = [...places];
  const n = Math.min(limit, enriched.length);

  for (let i = 0; i < n; i++) {
    try {
      const cards = feed.querySelectorAll('div[role="article"], div.Nv2PK');
      const card = cards[i];
      const click = (card?.querySelector('a[href*="/maps/place"]') ?? card) as HTMLElement | null;
      if (!click) continue;

      click.click();
      const h1 = await waitForSelector(DETAIL_NAME);
      if (!h1) continue;
      await sleep(delay);

      const panel = (h1.closest('[role="main"]') ?? document.body) as Element;
      enriched[i] = parseDetail(panel, enriched[i]);

      const back = document.querySelector(BACK_BTN) as HTMLElement | null;
      back?.click();
      await sleep(delay / 2);
    } catch {
      // brittle DOM — skip this card, keep the list-pass data
    }
  }

  return enriched;
}
