import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { fetchPlacesBySession } from '@terramap/supabase';
import { supabase } from '@/lib/supabase';
import type { PlaceRow, SaveStatus, StartAreaScrape } from '@/lib/types';
import {
  getProvinces,
  getRegenciesByProvince,
  getDistrictsByRegency,
} from '@/lib/wilayah';
import { ScrapeSummary } from './ScrapeSummary';

/** Base URL of the web dashboard the "Lihat Tabel Data" button opens. */
const WEB_APP_URL = (import.meta.env.WXT_WEB_URL as string | undefined) ?? 'http://localhost:3000';

const MAX_RESULTS_OPTIONS = [20, 40, 60, 100, 200] as const;
const DELAY_OPTIONS = [
  { value: 1500, label: '1500ms — Normal' },
  { value: 2000, label: '2000ms — Aman' },
  { value: 2500, label: '2500ms — Lebih Aman' },
  { value: 3000, label: '3000ms — Paling Aman' },
] as const;

// What the user picks in the dropdown is advertised as-is, but every scrape
// actually runs with this extra buffer added (e.g. 1500ms → 2000ms). Slower
// scrolling is safer against Google Maps rate limits; the lower advertised
// numbers are kept purely as a marketing choice. Do NOT surface this to the UI.
const SCROLL_DELAY_BUFFER_MS = 500;

const STATUS_KEY = 'terramap.lastScrape';

