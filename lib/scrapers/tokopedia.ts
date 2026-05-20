import type { Product } from '@/lib/types';
import { parseIndoNumber } from '@/utils/scroll';

/**
 * Tokopedia scraper. Primary path: parse intercepted GraphQL search responses
 * (SearchProductQueryV4 / ace_search). Fallback: DOM product cards.
 */

export const TOKOPEDIA_API_PATTERNS = [
  /graphql\/SearchProductV5Query/,
  /graphql\/SearchProductQueryV4/,
  /ace_search_product/,
];

interface TokpedProduct {
  name?: string;
  price?: string | number;
  priceInt?: number;
  rating?: number | string;
  ratingAverage?: string;
  countReview?: number;
  url?: string;
  imageUrl?: string;
  shop?: { name?: string };
  labelGroups?: Array<{ title?: string }>;
}

function fromProduct(p: TokpedProduct): Product | null {
  if (!p?.name) return null;
  const soldLabel = p.labelGroups?.find((l) => /terjual/i.test(l.title ?? ''))?.title;
  return {
    source: 'tokopedia',
    name: p.name,
    price:
      p.priceInt ??
      (typeof p.price === 'number' ? p.price : parseIndoNumber(String(p.price ?? ''))),
    rating: p.ratingAverage ? parseFloat(p.ratingAverage) : (typeof p.rating === 'number' ? p.rating : null),
    sold_count: soldLabel ? parseIndoNumber(soldLabel) : null,
    seller: p.shop?.name ?? null,
    product_url: p.url ?? null,
    image_url: p.imageUrl ?? null,
  };
}

/** Recursively find arrays of product-like objects in a GraphQL response. */
function findProducts(node: any, out: TokpedProduct[]): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((n) => findProducts(n, out));
    return;
  }
  if (node.name && (node.url || node.imageUrl) && (node.price != null || node.priceInt != null)) {
    out.push(node as TokpedProduct);
  }
  for (const k of Object.keys(node)) findProducts(node[k], out);
}

export function parseTokopediaApi(body: string): Product[] {
  try {
    const data = JSON.parse(body);
    const found: TokpedProduct[] = [];
    findProducts(data, found);
    return found.map(fromProduct).filter((p): p is Product => p !== null);
  } catch {
    return [];
  }
}

/** DOM fallback: scrape visible product cards on a search results page. */
export function scrapeTokopediaDom(): Product[] {
  const cards = document.querySelectorAll('[data-testid="divProductWrapper"], div.css-5wh65g');
  const products: Product[] = [];
  cards.forEach((card) => {
    const link = card.querySelector('a[href]') as HTMLAnchorElement | null;
    const name = card.querySelector('[data-testid="spnSRPProdName"]')?.textContent?.trim()
      || card.querySelector('span')?.textContent?.trim() || '';
    if (!name) return;
    const priceTxt = card.textContent?.match(/Rp[\d.,]+/)?.[0] ?? '';
    const soldTxt = card.textContent?.match(/[\d.,]+\+?\s*(rb|jt)?\s*terjual/i)?.[0] ?? '';
    products.push({
      source: 'tokopedia',
      name,
      price: parseIndoNumber(priceTxt.replace('Rp', '')),
      rating: null,
      sold_count: parseIndoNumber(soldTxt),
      seller: null,
      product_url: link?.href ?? null,
      image_url: (card.querySelector('img') as HTMLImageElement | null)?.src ?? null,
    });
  });
  return products;
}
