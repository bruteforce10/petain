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

/** DOM fallback: scrape visible product cards on a search results page. */
export function scrapeShopeeDom(): Product[] {
  const cards = document.querySelectorAll('[data-sqe="item"], li.shopee-search-item-result__item');
  const products: Product[] = [];
  cards.forEach((card) => {
    const link = card.querySelector('a[href]') as HTMLAnchorElement | null;
    const name = card.querySelector('[data-sqe="name"]')?.textContent?.trim() || '';
    if (!name) return;
    const priceTxt = card.textContent?.match(/Rp[\d.,]+/)?.[0] ?? '';
    const soldTxt = card.textContent?.match(/[\d.,]+\s*(rb|jt)?\s*terjual/i)?.[0] ?? '';
    products.push({
      source: 'shopee',
      name,
      price: parseIndoNumber(priceTxt.replace('Rp', '')),
      rating: null,
      sold_count: parseIndoNumber(soldTxt),
      seller: null,
      product_url: link ? new URL(link.getAttribute('href')!, location.origin).href : null,
      image_url: (card.querySelector('img') as HTMLImageElement | null)?.src ?? null,
    });
  });
  return products;
}
