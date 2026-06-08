"use client";

import { useMemo, useState } from "react";
import type { PlaceRow } from "@terramap/types";
import { exportPlaces } from "@terramap/ui";

type SortKey = "default" | "rating" | "reviews" | "busy";

function busyLevel(reviewCount: number | null | undefined): {
  label: string;
  className: string;
} {
  if (reviewCount == null) return { label: "—", className: "text-gray-400" };
  if (reviewCount >= 1000)
    return { label: "Sangat Ramai", className: "bg-red-50 text-red-700 border border-red-200" };
  if (reviewCount >= 200)
    return { label: "Ramai", className: "bg-orange-50 text-orange-700 border border-orange-200" };
  if (reviewCount >= 50)
    return { label: "Normal", className: "bg-yellow-50 text-yellow-700 border border-yellow-200" };
  return { label: "Sepi", className: "bg-gray-100 text-gray-500 border border-gray-200" };
}

function fmtCoords(lat: number | null | undefined, lng: number | null | undefined) {
  if (lat == null || lng == null) return null;
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function fmtNum(v: number | null | undefined) {
  return v == null ? "—" : new Intl.NumberFormat("id-ID").format(v);
}

const WEEKDAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
const WEEKEND = ["Sabtu", "Minggu"];
const DAY_SHORT: Record<string, string> = {
  Senin: "Sen", Selasa: "Sel", Rabu: "Rab", Kamis: "Kam",
  Jumat: "Jum", Sabtu: "Sab", Minggu: "Min",
};

function getHours(hours: Record<string, string>, day: string): string | null {
  const direct = hours[day];
  if (direct) return direct;
  const ciKey = Object.keys(hours).find((k) => k.toLowerCase() === day.toLowerCase());
  return ciKey ? hours[ciKey] : null;
}

function formatHoursGroups(hours: Record<string, string> | null | undefined): string[] {
  if (!hours) return [];
  const lines: string[] = [];

  const wdHours = WEEKDAYS.map((d) => getHours(hours, d));
  const wdPresent = wdHours.filter(Boolean) as string[];
  if (wdPresent.length === WEEKDAYS.length && wdPresent.every((h) => h === wdPresent[0])) {
    lines.push(`Sen–Jum: ${wdPresent[0]}`);
  } else {
    WEEKDAYS.forEach((day, i) => {
      if (wdHours[i]) lines.push(`${DAY_SHORT[day]}: ${wdHours[i]}`);
    });
  }

  const weHours = WEEKEND.map((d) => getHours(hours, d));
  const wePresent = weHours.filter(Boolean) as string[];
  if (wePresent.length === WEEKEND.length && wePresent.every((h) => h === wePresent[0])) {
    lines.push(`Sab–Min: ${wePresent[0]}`);
  } else {
    WEEKEND.forEach((day, i) => {
      if (weHours[i]) lines.push(`${DAY_SHORT[day]}: ${weHours[i]}`);
    });
  }

  return lines;
}

export interface PlaceTableProps {
  rows: PlaceRow[];
  /** Used as the exported file name label (e.g. the scrape run title). */
  title?: string;
}

export function PlaceTable({ rows, title }: PlaceTableProps) {
  const [sort, setSort] = useState<SortKey>("default");

  const sorted = useMemo(() => {
    if (sort === "rating") return [...rows].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    if (sort === "reviews")
      return [...rows].sort((a, b) => (b.review_count ?? 0) - (a.review_count ?? 0));
    if (sort === "busy") {
      const tier = (n: number | null | undefined) =>
        n == null ? -1 : n >= 1000 ? 3 : n >= 200 ? 2 : n >= 50 ? 1 : 0;
      return [...rows].sort((a, b) => tier(b.review_count) - tier(a.review_count));
    }
    return rows;
  }, [rows, sort]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["default", "rating", "reviews", "busy"] as SortKey[]).map((key) => {
          const labels: Record<SortKey, string> = {
            default: "Urutan Default",
            rating: "⭐ Top Rated",
            reviews: "👁 Terbanyak Review",
            busy: "🔥 Tanda Ramai",
          };
          const active = sort === key;
          return (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-brand text-white"
                  : "border border-gray-200 bg-white text-gray-600 hover:border-brand hover:text-brand"
              }`}
            >
              {labels[key]}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">{rows.length} tempat</span>
          <button
            onClick={() => exportPlaces(sorted, "csv", title)}
            disabled={rows.length === 0}
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
            title="Unduh hasil scraping sebagai CSV"
          >
            ⬇ Export CSV
          </button>
          <button
            onClick={() => exportPlaces(sorted, "xlsx", title)}
            disabled={rows.length === 0}
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
            title="Unduh hasil scraping sebagai Excel (.xlsx)"
          >
            ⬇ Export Excel
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2.5 font-medium min-w-[220px]">Tempat</th>
              <th className="px-3 py-2.5 font-medium">Kategori</th>
              <th className="px-3 py-2.5 font-medium min-w-[360px]">Alamat</th>
              <th className="px-3 py-2.5 font-medium text-right">Rating</th>
              <th className="px-3 py-2.5 font-medium text-right">Review</th>
              <th className="px-3 py-2.5 font-medium min-w-[140px]">Tanda Ramai</th>
              <th className="px-3 py-2.5 font-medium">Jam Buka</th>
              <th className="px-3 py-2.5 font-medium">Telepon</th>
              <th className="px-3 py-2.5 font-medium">Website</th>
              <th className="px-3 py-2.5 font-medium">Koordinat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((p) => {
              const busy = busyLevel(p.review_count);
              const coords = fmtCoords(p.lat, p.lng);
              const hoursLines = formatHoursGroups(p.hours);
              return (
                <tr key={p.id} className="transition-colors hover:bg-green-50/30">
                  <td className="px-3 py-2.5">
                    {p.maps_url ? (
                      <a
                        href={p.maps_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-brand hover:underline"
                      >
                        {p.name}
                      </a>
                    ) : (
                      <span className="font-medium">{p.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 capitalize text-gray-500 whitespace-nowrap">
                    {p.category ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">
                    <span className="text-xs">{p.address ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {p.rating != null ? (
                      <span className="inline-flex items-center gap-0.5 font-medium">
                        <span className="text-xs text-yellow-500">★</span>
                        {p.rating}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                    {fmtNum(p.review_count)}
                  </td>
                  <td className="px-3 py-2.5">
                    {p.review_count != null ? (
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${busy.className}`}>
                        {busy.label}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {hoursLines.length > 0 ? (
                      <div className="space-y-0.5">
                        {hoursLines.map((line) => (
                          <div key={line} className="text-[10px] leading-tight text-gray-600 whitespace-nowrap">
                            🕒 {line}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                    {p.phone ? (
                      <a href={`tel:${p.phone}`} className="text-brand hover:underline">
                        {p.phone}
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {p.website ? (
                      <a
                        href={p.website}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-brand hover:underline"
                        title={p.website}
                      >
                        {p.website.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs text-gray-500">
                    {coords ? (
                      <a
                        href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-brand"
                        title="Buka di Maps"
                      >
                        {coords}
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
