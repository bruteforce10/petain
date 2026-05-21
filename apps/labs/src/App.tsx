import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { ProductRow, PlaceRow } from '@terramap/types';
import { fetchProducts, fetchPlaces } from '@terramap/supabase';
import { ProductTable, EmptyState } from '@terramap/ui';
import { PlaceTable } from '@/components/PlaceTable';
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
  const [products, setProducts] = useState<ProductRow[] | null>(null);
  const [places, setPlaces] = useState<PlaceRow[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([fetchProducts(supabase), fetchPlaces(supabase)])
      .then(([prods, plcs]) => {
        setProducts(prods);
        setPlaces(plcs);
      })
      .catch((e) => setErr(e?.message ?? 'Failed to load'));
  }, []);

  const tokopedia = useMemo(
    () => (products ?? []).filter((p) => p.source === 'tokopedia'),
    [products],
  );
  const shopee = useMemo(
    () => (products ?? []).filter((p) => p.source === 'shopee'),
    [products],
  );

  const loading = products == null || places == null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scraped data</h1>
          <p className="text-sm text-gray-500">{email}</p>
        </div>
        <button className="text-sm text-gray-500 underline" onClick={() => supabase.auth.signOut()}>
          logout
        </button>
      </header>

      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}
      {loading && !err && <p className="text-gray-500">Loading…</p>}

      {!loading && (
        <div className="space-y-10">
          <Section title="Tokopedia" count={tokopedia.length}>
            {tokopedia.length ? (
              <ProductTable rows={tokopedia} />
            ) : (
              <EmptyState title="No Tokopedia products" hint="Scrape a Tokopedia search page." />
            )}
          </Section>

          <Section title="Shopee" count={shopee.length}>
            {shopee.length ? (
              <ProductTable rows={shopee} />
            ) : (
              <EmptyState title="No Shopee products" hint="Scrape a Shopee search page." />
            )}
          </Section>

          <Section title="Google Maps" count={places!.length}>
            {places!.length ? (
              <PlaceTable rows={places!} />
            ) : (
              <EmptyState title="No places" hint="Scrape a Google Maps results page." />
            )}
          </Section>
        </div>
      )}
    </main>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        {title}
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {count}
        </span>
      </h2>
      {children}
    </section>
  );
}
