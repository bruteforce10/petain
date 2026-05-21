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

/** Product anchor URL: tokopedia.com/<shop-slug>/<product-slug>-<id>. */
const PRODUCT_URL = /tokopedia\.com\/[\w.-]+\/[\w-]+-\d{6,}/;

/** Derive a readable seller name from the shop slug in a product URL. */
function sellerFromUrl(href: string): string | null {
  try {
    const slug = new URL(href).pathname.split('/').filter(Boolean)[0];
    if (!slug) return null;
    return slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  } catch {
    return null;
  }
}

/**
 * DOM fallback: scrape visible product cards on a search results page.
 *
 * Tokopedia ships hashed (emotion/CSS-module) classnames with no stable
 * data-testid on cards, so we anchor on the product URL pattern and read
 * fields by text shape instead of fragile selectors.
 */
export function scrapeTokopediaDom(): Product[] {
  const anchors = [...document.querySelectorAll('a[href]')].filter((a) =>
    PRODUCT_URL.test((a as HTMLAnchorElement).href),
  ) as HTMLAnchorElement[];

  const products: Product[] = [];
  for (const anchor of anchors) {
    const spans = [...anchor.querySelectorAll('span')]
      .map((s) => s.textContent?.trim() ?? '')
      .filter(Boolean);

    // Name = longest span that isn't price / sold / discount / rating.
    const name = spans
      .filter(
        (t) =>
          !/^Rp/.test(t) &&
          !/terjual/i.test(t) &&
          !/^\d+%$/.test(t) &&
          !/^[0-5](\.\d)?$/.test(t),
      )
      .reduce((longest, t) => (t.length > longest.length ? t : longest), '');
    if (!name) continue;

    const priceTxt = (anchor.textContent ?? '').match(/Rp[\d.]+/)?.[0] ?? '';
    const soldTxt = spans.find((t) => /terjual/i.test(t)) ?? '';
    const ratingTxt = spans.find((t) => /^[0-5]\.\d$/.test(t));

    products.push({
      source: 'tokopedia',
      name,
      price: parseIndoNumber(priceTxt.replace('Rp', '')),
      rating: ratingTxt ? parseFloat(ratingTxt) : null,
      sold_count: parseIndoNumber(soldTxt),
      seller: sellerFromUrl(anchor.href),
      product_url: anchor.href,
      image_url: (anchor.querySelector('img') as HTMLImageElement | null)?.src ?? null,
    });
  }
  return products;
}
