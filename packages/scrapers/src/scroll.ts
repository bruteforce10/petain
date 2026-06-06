/** Auto-scroll helpers + wait-for-DOM utilities for lazy-loaded lists. */

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * sleep with ±jitter so automated pacing isn't metronomic. A near-constant
 * inter-action interval over hundreds of scroll/click steps is one of the
 * cheapest automation tells; spreading each wait across [factorMin, factorMax]×ms
 * makes the cadence read more like a human and harder to flag heuristically.
 */
export const jitteredSleep = (ms: number, factorMin = 0.7, factorMax = 1.4) =>
  sleep(Math.round(ms * (factorMin + Math.random() * (factorMax - factorMin))));

/**
 * Scroll an element (or window) repeatedly until height stops growing or
 * maxRounds reached. Used to force lazy lists (Maps results, product grids)
 * to load all items.
 */
export async function autoScroll(
  target: HTMLElement | null,
  { step = 800, delay = 700, maxRounds = 40 } = {},
): Promise<void> {
  const el = target;
  let lastHeight = -1;
  let stable = 0;

  for (let i = 0; i < maxRounds; i++) {
    if (el) {
      el.scrollBy(0, step);
    } else {
      window.scrollBy(0, step);
    }
    await sleep(delay);

    const h = el ? el.scrollHeight : document.body.scrollHeight;
    if (h === lastHeight) {
      stable++;
      if (stable >= 3) break;
    } else {
      stable = 0;
      lastHeight = h;
    }
  }
}

/** Resolve once selector exists, or null after timeout. */
export function waitForSelector(
  selector: string,
  timeout = 8000,
): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    const obs = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        obs.disconnect();
        resolve(el);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      obs.disconnect();
      resolve(document.querySelector(selector));
    }, timeout);
  });
}

/** Parse "1,2rb terjual" / "1.2k sold" / "Rp 25.000" style strings to number. */
export function parseIndoNumber(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.toLowerCase().replace(/\s/g, '');
  const m = s.match(/([\d.,]+)\s*(rb|jt|k|m)?/);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
  if (Number.isNaN(n)) return null;
  const unit = m[2];
  if (unit === 'rb' || unit === 'k') n *= 1_000;
  else if (unit === 'jt' || unit === 'm') n *= 1_000_000;
  return Math.round(n);
}
