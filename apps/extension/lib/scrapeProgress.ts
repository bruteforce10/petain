import type { ScrapeProgress } from '@/lib/types';

// Observable singleton bridging the in-page scrape kernel to the sidebar React
// tree. Both run in the SAME content script, so progress streams in-process —
// no chrome messaging. `useSyncExternalStore(subscribe, getProgress)` re-renders
// the sidebar on every emit.
//
// State is also mirrored to chrome.storage.session so a Maps single-POI reload
// (which re-injects the content script mid-scrape, see STATE_KEY resume) can
// restore the live list instead of flashing empty.

const SESSION_KEY = 'terramap.scrapeProgress';

const initial: ScrapeProgress = {
  phase: 'idle',
  phaseStep: 0,
  phaseTotal: 3,
  label: '',
  current: 0,
  total: 0,
  items: [],
};

let state: ScrapeProgress = initial;
const subscribers = new Set<() => void>();

export const getProgress = (): ScrapeProgress => state;

export const subscribe = (fn: () => void): (() => void) => {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
};

export const setProgress = (next: ScrapeProgress): void => {
  state = next;
  subscribers.forEach((fn) => fn());
  void chrome.storage.session.set({ [SESSION_KEY]: next }).catch(() => {});
};

export const resetProgress = (): void => setProgress(initial);

// Restore a persisted snapshot after a content-script re-inject. No-op if none
// or if it's already terminal (done/error from a prior run we don't want to
// resurrect on a fresh page load).
export async function restoreProgress(): Promise<void> {
  try {
    const stored = await chrome.storage.session.get(SESSION_KEY);
    const saved = stored[SESSION_KEY] as ScrapeProgress | undefined;
    if (saved && saved.phase !== 'idle' && saved.phase !== 'done' && saved.phase !== 'error') {
      state = saved;
      subscribers.forEach((fn) => fn());
    }
  } catch {
    // session storage unavailable — start clean
  }
}
