import type { Place } from '@terramap/types';
import { autoScroll, sleep, waitForSelector } from './scroll';

/**
 * Scrape Google Maps search-result feed (the left-hand list panel).
 * DOM-based: Maps does not expose a clean JSON API. Selectors are best-effort
 * and may break when Maps ships a redesign — adjust here if scraping yields 0.
 */

const FEED = 'div[role="feed"]';

function extractLatLng(href: string | null): { lat: number | null; lng: number | null } {
  if (!href) return { lat: null, lng: null };
  // /maps/place/.../@-6.2,106.8,17z/ or !3dLAT!4dLNG
  const at = href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
  const bang = href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (bang) return { lat: parseFloat(bang[1]), lng: parseFloat(bang[2]) };
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

  // Category + address live in two stacked .W4Efsd rows; grab text fragments.
  const meta = Array.from(card.querySelectorAll('.W4Efsd'))
    .map((e) => e.textContent?.trim() || '')
    .filter(Boolean);

  const { lat, lng } = extractLatLng(link?.getAttribute('href') ?? null);

  return {
    name,
    category: meta[0]?.split('·')[0]?.trim() || null,
    address: meta.find((m) => /\d/.test(m))?.replace(/·/g, '').trim() || null,
    rating: ratingTxt ? parseFloat(ratingTxt.replace(',', '.')) : null,
    review_count: reviewTxt ? parseInt(reviewTxt, 10) || null : null,
    lat,
    lng,
    maps_url: link?.href ?? null,
  };
}

export async function scrapeGoogleMaps(): Promise<Place[]> {
  if (!location.pathname.includes('/maps/search/')) {
    throw new Error(
      `Maps landed on non-search page: ${location.pathname}. ` +
        `Lower the zoom or broaden the keyword so Maps stays on /maps/search/.`,
    );
  }
  const feed = (await waitForSelector(FEED)) as HTMLElement | null;
  if (!feed) return [];

  await autoScroll(feed, { step: 1000, delay: 800, maxRounds: 50 });

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

  return {
    ...base,
    name,
    category,
    address,
    rating,
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