interface PersistedStatus {
  state: 'running' | 'success' | 'error';
  step?: string;
  message: string;
  inserted?: number;
  sessionId?: string;
  runId?: string;
  hint?: string;
  timestamp: number;
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
  const palette =
    status.state === 'success'
      ? 'border-[#01C07A]/30 bg-[#01C07A]/10 text-[rgb(0,55,46)]'
      : status.state === 'error'
      ? 'border-red-300 bg-red-50 text-red-800'
      : 'border-[rgb(0,55,46)]/15 bg-[rgb(238,238,228)] text-[rgb(0,55,46)]';
  const icon = status.state === 'success' ? '✓' : status.state === 'error' ? '⚠' : '⏳';
  return (
    <div className={`rounded-2xl border px-3 py-2.5 text-xs shadow-sm ${palette}`}>
      <div className="flex items-start gap-2">
        <span className={status.state === 'running' ? 'animate-pulse text-sm' : 'text-sm'}>
          {icon}
        </span>
        <div className="flex-1 space-y-1">
          {status.step && (
            <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
              {STEP_LABEL[status.step] ?? status.step}
            </div>
          )}
          <div className="font-medium leading-snug">{status.message}</div>
          {status.hint && (
            <div className="rounded-lg bg-white/70 px-2 py-1.5 text-[11px] leading-snug text-[rgb(5,87,72)]">
              💡 {status.hint}
            </div>
          )}
          {status.state === 'success' && status.inserted != null && (
            <div className="text-[10px] opacity-70">Tersimpan: {status.inserted} POI</div>
          )}
        </div>
        {status.state !== 'running' && (
          <button
            className="text-xs opacity-50 transition hover:opacity-100"
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

function Logo({ className = 'h-7 w-auto' }: { className?: string }) {
  return <img src={chrome.runtime.getURL('/logo.svg')} alt="Petain" className={className} />;
}

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
  const [scrollDelayMs, setScrollDelayMs] = useState(1500);

  const [geofenceEnabled, setGeofenceEnabled] = useState(false);
  const [selectedProvinsi, setSelectedProvinsi] = useState('');
  const [selectedKabupaten, setSelectedKabupaten] = useState('');
  const [selectedKecamatan, setSelectedKecamatan] = useState('');

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [persistedStatus, setPersistedStatus] = useState<PersistedStatus | null>(null);
  const [summaryRows, setSummaryRows] = useState<PlaceRow[] | null>(null);

  useEffect(() => {
    chrome.storage.local.get(STATUS_KEY).then((stored) => {
      const s = stored[STATUS_KEY] as PersistedStatus | undefined;
      if (s) {
        setPersistedStatus(s);
        if (s.state === 'running') setBusy(true);
      }
    });
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local' || !changes[STATUS_KEY]) return;
      const next = changes[STATUS_KEY].newValue as PersistedStatus | undefined;
      setPersistedStatus(next ?? null);
      if (next && (next.state === 'success' || next.state === 'error')) {
        setBusy(false);
      } else if (next?.state === 'running') {
        setBusy(true);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // Tell floating UI to close when this top-bar popup is opened
  useEffect(() => {
    const isFloating = new URLSearchParams(window.location.search).get('floating') === '1';
    if (!isFloating) {
      chrome.storage.local.set({ 'terramap.topBarOpenedAt': Date.now() });
    }
  }, []);

  // On a successful scrape, pull the saved places for that session so we can show
  // a summary below. Driven off persistedStatus so it also works when the popup
  // is reopened after the scrape finished in the background.
  useEffect(() => {
    if (persistedStatus?.state === 'success' && persistedStatus.sessionId) {
      let cancelled = false;
      fetchPlacesBySession(supabase, persistedStatus.sessionId)
        .then((rows) => {
          if (!cancelled) setSummaryRows(rows);
        })
        .catch(() => {
          if (!cancelled) setSummaryRows(null);
        });
      return () => {
        cancelled = true;
      };
    }
    setSummaryRows(null);
  }, [persistedStatus?.state, persistedStatus?.sessionId]);

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
          setAuthMsg('Akun dibuat. Cek email untuk konfirmasi, lalu masuk.');
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

    const provinsiName = provinces.find((p) => p.id === selectedProvinsi)?.name ?? '';
    const kabupatenName = regencies.find((r) => r.id === selectedKabupaten)?.name ?? '';
    const kecamatanName = districts.find((d) => d.id === selectedKecamatan)?.name ?? '';
    const hasGeofenceTerms = Boolean(provinsiName || kabupatenName || kecamatanName);

    setBusy(true);
    setStatus('');
    try {
      const msg: StartAreaScrape = {
        type: 'START_AREA_SCRAPE',
        params: {
          businessQuery: businessQuery.trim(),
          locationQuery: locationQuery.trim(),
          maxResults,
          scrollDelayMs: scrollDelayMs + SCROLL_DELAY_BUFFER_MS,
          geofence:
            geofenceEnabled && hasGeofenceTerms
              ? {
                  enabled: true,
                  provinsi: provinsiName,
                  kabupaten: kabupatenName,
                  kecamatan: kecamatanName,
                }
              : undefined,
        },
      };
      const res = (await chrome.runtime.sendMessage(msg)) as SaveStatus | undefined;
      if (!res) {
        setStatus('Error: tidak ada respon dari background.');
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
      <div className="bg-[rgb(250,250,240)] text-[rgb(0,55,46)]">
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-center gap-2 pt-1">
            <Logo className="h-8 w-auto" />
          </div>
          <p className="text-center text-xs text-[rgb(5,87,72)]/70">
            Scrape Google Maps untuk riset pasar lokal.
          </p>
          <form onSubmit={submitAuth} className="space-y-2.5">
            <input
              className="w-full rounded-xl border border-[rgb(0,55,46)]/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#01C07A] focus:ring-2 focus:ring-[#01C07A]/20"
              type="email"
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="w-full rounded-xl border border-[rgb(0,55,46)]/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#01C07A] focus:ring-2 focus:ring-[#01C07A]/20"
              type="password"
              placeholder="password"
              value={password}
              minLength={6}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              className="w-full rounded-full bg-[rgb(0,55,46)] py-2.5 text-sm font-semibold text-[rgb(250,250,240)] shadow-sm shadow-[rgb(0,55,46)]/20 transition hover:-translate-y-0.5 hover:shadow-md disabled:translate-y-0 disabled:bg-[rgb(0,55,46)]/40 disabled:shadow-none"
              type="submit"
              disabled={authBusy}
            >
              {authBusy ? 'Memproses…' : mode === 'signup' ? 'Daftar' : 'Masuk'}
            </button>
            {authErr && <p className="text-xs text-red-600">{authErr}</p>}
            {authMsg && <p className="text-xs text-[rgb(5,87,72)]">{authMsg}</p>}
          </form>
          <button
            className="block w-full text-center text-xs text-[rgb(5,87,72)] underline-offset-2 transition hover:underline"
            onClick={() => {
              setMode(mode === 'signup' ? 'login' : 'signup');
              setAuthErr('');
              setAuthMsg('');
            }}
          >
            {mode === 'signup' ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[rgb(250,250,240)] text-[rgb(0,55,46)]">
      <div className="space-y-3 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Logo className="h-7 w-auto" />
          <button
            className="rounded-full border border-[rgb(0,55,46)]/15 px-2.5 py-1 text-[11px] font-medium text-[rgb(5,87,72)] transition hover:bg-[rgb(0,55,46)]/5"
            onClick={() => supabase.auth.signOut()}
          >
            Keluar
          </button>
        </div>

        {/* User Info */}
        {/* NOTE: a "Masa Aktif / Sisa N Hari" countdown was removed here — it was
            a hardcoded dummy (always 6 days, always red) shown to every user as
            if it were a real subscription state. Re-add it wired to a real
            expiry field from the Supabase profile once billing exists. */}
        <div className="flex items-center justify-between rounded-2xl border border-[rgb(0,55,46)]/10 bg-white p-3 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(5,87,72)]/70">
              Pengguna
            </span>
            <span
              className="text-xs font-medium text-[rgb(0,55,46)] break-all"
              title={session.user.email}
            >
              {session.user.email}
            </span>
          </div>
        </div>

        {/* Query card */}
        <div className="space-y-2 rounded-2xl border border-[rgb(0,55,46)]/10 bg-white p-3 shadow-sm">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[rgb(5,87,72)]/80">
              Jenis usaha
            </span>
            <input
              className="w-full rounded-xl border border-[rgb(0,55,46)]/15 bg-[rgb(250,250,240)] px-3 py-2 text-sm outline-none transition focus:border-[#01C07A] focus:bg-white focus:ring-2 focus:ring-[#01C07A]/20"
              placeholder="contoh: coffee shop"
              value={businessQuery}
              onChange={(e) => setBusinessQuery(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[rgb(5,87,72)]/80">
              Lokasi
            </span>
            <input
              className="w-full rounded-xl border border-[rgb(0,55,46)]/15 bg-[rgb(250,250,240)] px-3 py-2 text-sm outline-none transition focus:border-[#01C07A] focus:bg-white focus:ring-2 focus:ring-[#01C07A]/20 disabled:opacity-50"
              placeholder="contoh: Bandung Kota"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              disabled={geofenceEnabled}
            />
          </label>
        </div>

        {/* Settings card */}
        <div className="space-y-2 rounded-2xl border border-[rgb(0,55,46)]/10 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[rgb(5,87,72)]/80">
                Max hasil
              </span>
              <select
                className="w-full rounded-xl border border-[rgb(0,55,46)]/15 bg-[rgb(250,250,240)] px-2 py-2 text-sm outline-none transition focus:border-[#01C07A] focus:bg-white focus:ring-2 focus:ring-[#01C07A]/20"
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
              >
                {MAX_RESULTS_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[rgb(5,87,72)]/80">
                Delay scroll
              </span>
              <select
                className="w-full rounded-xl border border-[rgb(0,55,46)]/15 bg-[rgb(250,250,240)] px-2 py-2 text-sm outline-none transition focus:border-[#01C07A] focus:bg-white focus:ring-2 focus:ring-[#01C07A]/20"
                value={scrollDelayMs}
                onChange={(e) => setScrollDelayMs(Number(e.target.value))}
              >
                {DELAY_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-[10px] text-[rgb(5,87,72)]/60">
            💡 Delay tinggi = aman dari rate limit Google Maps
          </p>
        </div>

        {/* Geofence card */}
        <div className="rounded-2xl border border-[rgb(0,55,46)]/10 bg-white p-3 shadow-sm">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={geofenceEnabled}
              onChange={(e) => setGeofenceEnabled(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-[#01C07A]"
            />
            <span>Filter per kecamatan</span>
            <span className="ml-auto rounded-full bg-[rgb(238,238,228)] px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[rgb(5,87,72)]">
              Opsional
            </span>
          </label>

          {geofenceEnabled && (
            <div className="mt-3 space-y-2">
              <p className="text-[10px] leading-snug text-[rgb(5,87,72)]/70">
                Field yang diisi akan dipakai untuk mempersempit pencarian. Boleh kosong sebagian.
              </p>
              <select
                className="w-full rounded-xl border border-[rgb(0,55,46)]/15 bg-[rgb(250,250,240)] px-2.5 py-2 text-xs outline-none transition focus:border-[#01C07A] focus:bg-white focus:ring-2 focus:ring-[#01C07A]/20"
                value={selectedProvinsi}
                onChange={(e) => handleProvinsiChange(e.target.value)}
              >
                <option value="">— Pilih Provinsi —</option>
                {provinces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-xl border border-[rgb(0,55,46)]/15 bg-[rgb(250,250,240)] px-2.5 py-2 text-xs outline-none transition focus:border-[#01C07A] focus:bg-white focus:ring-2 focus:ring-[#01C07A]/20 disabled:opacity-50"
                value={selectedKabupaten}
                onChange={(e) => handleKabupatenChange(e.target.value)}
                disabled={!selectedProvinsi}
              >
                <option value="">— Pilih Kabupaten / Kota —</option>
                {regencies.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-xl border border-[rgb(0,55,46)]/15 bg-[rgb(250,250,240)] px-2.5 py-2 text-xs outline-none transition focus:border-[#01C07A] focus:bg-white focus:ring-2 focus:ring-[#01C07A]/20 disabled:opacity-50"
                value={selectedKecamatan}
                onChange={(e) => setSelectedKecamatan(e.target.value)}
                disabled={!selectedKabupaten}
              >
                <option value="">— Pilih Kecamatan —</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[rgb(0,55,46)] py-3 text-sm font-semibold text-[rgb(250,250,240)] shadow-md shadow-[rgb(0,55,46)]/25 transition hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0 disabled:bg-[rgb(0,55,46)]/40 disabled:shadow-none"
          onClick={() => scrape()}
          disabled={busy}
        >
          {busy ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[rgb(250,250,240)]/30 border-t-[rgb(250,250,240)]" />
              Scraping…
            </>
          ) : (
            <>🚀 Mulai Scrape</>
          )}
        </button>

        {persistedStatus ? (
          <StatusBanner status={persistedStatus} onDismiss={dismissStatus} />
        ) : (
          status && (
            <p className="rounded-xl bg-[rgb(238,238,228)] px-3 py-2 text-xs leading-snug text-[rgb(5,87,72)] whitespace-pre-wrap">
              {status}
            </p>
          )
        )}

        {persistedStatus?.state === 'success' && summaryRows && summaryRows.length > 0 && (
          <ScrapeSummary
            rows={summaryRows}
            dashboardUrl={
              persistedStatus.runId
                ? `${WEB_APP_URL}/dashboard?run=${persistedStatus.runId}`
                : `${WEB_APP_URL}/dashboard`
            }
          />
        )}
      </div>
    </div>
  );
}
