import { useEffect, useMemo, useRef, useState } from 'react';
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

const STATUS_KEY = 'terramap.lastScrape';
const PENDING_SCRAPE_KEY = 'terramap.pendingScrape';
const DETACHED_WIDTH = 380;
const DETACHED_HEIGHT = 620;

function isDetachedPopup() {
  return new URLSearchParams(window.location.search).get('detached') === '1';
}

function shouldAutostart() {
  return new URLSearchParams(window.location.search).get('autostart') === '1';
}

interface PersistedStatus {
  state: 'running' | 'success' | 'error';
  step?: string;
  message: string;
  inserted?: number;
  sessionId?: string;
  hint?: string;
  timestamp: number;
}

interface PendingScrape {
  businessQuery: string;
  locationQuery: string;
  maxResults: number;
  scrollDelayMs: number;
  geofenceEnabled: boolean;
  selectedProvinsi: string;
  selectedKabupaten: string;
  selectedKecamatan: string;
}

const STEP_LABEL: Record<string, string> = {
  auth: '1/5 Cek sesi',
  folder: '2/5 Buat folder',
  tab: '3/5 Buka Maps',
  load: '3/5 Tunggu Maps',
  scrape: '4/5 Scrape POI',
  save: '5/5 Simpan DB',
};

function StatusBanner({ status, onDismiss }: { status: PersistedStatus; onDismiss: () => void }) {
  const color =
    status.state === 'success'
      ? 'bg-green-50 border-green-200 text-green-800'
      : status.state === 'error'
      ? 'bg-red-50 border-red-200 text-red-800'
      : 'bg-blue-50 border-blue-200 text-blue-800';
  const icon = status.state === 'success' ? '✓' : status.state === 'error' ? '⚠' : '⏳';
  return (
    <div className={`rounded border px-2.5 py-2 text-xs ${color}`}>
      <div className="flex items-start gap-2">
        <span className={status.state === 'running' ? 'animate-pulse' : ''}>{icon}</span>
        <div className="flex-1 space-y-1">
          {status.step && (
            <div className="text-[10px] font-medium opacity-70">
              {STEP_LABEL[status.step] ?? status.step}
            </div>
          )}
          <div className="font-medium leading-snug">{status.message}</div>
          {status.hint && (
            <div className="rounded bg-white/60 px-1.5 py-1 text-[11px] leading-snug">
              💡 {status.hint}
            </div>
          )}
          {status.state === 'success' && status.inserted != null && (
            <div className="text-[10px] opacity-70">Tersimpan: {status.inserted} POI</div>
          )}
        </div>
        {status.state !== 'running' && (
          <button
            className="text-xs opacity-60 hover:opacity-100"
            onClick={onDismiss}
            title="Tutup"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const detached = useMemo(() => isDetachedPopup(), []);
  const autoStartedRef = useRef(false);
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
  const [persistedStatus, setPersistedStatus] = useState<PersistedStatus | null>(null);

  // Read persisted scrape status on mount + subscribe to live updates from
  // background. The popup window closes whenever the user clicks away, so
  // single-shot sendResponse status is unreliable for multi-minute scrapes.
  useEffect(() => {
    chrome.storage.local.get(STATUS_KEY).then((stored) => {
      const s = stored[STATUS_KEY] as PersistedStatus | undefined;
      if (s) setPersistedStatus(s);
    });
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local' || !changes[STATUS_KEY]) return;
      const next = changes[STATUS_KEY].newValue as PersistedStatus | undefined;
      setPersistedStatus(next ?? null);
      if (next && (next.state === 'success' || next.state === 'error')) {
        setBusy(false);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  function dismissStatus() {
    chrome.storage.local.remove(STATUS_KEY).catch(() => {});
    setPersistedStatus(null);
  }

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

  useEffect(() => {
    if (!detached || !shouldAutostart() || autoStartedRef.current) return;
    autoStartedRef.current = true;
    chrome.storage.local.get(PENDING_SCRAPE_KEY).then((stored) => {
      const pending = stored[PENDING_SCRAPE_KEY] as PendingScrape | undefined;
      if (!pending) return;
      setBusinessQuery(pending.businessQuery);
      setLocationQuery(pending.locationQuery);
      setMaxResults(pending.maxResults);
      setScrollDelayMs(pending.scrollDelayMs);
      setGeofenceEnabled(pending.geofenceEnabled);
      setSelectedProvinsi(pending.selectedProvinsi);
      setSelectedKabupaten(pending.selectedKabupaten);
      setSelectedKecamatan(pending.selectedKecamatan);
      chrome.storage.local.remove(PENDING_SCRAPE_KEY).catch(() => {});
      scrape(pending).catch((error: unknown) => {
        setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
      });
    });
  }, [detached]);

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

  async function scrape(input?: PendingScrape) {
    const scrapeInput: PendingScrape = input ?? {
      businessQuery,
      locationQuery,
      maxResults,
      scrollDelayMs,
      geofenceEnabled,
      selectedProvinsi,
      selectedKabupaten,
      selectedKecamatan,
    };

    if (!scrapeInput.businessQuery.trim()) {
      setStatus('Nama bisnis/kategori kosong.');
      return;
    }
    if (!scrapeInput.locationQuery.trim() && !scrapeInput.geofenceEnabled) {
      setStatus('Lokasi kosong.');
      return;
    }
    if (scrapeInput.geofenceEnabled && !scrapeInput.selectedKecamatan) {
      setStatus('Pilih kecamatan untuk filter geofence.');
      return;
    }
    if (!detached) {
      await chrome.storage.local.set({ [PENDING_SCRAPE_KEY]: scrapeInput });
      await chrome.windows.create({
        url: chrome.runtime.getURL('/popup.html?detached=1&autostart=1'),
        type: 'popup',
        width: DETACHED_WIDTH,
        height: DETACHED_HEIGHT,
      });
      return;
    }

    const inputRegencies = scrapeInput.selectedProvinsi
      ? getRegenciesByProvince(scrapeInput.selectedProvinsi)
      : [];
    const inputDistricts = scrapeInput.selectedKabupaten
      ? getDistrictsByRegency(scrapeInput.selectedKabupaten)
      : [];
    const provinsiName = provinces.find((p) => p.id === scrapeInput.selectedProvinsi)?.name ?? '';
    const kabupatenName = inputRegencies.find((r) => r.id === scrapeInput.selectedKabupaten)?.name ?? '';
    const kecamatanName = inputDistricts.find((d) => d.id === scrapeInput.selectedKecamatan)?.name ?? '';

    setBusy(true);
    setStatus('Membuka Google Maps + scraping…');
    try {
      const msg: StartAreaScrape = {
        type: 'START_AREA_SCRAPE',
        params: {
          businessQuery: scrapeInput.businessQuery.trim(),
          locationQuery: scrapeInput.locationQuery.trim(),
          maxResults: scrapeInput.maxResults,
          scrollDelayMs: scrapeInput.scrollDelayMs,
          geofence: scrapeInput.geofenceEnabled
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
    } catch (e: unknown) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <div className="p-4 space-y-3">
        <h1 className="text-lg font-bold">TerraMap Classic</h1>
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
        <h1 className="text-base font-bold">TerraMap Classic</h1>
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
        onClick={() => scrape()}
        disabled={busy}
      >
        {busy ? 'Scraping…' : 'Scrape'}
      </button>

      {persistedStatus ? (
        <StatusBanner status={persistedStatus} onDismiss={dismissStatus} />
      ) : (
        status && <p className="text-xs whitespace-pre-wrap text-gray-600">{status}</p>
      )}
    </div>
  );
}
