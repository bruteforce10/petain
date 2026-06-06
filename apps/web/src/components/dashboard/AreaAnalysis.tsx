"use client";

import { useMemo } from "react";
import type { PlaceRow } from "@terramap/types";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";

/**
 * Area-viability analysis: groups scraped places by category and ranks each
 * category by opportunity (high demand, low supply, weak incumbents).
 *
 * gap_score = demand / (saturation × avgRating)
 *   high  -> underserved + beatable competitors -> good to build
 *   low   -> crowded and/or strong incumbents
 */

interface CategoryStat {
  category: string;
  saturation: number; // competitor count
  demand: number; // total reviews
  avgRating: number; // mean rating
  medianReviews: number; // typical traffic
  closedShare: number; // 0..1 market churn
  gapScore: number;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function computeCategoryStats(rows: PlaceRow[]): CategoryStat[] {
  const groups = new Map<string, PlaceRow[]>();
  for (const r of rows) {
    const key = (r.category ?? "Uncategorized").trim() || "Uncategorized";
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }

  const stats: CategoryStat[] = [];
  for (const [category, places] of groups) {
    const saturation = places.length;
    const ratings = places.map((p) => p.rating ?? 0).filter((n) => n > 0);
    const reviews = places.map((p) => p.review_count ?? 0);
    const demand = reviews.reduce((a, b) => a + b, 0);
    const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    const closed = places.filter((p) => p.is_closed).length;

    const gapScore = avgRating > 0 ? demand / (saturation * avgRating) : demand / saturation;

    stats.push({
      category,
      saturation,
      demand,
      avgRating,
      medianReviews: median(reviews),
      closedShare: saturation ? closed / saturation : 0,
      gapScore,
    });
  }

  return stats.sort((a, b) => b.gapScore - a.gapScore);
}

function fmt(v: number, digits = 0) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(v);
}

function gapLabel(score: number, max: number): { label: string; desc: string } {
  const ratio = score / (max || 1);
  if (ratio >= 0.7) return { label: "Peluang Besar", desc: "Permintaan tinggi, persaingan lemah — kategori ini underserved dan layak dimasuki." };
  if (ratio >= 0.35) return { label: "Peluang Sedang", desc: "Ada permintaan cukup, tapi persaingan mulai ketat. Perlu diferensiasi." };
  return { label: "Peluang Kecil", desc: "Pasar sudah jenuh atau permintaan rendah. Sulit bersaing tanpa keunggulan khusus." };
}

export function AreaAnalysis({ rows }: { rows: PlaceRow[] }) {
  const stats = useMemo(() => computeCategoryStats(rows), [rows]);
  if (!stats.length) return null;

  const maxGap = stats[0].gapScore || 1;

  return (
    <TooltipProvider>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium text-right" title="Competitor count">
                Saturation
              </th>
              <th className="px-3 py-2 font-medium text-right" title="Total reviews = demand proxy">
                Demand
              </th>
              <th className="px-3 py-2 font-medium text-right">Avg rating</th>
              <th className="px-3 py-2 font-medium text-right" title="Typical reviews per place">
                Median reviews
              </th>
              <th className="px-3 py-2 font-medium text-right" title="Share permanently/temporarily closed">
                Closed
              </th>
              <th className="px-3 py-2 font-medium text-right">
                <span className="inline-flex items-center justify-end gap-1">
                  Gap score
                  <Tooltip
                    content={
                      <div className="space-y-1">
                        <p className="font-semibold">Gap Score</p>
                        <p>Rumus: <span className="font-mono">demand ÷ (saturation × avg rating)</span></p>
                        <p className="mt-1 text-gray-300">Semakin tinggi = kategori lebih underserved dan potensial untuk dimasuki.</p>
                        <div className="mt-2 space-y-0.5 border-t border-gray-700 pt-2">
                          <p>🟢 <span className="font-medium">Peluang Besar</span> — top 70%</p>
                          <p>🟡 <span className="font-medium">Peluang Sedang</span> — 35–70%</p>
                          <p>🔴 <span className="font-medium">Peluang Kecil</span> — bawah 35%</p>
                        </div>
                      </div>
                    }
                  >
                    <button className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-300 text-[10px] font-bold text-gray-700 hover:bg-gray-400 transition-colors">
                      ?
                    </button>
                  </Tooltip>
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stats.map((s) => {
              const { label, desc } = gapLabel(s.gapScore, maxGap);
              return (
                <tr key={s.category} className="hover:bg-gray-50">
                  <td className="px-3 py-2 capitalize">{s.category}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.saturation}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(s.demand)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.avgRating ? fmt(s.avgRating, 1) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(s.medianReviews)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {s.closedShare ? `${fmt(s.closedShare * 100)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    <Tooltip content={<p>{desc}</p>}>
                      <span className="inline-flex cursor-default items-center gap-2">
                        <span
                          className="h-1.5 rounded-full bg-brand"
                          style={{ width: `${Math.max(6, (s.gapScore / maxGap) * 48)}px` }}
                        />
                        {fmt(s.gapScore, 1)}
                        <span className="text-[10px] font-normal text-gray-400">{label}</span>
                      </span>
                    </Tooltip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}
