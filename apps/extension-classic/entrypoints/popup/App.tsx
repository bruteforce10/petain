import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { SaveStatus, StartAreaScrape } from '@/lib/types';
import MapPicker from './MapPicker';

// Default center: Bandung. User can click anywhere to move.
const DEFAULT_LAT = -6.9147;
const DEFAULT_LNG = 107.6098;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authErr, setAuthErr] = useState('');
  const [authMsg, setAuthMsg] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [authBusy, setAuthBusy] = useState(false);

  const [keyword, setKeyword] = useState('coffee shop');
  const [lat, setLat] = useState(DEFAULT_LAT);
  const [lng, setLng] = useState(DEFAULT_LNG);
  const [radiusM, setRadiusM] = useState(1000);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthErr('');
    setAuthMsg('');
    setAuthBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setAuthErr(error.message);
        } else if (!data.session) {
          setAuthMsg('Account created. Check your email to confirm, then log in.');
          setMode('login');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setAuthErr(error.message);
      }
    } finally {
      setAuthBusy(false);
    }
  }

  async function scrape() {
    if (!keyword.trim()) {
      setStatus('Keyword empty.');
      return;
    }
    setBusy(true);
    setStatus('Opening Google Maps + scraping…');
    try {
      const msg: StartAreaScrape = {
        type: 'START_AREA_SCRAPE',
        params: { keyword: keyword.trim(), lat, lng, radiusM },
      };
      const res = (await chrome.runtime.sendMessage(msg)) as SaveStatus;
      if (res.ok) {
        setStatus(`✓ Saved ${res.inserted} POI. Session ${res.sessionId?.slice(0, 8)}…`);
      } else {
        setStatus(`Error: ${res.error}`);
      }
    } catch (e: any) {
      setStatus(`Error: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <div className="p-4 space-y-3">
        <h1 className="text-lg font-bold">TerraMap Classic</h1>
        <p className="text-xs text-gray-500">Varian A — radius scrape, no AI</p>
        <form onSubmit={submitAuth} className="space-y-2">
          <input
            className="w-full border rounded px-2 py-1 text-sm"
            type="email" placeholder="email" value={email}
            onChange={(e) => setEmail(e.target.value)} required
          />
          <input
            className="w-full border rounded px-2 py-1 text-sm"
            type="password" placeholder="password" value={password}
            minLength={6}
            onChange={(e) => setPassword(e.target.value)} required
          />
          <button
            className="w-full bg-blue-600 disabled:bg-gray-400 text-white rounded py-1 text-sm"
            type="submit" disabled={authBusy}
          >
            {authBusy ? 'Working…' : mode === 'signup' ? 'Sign up' : 'Log in'}
          </button>
          {authErr && <p className="text-red-600 text-xs">{authErr}</p>}
          {authMsg && <p className="text-green-600 text-xs">{authMsg}</p>}
        </form>
        <button
          className="text-xs text-blue-600 underline"
          onClick={() => {
            setMode(mode === 'signup' ? 'login' : 'signup');
            setAuthErr('');
            setAuthMsg('');
          }}
        >
          {mode === 'signup' ? 'Already have an account? Log in' : 'No account? Sign up'}
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex justify-between items-center">
        <h1 className="text-base font-bold">TerraMap Classic</h1>
        <button
          className="text-xs text-gray-500 underline"
          onClick={() => supabase.auth.signOut()}
        >
          logout
        </button>
      </div>

      <input
        className="w-full border rounded px-2 py-1 text-sm"
        placeholder="keyword (e.g. specialty coffee)"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />

      <MapPicker
        lat={lat}
        lng={lng}
        radiusM={radiusM}
        onPick={(la, ln) => {
          setLat(la);
          setLng(ln);
        }}
      />

      <div className="text-xs text-gray-600 font-mono">
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </div>

      <label className="block text-xs">
        Radius: <span className="font-semibold">{radiusM} m</span>
        <input
          type="range"
          min={250}
          max={5000}
          step={250}
          value={radiusM}
          onChange={(e) => setRadiusM(Number(e.target.value))}
          className="w-full"
        />
      </label>

      <button
        className="w-full bg-green-600 disabled:bg-gray-400 text-white rounded py-1.5 text-sm"
        onClick={scrape}
        disabled={busy}
      >
        {busy ? 'Scraping…' : 'Scrape area'}
      </button>

      {status && <p className="text-xs whitespace-pre-wrap">{status}</p>}
    </div>
  );
}
