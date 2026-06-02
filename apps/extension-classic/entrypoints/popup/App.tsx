import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { SaveStatus, StartAreaScrape } from '@/lib/types';
import {
  getProvinces,
  getRegenciesByProvince,
  getDistrictsByRegency,
} from '@/lib/wilayah';

const MAX_RESULTS_OPTIONS = [20, 40, 60, 100, 200] as const;
const DELAY_OPTIONS = [
  { value: 500, label: '500ms — Cepat ⚡' },
  { value: 700, label: '700ms — Normal' },
  { value: 1000, label: '1000ms — Aman' },
  { value: 1500, label: '1500ms — Lebih Aman' },
  { value: 2000, label: '2000ms — Paling Aman' },
] as const;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authErr, setAuthErr] = useState('');
  const [authMsg, setAuthMsg] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [authBusy, setAuthBusy] = useState(false);

  const [businessQuery, setBusinessQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [maxResults, setMaxResults] = useState(60);
  const [scrollDelayMs, setScrollDelayMs] = useState(1000);

  const [geofenceEnabled, setGeofenceEnabled] = useState(false);
  const [selectedProvinsi, setSelectedProvinsi] = useState('');
  const [selectedKabupaten, setSelectedKabupaten] = useState('');
  const [selectedKecamatan, setSelectedKecamatan] = useState('');

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const provinces = useMemo(() => getProvinces(), []);
  const regencies = useMemo(
    () => (selectedProvinsi ? getRegenciesByProvince(selectedProvinsi) : []),
    [selectedProvinsi],
  );
  const districts = useMemo(
    () => (selectedKabupaten ? getDistrictsByRegency(selectedKabupaten) : []),
    [selectedKabupaten],
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  function handleProvinsiChange(id: string) {
    setSelectedProvinsi(id);
    setSelectedKabupaten('');
    setSelectedKecamatan('');
  }

  function handleKabupatenChange(id: string) {
    setSelectedKabupaten(id);
    setSelectedKecamatan('');
  }

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
    if (!businessQuery.trim()) {
      setStatus('Nama bisnis/kategori kosong.');
      return;
    }
    if (!locationQuery.trim() && !geofenceEnabled) {
      setStatus('Lokasi kosong.');
      return;
    }
    if (geofenceEnabled && !selectedKecamatan) {
      setStatus('Pilih kecamatan untuk filter geofence.');
      return;
    }

    const provinsiName = provinces.find((p) => p.id === selectedProvinsi)?.name ?? '';
    const kabupatenName = regencies.find((r) => r.id === selectedKabupaten)?.name ?? '';
    const kecamatanName = districts.find((d) => d.id === selectedKecamatan)?.name ?? '';

    setBusy(true);
    setStatus('Membuka Google Maps + scraping…');
    try {
      const msg: StartAreaScrape = {
        type: 'START_AREA_SCRAPE',
        params: {
          businessQuery: businessQuery.trim(),
          locationQuery: locationQuery.trim(),
          maxResults,
          scrollDelayMs,
          geofence: geofenceEnabled
            ? { enabled: true, provinsi: provinsiName, kabupaten: kabupatenName, kecamatan: kecamatanName }
            : undefined,
        },
      };
      const res = (await chrome.runtime.sendMessage(msg)) as SaveStatus | undefined;
      if (!res) {
        setStatus('Error: no response from background (check service worker DevTools).');
        return;
      }
      if (res.ok) {
        setStatus(`✓ Tersimpan ${res.inserted} POI.`);
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
        <h1 className="text-lg font-bold">Petain Classic</h1>
        <p className="text-xs text-gray-500">Scrape Google Maps tanpa AI</p>
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
            {authBusy ? 'Working…' : mode === 'signup' ? 'Daftar' : 'Masuk'}
          </button>
          {authErr && <p className="text-red-600 text-xs">{authErr}</p>}
          {authMsg && <p className="text-green-600 text-xs">{authMsg}</p>}
        </form>
        <button
          className="text-xs text-blue-600 underline"
          onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setAuthErr(''); setAuthMsg(''); }}
        >
          {mode === 'signup' ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex justify-between items-center">
        <h1 className="text-base font-bold">Petain Classic</h1>
        <button className="text-xs text-gray-500 underline" onClick={() => supabase.auth.signOut()}>
          logout
        </button>
      </div>

      <div className="space-y-2">
        <input
          className="w-full border rounded px-2 py-1 text-sm"
          placeholder="Nama bisnis / kategori (contoh: coffee shop)"
          value={businessQuery}
          onChange={(e) => setBusinessQuery(e.target.value)}
        />
        <input
          className="w-full border rounded px-2 py-1 text-sm"
          placeholder="Lokasi (contoh: Bandung Kota)"
          value={locationQuery}
          onChange={(e) => setLocationQuery(e.target.value)}
          disabled={geofenceEnabled}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-gray-600">
          Max hasil
          <select
            className="mt-0.5 w-full border rounded px-1 py-1 text-sm"
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
          >
            {MAX_RESULTS_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-600">
          Scroll delay
          <select
            className="mt-0.5 w-full border rounded px-1 py-1 text-sm"
            value={scrollDelayMs}
            onChange={(e) => setScrollDelayMs(Number(e.target.value))}
          >
            {DELAY_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-[10px] text-gray-400">*delay tinggi = aman dari limit</p>

      <div className="border rounded p-2 space-y-2">
        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={geofenceEnabled}
            onChange={(e) => setGeofenceEnabled(e.target.checked)}
          />
          Aktifkan filter — hanya tampilkan bisnis di kecamatan
        </label>

        {geofenceEnabled && (
          <div className="space-y-1.5">
            <select
              className="w-full border rounded px-2 py-1 text-xs"
              value={selectedProvinsi}
              onChange={(e) => handleProvinsiChange(e.target.value)}
            >
              <option value="">— Pilih Provinsi —</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select
              className="w-full border rounded px-2 py-1 text-xs"
              value={selectedKabupaten}
              onChange={(e) => handleKabupatenChange(e.target.value)}
              disabled={!selectedProvinsi}
            >
              <option value="">— Pilih Kabupaten / Kota —</option>
              {regencies.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>

            <select
              className="w-full border rounded px-2 py-1 text-xs"
              value={selectedKecamatan}
              onChange={(e) => setSelectedKecamatan(e.target.value)}
              disabled={!selectedKabupaten}
            >
              <option value="">— Pilih Kecamatan —</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <button
        className="w-full bg-green-600 disabled:bg-gray-400 text-white rounded py-1.5 text-sm"
        onClick={scrape}
        disabled={busy}
      >
        {busy ? 'Scraping…' : 'Scrape'}
      </button>

      {status && <p className="text-xs whitespace-pre-wrap">{status}</p>}
    </div>
  );
}
