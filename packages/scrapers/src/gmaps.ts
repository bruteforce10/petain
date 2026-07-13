import type { Place, ScrapeProgressItem } from '@terramap/types';
import { jitteredSleep, sleep, waitForSelector } from './scroll';

/**
 * Fine-grained progress callback. Fired once per place as it is parsed (list
 * pass) or enriched (deep pass), so the on-page sidebar can stream the live
 * list. Optional everywhere — callers that don't pass it pay nothing.
 */
export type ItemReporter = (info: {
  item: ScrapeProgressItem;
  current: number;
  total: number;
}) => void;

const toProgressItem = (p: Place): ScrapeProgressItem => ({
  name: p.name,
  rating: p.rating ?? null,
  category: p.category ?? null,
  address: p.address ?? null,
});

/**
 * Scrape Google Maps search-result feed (the left-hand list panel).
 * DOM-based: Maps does not expose a clean JSON API. Selectors are best-effort
 * and may break when Maps ships a redesign — adjust here if scraping yields 0.
 */

const FEED = 'div[role="feed"]';
const CARD_SELECTOR = 'div[role="article"], div.Nv2PK';
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

  // When re-searching from an already-open /maps/place/ page (resumed run),
  // the old detail panel satisfies the completion checks below before OUR
  // query was even processed. Completion must correspond to a navigation the
  // submit triggered, so remember where we started.
  const startHref = location.href;

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
  // the detail panel finishes rendering h1.DUwDvf. The detail/place outcome
  // additionally requires the URL to have moved off startHref so a leftover
  // panel from before the submit can't count as completion.
  const start = Date.now();
  while (Date.now() - start < 20_000) {
    if (document.querySelector(FEED)) return;
    if (
      location.href !== startHref &&
      (document.querySelector(DETAIL_NAME) || location.pathname.startsWith('/maps/place/'))
    ) return;
    await sleep(250);
  }
  // Started on a place page and Maps kept us there: the query resolves to the
  // POI we are already viewing. Treat as a valid single-place outcome.
  if (location.pathname.startsWith('/maps/place/') && document.querySelector(DETAIL_NAME)) {
    return;
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

/**
 * Stable Google place id: ONLY the `!1s0x..:0x..` CID pair, which names the POI
 * itself. We deliberately do NOT fall back to a bare `0x..:0x..` scan — the
 * `data=` blob in a list-card href carries several unrelated hex pairs that
 * Google re-stamps every render, so a bare scan returns a *different* value for
 * each duplicate card of the same place. That false-uniqueness is exactly what
 * let the dupes survive de-dup. Null when the href has no tagged CID.
 */
function placeFeatureId(href: string | null | undefined): string | null {
  if (!href) return null;
  const tagged = href.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  return tagged ? tagged[1].toLowerCase() : null;
}

const normalizeName = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Loose place-name equality between a detail-panel h1 and a list-card title.
 * Maps renders the same POI with small variations (branch suffix "(Braga)",
 * casing, spacing), so accept containment either way after normalization.
 */
export function namesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeName(a ?? '');
  const nb = normalizeName(b ?? '');
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** True when the address-bar URL carries the place's tagged CID pair. */
function urlHasCid(place: Place): boolean {
  const cid = placeFeatureId(place.maps_url);
  if (!cid) return false;
  let href = location.href;
  try {
    href = decodeURIComponent(href);
  } catch {
    // keep raw href
  }
  return href.toLowerCase().includes(cid);
}

/**
 * Identity key for de-duplicating list results.
 *
 * Primary key is normalized name+address: Google's search feed repeats the same
 * POI many times (sponsored + organic + scroll re-fetches), each repeat a fresh
 * snapshot with its own review count and its own per-render `maps_url` — but the
 * name and full address are byte-for-byte identical, and no two genuinely
 * distinct businesses share an identical name AND full street address. That
 * makes name+address the only field pair stable enough to collapse the dupes.
 *
 * The tagged CID and coords are fallbacks only for the rare card that parses no
 * address. Name-only is the last resort.
 */
function placeDedupKey(p: Place): string {
  const name = (p.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const addr = (p.address || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (name && addr) return `na:${name}|${addr}`;
  const fid = placeFeatureId(p.maps_url);
  if (fid) return `fid:${fid}`;
  if (name && p.lat != null && p.lng != null) {
    return `nc:${name}|${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
  }
  return `n:${name}`;
}

/**
 * Collapse duplicate places by {@link placeDedupKey}, keeping the first
 * occurrence. Run as a final safety pass after the deep scrape: the detail
 * panel rewrites name/address with fuller values, so two list rows that looked
 * distinct (one had a truncated address) can resolve to the same business.
 */
export function dedupePlaces(places: Place[]): Place[] {
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const p of places) {
    const key = placeDedupKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function collectVisiblePlaces(
  feed: Element,
  seen: Set<string>,
  places: Place[],
  maxResults: number,
  onItem?: ItemReporter,
): number {
  let added = 0;
  const cards = feed.querySelectorAll(CARD_SELECTOR);
  cards.forEach((card) => {
    if (places.length >= maxResults) return;
    const p = parseCard(card);
    if (!p) return;
    const key = placeDedupKey(p);
    if (seen.has(key)) return;
    seen.add(key);
    places.push(p);
    added++;
    // Stream each newly-collected place so the on-page sidebar can show a live
    // list. Total is unknown mid-scroll, so report it as the running count.
    onItem?.({ item: toProgressItem(p), current: places.length, total: places.length });
  });
  return added;
}

function feedShowsEnd(feed: Element): boolean {
  const text = ((feed as HTMLElement).innerText || '').toLowerCase();
  return (
    text.includes("you've reached the end of the list") ||
    text.includes('you have reached the end of the list') ||
    text.includes('anda telah mencapai akhir daftar') ||
    text.includes('akhir daftar') ||
    text.includes('tidak ada hasil lainnya')
  );
}

async function resetFeedToTop(feed: HTMLElement, delayMs: number): Promise<void> {
  feed.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  feed.dispatchEvent(new Event('scroll', { bubbles: true }));
  await sleep(Math.max(300, Math.min(delayMs, 900)));
}

/**
 * Scroll the feed and ALSO emit a `wheel` event. A bare scrollBy fires no wheel
 * events at all, whereas real users scroll lazy lists with the wheel/trackpad —
 * dispatching one makes the scroll pattern read less like a script to Maps'
 * lazy-load listeners. dy is randomized a little at the call sites so the step
 * size isn't a constant either.
 */
function feedScrollBy(feed: HTMLElement, dy: number): void {
  feed.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, bubbles: true }));
  feed.scrollBy(0, dy);
}

/**
 * Locate the feed card for a place. The deep pass walks the list top→bottom, so
 * this only ever scrolls DOWNWARD from the current position and never resets to
 * the top mid-pass — re-sweeping the whole list on every locate is exactly what
 * made the feed appear to scroll endlessly after each detail open.
 *
 * Matching prefers the stable tagged CID (`!1s` pair) over name+address: Maps
 * re-ranks/re-renders the feed after a detail Back and parseCard's address is
 * heuristic, so a strict name+address key can miss a card that is actually on
 * screen. The CID names the POI itself and is render-stable, so it survives the
 * re-render; we fall back to the full name+address key (collision-safe for
 * same-name chains) when no CID is present.
 */
async function locateCardForPlace(
  feed: HTMLElement,
  place: Place,
  delayMs: number,
): Promise<Element | null> {
  const wantCid = placeFeatureId(place.maps_url);
  const wantKey = placeDedupKey(place);

  const matches = (card: Element): boolean => {
    const parsed = parseCard(card);
    if (!parsed) return false;
    if (wantCid) {
      const cid = placeFeatureId(parsed.maps_url);
      if (cid) return cid === wantCid; // stable CID is authoritative when present
    }
    return placeDedupKey(parsed) === wantKey;
  };

  const findVisible = () =>
    Array.from(feed.querySelectorAll(CARD_SELECTOR)).find(matches) ?? null;

  let found = findVisible();
  if (found) return found;

  // Downward-only sweep: the target is at or below the current position because
  // the deep pass visits cards in list order. Bounded + early-break on stall /
  // end-of-list so a card that genuinely can't be re-located can't burn the
  // whole list — it fails fast and the deep pass keeps its list-pass data.
  let stable = 0;
  for (let i = 0; i < 40; i++) {
    const before = feed.scrollTop;
    feedScrollBy(feed, Math.max(700, Math.round(feed.clientHeight * (0.75 + Math.random() * 0.2))));
    await jitteredSleep(delayMs);

    found = findVisible();
    if (found) return found;

    const after = feed.scrollTop;
    if (Math.abs(after - before) < 4) {
      stable++;
      if (stable >= 2 || feedShowsEnd(feed)) break;
    } else {
      stable = 0;
    }
  }

  return findVisible();
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

export async function scrapeGoogleMaps(
  delayMs = 800,
  { maxResults = Number.POSITIVE_INFINITY, maxRounds = 120 } = {},
  onItem?: ItemReporter,
): Promise<Place[]> {
  const feed = (await waitForSelector(FEED)) as HTMLElement | null;
  if (!feed) return [];

  const places: Place[] = [];
  const seen = new Set<string>();
  let stableRounds = 0;

  await resetFeedToTop(feed, delayMs);

  for (let i = 0; i < maxRounds && places.length < maxResults; i++) {
    const added = collectVisiblePlaces(feed, seen, places, maxResults, onItem);
    if (added === 0) stableRounds++;
    else stableRounds = 0;

    if (feedShowsEnd(feed) && stableRounds >= 2) break;

    const beforeTop = feed.scrollTop;
    feedScrollBy(feed, Math.max(900, Math.round(feed.clientHeight * (0.8 + Math.random() * 0.2))));
    await jitteredSleep(delayMs);

    const afterTop = feed.scrollTop;
    if (Math.abs(afterTop - beforeTop) < 4) {
      stableRounds++;
      if (stableRounds >= 5) break;
    }
  }

  collectVisiblePlaces(feed, seen, places, maxResults, onItem);

  return places;
}

/* ------------------------------------------------------------------ *
 * Detail-panel deep scrape.                                          *
 * Clicks each result to read fields the list cards omit: phone,      *
 * website, hours, price level, star breakdown, closed flag.          *
 * Selectors are best-effort — null when Maps doesn't render a field. *
 * ------------------------------------------------------------------ */

const DETAIL_NAME = 'h1.DUwDvf';
// Current Maps closes the detail panel with a "Tutup"/"Close" icon button
// INSIDE the panel's [role="main"] (must be scoped there — the omnibox clear
// button is also aria-label="Tutup"). The old Kembali/Back/.hYBOP controls no
// longer exist; kept only as a legacy fallback for older DOM variants.
const CLOSE_BTN = 'button[aria-label="Tutup"], button[aria-label="Close"]';
const LEGACY_BACK_BTN =
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
  // Pre-fill with zeros: index-assigning a fresh array and checking `.length`
  // would pass with `undefined` holes (e.g. a star level Maps renders out of
  // order or with a differing label), which serialize to null and store a
  // malformed breakdown. Require all 5 rows to have actually matched.
  const counts = [0, 0, 0, 0, 0];
  let matched = 0;
  bars.forEach((b) => {
    const lbl = ariaText(b) ?? '';
    // Only single-digit star rows (1..5), not aggregate "4,7 bintang".
    const m = lbl.match(/^([1-5])\s*(bintang|stars)\D+([\d.,]+)/i);
    if (m) {
      counts[5 - parseInt(m[1], 10)] = parseInt(m[3].replace(/[.,]/g, ''), 10) || 0;
      matched++;
    }
  });
  return matched === 5 ? counts : null;
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
 * Wait until the detail panel actually shows the place we just clicked.
 *
 * waitForSelector(DETAIL_NAME) is NOT enough here: the previous card's h1 stays
 * mounted for a beat after the next card is clicked, so an "any h1 exists" wait
 * resolves instantly with the OLD node. parseDetail then reads the wrong
 * place, several rows come out byte-identical, and the final dedupe collapses
 * them — the "20 scraped but only 2 saved" failure. Accept the panel only when
 * the URL carries the clicked card's CID or the h1 text matches its name; a
 * mere text change from the pre-click snapshot is the weakest accepted signal
 * (covers the rare CID-less card). Null on timeout — caller keeps list data.
 */
async function waitForDetailPanel(
  place: Place,
  prevH1Text: string | null,
  timeoutMs = 10_000,
): Promise<HTMLElement | null> {
  const hasCid = placeFeatureId(place.maps_url) != null;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const h1 = document.querySelector(DETAIL_NAME) as HTMLElement | null;
    const text = h1?.textContent?.trim() ?? '';
    if (h1 && text) {
      if (urlHasCid(place)) return h1;
      if (namesMatch(text, place.name)) return h1;
      if (!hasCid && prevH1Text !== null && text !== prevH1Text) return h1;
    }
    await sleep(150);
  }
  return null;
}

/**
 * Close the open place-detail panel (if any) and give the list focus back.
 * Best-effort: NEVER falls back to history.back() — Maps sometimes services
 * that with a full document reload, which tears down the content script
 * mid-scrape and orphans the whole run. An unclosed panel is harmless: the
 * results feed stays mounted beside it.
 */
async function closeDetailPanel(delayMs: number): Promise<boolean> {
  const h1 = document.querySelector(DETAIL_NAME);
  if (!h1) return true;
  const panel = h1.closest('[role="main"]');
  const btn = (panel?.querySelector(CLOSE_BTN) ??
    document.querySelector(LEGACY_BACK_BTN)) as HTMLElement | null;
  if (!btn) return false;
  btn.click();
  const deadline = Date.now() + Math.max(1500, delayMs);
  while (Date.now() < deadline) {
    if (!document.querySelector(DETAIL_NAME)) return true;
    await sleep(120);
  }
  return !document.querySelector(DETAIL_NAME);
}

/**
 * Open each result card, scrape its detail panel, merge into the list `Place`.
 * Throttled and capped to avoid rate-limiting. One failing card is skipped,
 * not fatal. Returns places enriched in place (same order).
 */
export async function scrapeGoogleMapsDeep(
  places: Place[],
  { limit = 60, delay = 800 } = {},
  onItem?: ItemReporter,
): Promise<Place[]> {
  const feed0 = document.querySelector(FEED) as HTMLElement | null;
  if (!feed0) return places;

  const enriched = [...places];
  const n = Math.min(limit, enriched.length);

  // The list pass leaves the feed parked at the BOTTOM, but the deep pass walks
  // the list top→bottom. Reset to the top ONCE here so card 0 is found by a
  // short downward sweep instead of falling through to a full re-scroll, and so
  // locateCardForPlace can stay downward-only for the rest of the pass.
  await resetFeedToTop(feed0, delay);

  // A run of cards that can't be opened/relocated means the DOM broke (e.g. Back
  // selector went stale after a Maps redesign). Bail instead of silently
  // grinding through the whole budget producing un-enriched rows.
  let consecutiveFailures = 0;
  const fail = (): boolean => ++consecutiveFailures >= 5;

  for (let i = 0; i < n; i++) {
    try {
      // Maps virtualizes the feed, so off-screen cards are often unmounted.
      // Scroll-locate the exact result before opening its detail panel. The
      // previous card's panel is deliberately left open: the feed stays
      // mounted beside it, so the next card is clicked straight from the list
      // and the panel content swaps in place — no Back navigation at all
      // (history.back() sometimes full-reloads, killing the content script).
      const feed = document.querySelector(FEED) as HTMLElement | null;
      if (!feed) {
        if (fail()) break;
        continue;
      }
      let card = await locateCardForPlace(feed, enriched[i], delay);
      if (!card) {
        // Narrow layouts can hide the list while a panel is open — close the
        // panel and retry the locate once before giving up on this card.
        // Re-query the feed: closing the panel can re-render the list node.
        await closeDetailPanel(delay);
        const freshFeed = document.querySelector(FEED) as HTMLElement | null;
        if (freshFeed) card = await locateCardForPlace(freshFeed, enriched[i], delay);
      }
      const click = (card?.querySelector('a[href*="/maps/place"]') ?? card) as HTMLElement | null;
      if (!click) {
        onItem?.({ item: toProgressItem(enriched[i]), current: i + 1, total: n });
        if (fail()) break;
        continue;
      }

      const prevH1Text = document.querySelector(DETAIL_NAME)?.textContent?.trim() ?? null;
      click.click();
      const h1 = await waitForDetailPanel(enriched[i], prevH1Text);
      if (!h1) {
        onItem?.({ item: toProgressItem(enriched[i]), current: i + 1, total: n });
        if (fail()) break;
        continue;
      }
      // Fields below the h1 (address, phone, hours) populate over the next
      // ~1s. Wait, then re-resolve the panel from the LIVE h1 — never from a
      // node captured around the click, which Maps may since have detached.
      await jitteredSleep(delay);
      const h1Live = (document.querySelector(DETAIL_NAME) as HTMLElement | null) ?? h1;
      if (!namesMatch(h1Live.textContent?.trim(), enriched[i].name) && !urlHasCid(enriched[i])) {
        // Panel drifted to some other place while settling — keeping the list
        // row beats writing another place's data into it (identical rows are
        // exactly what the final dedupe would collapse into a 2-row result).
        onItem?.({ item: toProgressItem(enriched[i]), current: i + 1, total: n });
        if (fail()) break;
        continue;
      }
      const panel = (h1Live.closest('[role="main"]') ?? document.body) as Element;
      enriched[i] = parseDetail(panel, enriched[i]);
      consecutiveFailures = 0;
      onItem?.({ item: toProgressItem(enriched[i]), current: i + 1, total: n });

      // Periodic cooldown: opening hundreds of place panels back-to-back at a
      // steady cadence is the signal most likely to trip Maps' rate-limit /
      // "unusual traffic" heuristics. A jittered rest every ~25 cards makes the
      // run bursty-then-idle like a human instead of a constant stream.
      if ((i + 1) % 25 === 0) await jitteredSleep(2500, 1, 2.5);
    } catch (err) {
      // brittle DOM — skip this card, keep the list-pass data, but surface it
      // so a systemic break isn't completely silent.
      console.warn('[terramap/scrape] deep card failed:', err);
      onItem?.({ item: toProgressItem(enriched[i]), current: i + 1, total: n });
      if (fail()) break;
    }
  }

  // Leave the page parked on the results list rather than a detail panel.
  await closeDetailPanel(delay);

  // Final safety net: the deep pass rewrote name/address with the detail
  // panel's fuller values, which can expose duplicates the list pass missed
  // (e.g. a list card that had truncated the address). Collapse them once more.
  return dedupePlaces(enriched);
}
