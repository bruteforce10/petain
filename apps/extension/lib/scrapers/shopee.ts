import type { Product } from '@/lib/types';
import { parseIndoNumber } from '@/utils/scroll';

/**
 * Shopee scraper. Primary path: parse intercepted JSON from the internal
 * search API (/api/v4/search/search_items). Fallback: DOM product cards.
 */

export const SHOPEE_API_PATTERNS = [
  /\/api\/v4\/search\/search_items/,
  /\/api\/v4\/recommend\/recommend/,
];

interface ShopeeItemBasic {
  name?: string;
  price?: number; // in micro-units (x100000)
  price_min?: number;
  historical_sold?: number;
  sold?: number;
  item_rating?: { rating_star?: number };
  shopid?: number;
  itemid?: number;
  image?: string;
  shop_name?: string;
}

function fromItem(it: ShopeeItemBasic): Product | null {
  const basic: ShopeeItemBasic = (it as any).item_basic ?? it;
  if (!basic?.name) return null;
  const priceMicro = basic.price ?? basic.price_min;
  return {
    source: 'shopee',
    name: basic.name,
    price: priceMicro != null ? Math.round(priceMicro / 100000) : null,
    rating: basic.item_rating?.rating_star ?? null,
    sold_count: basic.historical_sold ?? basic.sold ?? null,
    seller: basic.shop_name ?? null,
    product_url:
      basic.shopid && basic.itemid
        ? `https://shopee.co.id/product/${basic.shopid}/${basic.itemid}`
        : null,
    image_url: basic.image
      ? `https://cf.shopee.co.id/file/${basic.image}`
      : null,
  };
}

/** Parse an intercepted Shopee API JSON body into products. */
export function parseShopeeApi(body: string): Product[] {
  try {
    const data = JSON.parse(body);
    const items: any[] = data.items ?? data.data?.items ?? data.sections?.flatMap((s: any) => s.data?.item ?? []) ?? [];
    return items.map(fromItem).filter((p): p is Product => p !== null);
  } catch {
    return [];
  }
}

/**
 * DOM fallback: scrape visible product cards on a search results page.
 *
 * Shopee ships hashed/Tailwind classnames, but each search card is a
 * `div[role="group"]` whose `aria-label` carries the product name
 * ("Product card: <name>"). We anchor on that stable attribute + the
 * `-i.<shopid>.<itemid>` URL shape and read price/sold by text instead of
 * fragile selectors. Rating/seller aren't present in search cards.
 */
export function scrapeShopeeDom(): Product[] {
  const cards = document.querySelectorAll('div[role="group"][aria-label^="Product card:"]');
  const products: Product[] = [];
  cards.forEach((card) => {
    const name = (card.getAttribute('aria-label') ?? '')
      .replace(/^Product card:\s*/, '')
      .trim();
    if (!name) return;

    const link = card.querySelector('a[href*="shopee.co.id"]') as HTMLAnchorElement | null;
    const rawHref = link?.getAttribute('href') ?? '';
    let product_url: string | null = null;
    if (rawHref) {
      const abs = new URL(rawHref, location.origin);
      const m = abs.pathname.match(/-i\.(\d+)\.(\d+)/);
      // Canonical /product/<shopid>/<itemid> so DOM items dedup against the
      // API path (see fromItem product_url).
      product_url = m
        ? `https://shopee.co.id/product/${m[1]}/${m[2]}`
        : `${abs.origin}${abs.pathname}`;
    }

    // Price: the amount sits in the span right after the "Rp" span. Reading the
    // whole card's textContent would glue adjacent numbers together (no
    // whitespace between nodes), so we target the specific span.
    const spans = [...card.querySelectorAll('span')];
    const rpSpan = spans.find((s) => s.textContent?.trim() === 'Rp');
    let priceTxt = rpSpan?.nextElementSibling?.textContent?.trim() ?? '';
    if (!/^[\d.,]+$/.test(priceTxt)) {
      // Fallback: shortest span that is a bare Indo-formatted number.
      priceTxt =
        spans
          .map((s) => s.textContent?.trim() ?? '')
          .filter((t) => /^\d{1,3}(\.\d{3})+$/.test(t))
          .sort((a, b) => a.length - b.length)[0] ?? '';
    }

    // Sold: the shortest element whose text mentions "terjual" (the leaf node),
    // so we don't pick up an ancestor that also contains the price.
    let soldTxt = '';
    card.querySelectorAll('*').forEach((el) => {
      const t = el.textContent?.trim() ?? '';
      if (/terjual/i.test(t) && (!soldTxt || t.length < soldTxt.length)) soldTxt = t;
    });

    const webpSrcset = card.querySelector('picture source[type="image/webp"]')?.getAttribute('srcset');
    const image_url =
      webpSrcset?.split(',')[0]?.trim().split(/\s+/)[0] ??
      (card.querySelector('img') as HTMLImageElement | null)?.src ??
      null;

    products.push({
      source: 'shopee',
      name,
      price: parseIndoNumber(priceTxt.replace('Rp', '')),
      rating: null,
      sold_count: parseIndoNumber(soldTxt),
      seller: null,
      product_url,
      image_url,
    });
  });
  return products;
}
