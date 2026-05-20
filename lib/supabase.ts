import { createClient } from '@supabase/supabase-js';

// WXT exposes env vars prefixed WXT_ on import.meta.env.
const url = import.meta.env.WXT_SUPABASE_URL as string;
const anonKey = import.meta.env.WXT_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  // Surface misconfig early during dev.
  console.warn('[terramap] WXT_SUPABASE_URL / WXT_SUPABASE_ANON_KEY not set. Copy .env.example to .env.');
}

// Session persisted in chrome.storage.local (service worker has no localStorage).
const chromeStorage = {
  getItem: (key: string) =>
    chrome.storage.local.get(key).then((r) => r[key] ?? null),
  setItem: (key: string, value: string) =>
    chrome.storage.local.set({ [key]: value }),
  removeItem: (key: string) => chrome.storage.local.remove(key),
};

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: chromeStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
