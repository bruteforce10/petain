import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { PlaceRow } from '@terramap/types';

export type ExportFormat = 'csv' | 'xlsx';

/** Columns we serialize to CSV/XLSX. JSON-ish fields are flattened. */
const COLUMNS = [
  'id',
  'scrape_session_id',
  'keyword',
  'area_center_lat',
  'area_center_lng',
  'area_radius_m',
  'name',
  'category',
  'address',
  'rating',
  'review_count',
  'price_level',
  'phone',
  'website',
  'lat',
  'lng',
  'maps_url',
  'plus_code',
  'is_closed',
  'service_options',
  'hours',
  'rating_breakdown',
  'photo_count',
  'scraped_at',
] as const;

function flatten(row: PlaceRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of COLUMNS) {
    const v = (row as unknown as Record<string, unknown>)[k];
    if (v == null) {
      out[k] = '';
    } else if (Array.isArray(v)) {
      out[k] = v.join('|');
    } else if (typeof v === 'object') {
      out[k] = JSON.stringify(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Build a CSV/XLSX from PlaceRows and trigger a browser download.
 * Filename defaults to `terramap-<session>-<timestamp>.<ext>` when not given.
 */
export function exportPlaces(
  rows: PlaceRow[],
  format: ExportFormat,
  filename?: string,
): void {
  const flat = rows.map(flatten);
  const session = rows[0]?.scrape_session_id?.slice(0, 8) ?? 'all';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = filename ?? `terramap-${session}-${stamp}.${format}`;

  if (format === 'csv') {
    const csv = Papa.unparse(flat, { columns: COLUMNS as unknown as string[] });
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), name);
    return;
  }

  const ws = XLSX.utils.json_to_sheet(flat, { header: COLUMNS as unknown as string[] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'places');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  triggerDownload(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    name,
  );
}
