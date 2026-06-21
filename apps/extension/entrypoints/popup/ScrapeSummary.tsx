import { useMemo } from 'react';
import type { PlaceRow } from '@/lib/types';

const numberFmt = new Intl.NumberFormat('id-ID');

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[rgb(0,55,46)]/10 bg-[rgb(250,250,240)] px-2 py-2 text-center">
      <div className="text-base font-bold leading-tight text-[rgb(0,55,46)]">{value}</div>
      <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-[rgb(5,87,72)]/70">
        {label}
      </div>
      {sub && <div className="text-[9px] leading-tight text-[rgb(5,87,72)]/50">{sub}</div>}
    </div>
  );
}

interface MiniItem {
  name: string;
  primary: string;
  secondary?: string;
}

function MiniList({ title, icon, items }: { title: string; icon: string; items: MiniItem[] }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[rgb(5,87,72)]/80">
        <span>{icon}</span>
        {title}
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-[rgb(5,87,72)]/50">Tidak ada data.</p>
      ) : (
        <ol className="space-y-1">
          {items.map((it, i) => (
            <li
              key={`${it.name}-${i}`}
              className="flex items-center gap-2 rounded-lg bg-[rgb(250,250,240)] px-2 py-1.5"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[rgb(0,55,46)]/10 text-[9px] font-bold text-[rgb(0,55,46)]">
                {i + 1}
              </span>
              <span
                className="flex-1 truncate text-[11px] font-medium text-[rgb(0,55,46)]"
                title={it.name}
              >
                {it.name}
              </span>
              <span className="shrink-0 text-[11px] font-semibold text-[rgb(5,87,72)]">
                {it.primary}
              </span>
              {it.secondary && (
                <span className="shrink-0 text-[9px] text-[rgb(5,87,72)]/50">{it.secondary}</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export interface ScrapeSummaryProps {
  rows: PlaceRow[];
  dashboardUrl: string;
}

export function ScrapeSummary({ rows, dashboardUrl }: ScrapeSummaryProps) {
  const stats = useMemo(() => {
    const rated = rows.filter((r) => typeof r.rating === 'number');
    const avgRating = rated.length
      ? rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length
      : null;
    const totalReviews = rows.reduce((sum, r) => sum + (r.review_count ?? 0), 0);
    return { avgRating, totalReviews, ratedCount: rated.length };
  }, [rows]);

  const topRated = useMemo(
    () =>
      [...rows]
        .filter((r) => typeof r.rating === 'number')
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 3),
    [rows],
  );

  const mostViewed = useMemo(
    () => [...rows].sort((a, b) => (b.review_count ?? 0) - (a.review_count ?? 0)).slice(0, 3),
    [rows],
  );

  function openDashboard() {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: dashboardUrl });
    } else {
      window.open(dashboardUrl, '_blank', 'noopener');
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[rgb(0,55,46)]/10 bg-white p-3 shadow-sm">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-[rgb(5,87,72)]/80">
        📊 Ringkasan hasil scrape
      </span>

      {/* Headline stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Total" value={numberFmt.format(rows.length)} sub="tempat" />
        <StatCard
          label="Avg Rating"
          value={stats.avgRating != null ? stats.avgRating.toFixed(1) : '—'}
          sub={`★ ${stats.ratedCount} dinilai`}
        />
        <StatCard
          label="Reviews"
          value={numberFmt.format(stats.totalReviews)}
          sub="total ulasan"
        />
      </div>

      {/* Top rated */}
      <MiniList
        title="Top Rated"
        icon="⭐"
        items={topRated.map((p) => ({
          name: p.name,
          primary: p.rating != null ? p.rating.toFixed(1) : '—',
          secondary: p.review_count != null ? `${numberFmt.format(p.review_count)} ulasan` : undefined,
        }))}
      />

      {/* Most viewed (most reviewed) */}
      <MiniList
        title="Most View"
        icon="👁"
        items={mostViewed.map((p) => ({
          name: p.name,
          primary: p.review_count != null ? numberFmt.format(p.review_count) : '—',
          secondary: p.rating != null ? `★ ${p.rating.toFixed(1)}` : undefined,
        }))}
      />

      {/* CTA: open the full data table on the web dashboard */}
      <button
        onClick={openDashboard}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-[rgb(0,55,46)]/15 bg-[rgb(250,250,240)] py-2.5 text-sm font-semibold text-[rgb(0,55,46)] transition hover:border-[#01C07A] hover:bg-white"
      >
        📋 Lihat Tabel Data
        <span aria-hidden>↗</span>
      </button>
    </div>
  );
}
