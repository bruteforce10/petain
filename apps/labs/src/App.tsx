import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { ScrapeRunSummary } from '@terramap/types';
import { fetchScrapeRuns } from '@terramap/supabase';
import { EmptyState } from '@terramap/ui';
import { ScrapeRunList } from '@/components/ScrapeRunList';
import { ScrapeRunDetail } from '@/components/ScrapeRunDetail';
import { supabase } from '../lib/supabase-browser';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return <Centered>Loading…</Centered>;
  if (!session) return <LoginForm />;
  return <Viewer email={session.user.email ?? ''} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-gray-500">{children}</div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErr(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">TerraMap Labs</h1>
        <p className="text-sm text-gray-500">Log in to view your scraped data.</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            type="password"
            placeholder="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            className="w-full rounded bg-brand py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:bg-gray-400"
            type="submit"
            disabled={busy}
          >
            {busy ? 'Working…' : 'Log in'}
          </button>
          {err && <p className="text-xs text-red-600">{err}</p>}
        </form>
      </div>
    </div>
  );
}

function Viewer({ email }: { email: string }) {
  const [runs, setRuns] = useState<ScrapeRunSummary[] | null>(null);
  const [err, setErr] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadRuns = useCallback(() => {
    setErr('');
    fetchScrapeRuns(supabase)
      .then(setRuns)
      .catch((e) => setErr(e?.message ?? 'Failed to load'));
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const selected = runs?.find((r) => r.id === selectedId) ?? null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scrape history</h1>
          <p className="text-sm text-gray-500">{email}</p>
        </div>
        <button className="text-sm text-gray-500 underline" onClick={() => supabase.auth.signOut()}>
          logout
        </button>
      </header>

      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}

      {selected ? (
        <ScrapeRunDetail
          run={selected}
          onBack={() => setSelectedId(null)}
          onChanged={loadRuns}
          onDeleted={() => {
            setSelectedId(null);
            loadRuns();
          }}
        />
      ) : runs == null && !err ? (
        <p className="text-gray-500">Loading…</p>
      ) : runs && runs.length === 0 ? (
        <EmptyState
          title="No scrape runs yet"
          hint="Use the extension to scrape Google Maps, Shopee, or Tokopedia."
        />
      ) : runs ? (
        <ScrapeRunList runs={runs} onOpen={(r) => setSelectedId(r.id)} />
      ) : null}
    </main>
  );
}
