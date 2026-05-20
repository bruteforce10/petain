import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { SaveStatus, Source } from '@/lib/types';

function detectSource(url: string | undefined): Source | null {
  if (!url) return null;
  if (/google\.[^/]+\/maps/.test(url)) return 'gmaps';
  if (/shopee\.co\.id/.test(url)) return 'shopee';
  if (/tokopedia\.com/.test(url)) return 'tokopedia';
  return null;
}

const LABELS: Record<Source, string> = {
  gmaps: 'Google Maps',
  shopee: 'Shopee',
  tokopedia: 'Tokopedia',
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authErr, setAuthErr] = useState('');
  const [source, setSource] = useState<Source | null>(null);
  const [tabId, setTabId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      setTabId(tab?.id ?? null);
      setSource(detectSource(tab?.url));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setAuthErr('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthErr(error.message);
  }

  async function scrape() {
    if (tabId == null) return;
    setBusy(true);
    setStatus('Scraping…');
    try {
      const res = (await chrome.tabs.sendMessage(tabId, { type: 'START_SCRAPE' })) as SaveStatus;
      setStatus(res.ok ? `Saved ${res.inserted} rows.` : `Error: ${res.error}`);
    } catch (e: any) {
      setStatus(`Error: ${e?.message ?? 'content script not ready — reload page'}`);
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <div className="p-4 space-y-3">
        <h1 className="text-lg font-bold">TerraMap</h1>
        <form onSubmit={login} className="space-y-2">
          <input
            className="w-full border rounded px-2 py-1 text-sm"
            type="email" placeholder="email" value={email}
            onChange={(e) => setEmail(e.target.value)} required
          />
          <input
            className="w-full border rounded px-2 py-1 text-sm"
            type="password" placeholder="password" value={password}
            onChange={(e) => setPassword(e.target.value)} required
          />
          <button className="w-full bg-blue-600 text-white rounded py-1 text-sm" type="submit">
            Log in
          </button>
          {authErr && <p className="text-red-600 text-xs">{authErr}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-bold">TerraMap</h1>
        <button className="text-xs text-gray-500 underline" onClick={() => supabase.auth.signOut()}>
          logout
        </button>
      </div>
      <p className="text-xs text-gray-600 truncate">{session.user.email}</p>

      {source ? (
        <>
          <p className="text-sm">
            Detected: <span className="font-semibold">{LABELS[source]}</span>
          </p>
          <button
            className="w-full bg-green-600 disabled:bg-gray-400 text-white rounded py-1.5 text-sm"
            onClick={scrape} disabled={busy}
          >
            {busy ? 'Working…' : 'Scrape this page'}
          </button>
        </>
      ) : (
        <p className="text-sm text-gray-600">
          Open Google Maps, Shopee, or Tokopedia, then reopen this popup.
        </p>
      )}

      {status && <p className="text-xs">{status}</p>}
    </div>
  );
}
