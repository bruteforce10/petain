'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { ProductRow } from '@terramap/types';
import { fetchProducts } from '@terramap/supabase';
import { ProductTable, EmptyState } from '@terramap/ui';
import { supabase } from '@/lib/supabase-browser';

export default function Dashboard() {
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
  return <SavedRows email={session.user.email ?? ''} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-gray-500">{children}</div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) setErr(error.message);
        else if (!data.session) {
          setMsg('Account created. Check your email to confirm, then log in.');
          setMode('login');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setErr(error.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">Log in to TerraMap</h1>
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
            {busy ? 'Working…' : mode === 'signup' ? 'Sign up' : 'Log in'}
          </button>
          {err && <p className="text-xs text-red-600">{err}</p>}
          {msg && <p className="text-xs text-green-600">{msg}</p>}
        </form>
        <button
          className="text-xs text-brand underline"
          onClick={() => {
            setMode(mode === 'signup' ? 'login' : 'signup');
            setErr('');
            setMsg('');
          }}
        >
          {mode === 'signup' ? 'Already have an account? Log in' : 'No account? Sign up'}
        </button>
      </div>
    </div>
  );
}

function SavedRows({ email }: { email: string }) {
  const [rows, setRows] = useState<ProductRow[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetchProducts(supabase)
      .then(setRows)
      .catch((e) => setErr(e?.message ?? 'Failed to load'));
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Saved products</h1>
          <p className="text-sm text-gray-500">{email}</p>
        </div>
        <button
          className="text-sm text-gray-500 underline"
          onClick={() => supabase.auth.signOut()}
        >
          logout
        </button>
      </header>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {rows == null && !err && <p className="text-gray-500">Loading saved rows…</p>}
      {rows != null && rows.length === 0 && (
        <EmptyState
          title="No saved rows yet"
          hint="Use the TerraMap extension to scrape a Tokopedia or Shopee search page."
        />
      )}
      {rows != null && rows.length > 0 && (
        <>
          <p className="mb-3 text-sm text-gray-500">{rows.length} rows</p>
          <ProductTable rows={rows} />
        </>
      )}
    </main>
  );
}
