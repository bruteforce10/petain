import type { Place } from '@/lib/types';
import { autoScroll, waitForSelector } from '@/utils/scroll';

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
