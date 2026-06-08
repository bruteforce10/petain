import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { PlaceRow } from '@terramap/types';

export type ExportFormat = 'csv' | 'xlsx';

/** Same thresholds as PlaceTable so the export matches what's on screen. */
function busyLabel(reviewCount: number | null | undefined): string {
  if (reviewCount == null) return '';
  if (reviewCount >= 1000) return 'Sangat Ramai';
  if (reviewCount >= 200) return 'Ramai';
  if (reviewCount >= 50) return 'Normal';
  return 'Sepi';
}

const DAY_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

/** Flatten the day -> hours map into one tidy "Senin: 09:00–22:00 ; …" string. */
function formatHours(hours: Record<string, string> | null | undefined): string {
  if (!hours) return '';
  const keys = Object.keys(hours);
  const parts: string[] = [];
  const used = new Set<string>();

  for (const day of DAY_ORDER) {
    const key = keys.find((k) => k.toLowerCase() === day.toLowerCase());
    if (key) {
      used.add(key);
      if (hours[key]) parts.push(`${day}: ${hours[key]}`);
    }
  }
  // Keep any non-standard keys we didn't recognise.
  for (const key of keys) {
    if (!used.has(key) && hours[key]) parts.push(`${key}: ${hours[key]}`);
  }
  return parts.join(' ; ');
}

function fmtDateTime(v: string | null | undefined): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

interface Column {
  header: string;
  /** Excel column width in characters. */
  width: number;
  get: (row: PlaceRow) => string | number;
}

/**
 * Human-friendly columns mirroring the dashboard table — no internal ids or
 * raw JSON, so the exported file is ready to read in Excel.
 */
const COLUMNS: Column[] = [
  { header: 'Nama Tempat', width: 32, get: (r) => r.name ?? '' },
  { header: 'Kategori', width: 18, get: (r) => r.category ?? '' },
  { header: 'Alamat', width: 48, get: (r) => r.address ?? '' },
  { header: 'Rating', width: 8, get: (r) => r.rating ?? '' },
  { header: 'Jumlah Review', width: 14, get: (r) => r.review_count ?? '' },
  { header: 'Tingkat Keramaian', width: 16, get: (r) => busyLabel(r.review_count) },
  { header: 'Tingkat Harga', width: 16, get: (r) => r.price_level ?? '' },
  { header: 'Telepon', width: 16, get: (r) => r.phone ?? '' },
  { header: 'Website', width: 32, get: (r) => r.website ?? '' },
  { header: 'Jam Buka', width: 42, get: (r) => formatHours(r.hours) },
  { header: 'Layanan', width: 24, get: (r) => r.service_options?.join(', ') ?? '' },
  { header: 'Status', width: 14, get: (r) => (r.is_closed ? 'Tutup Permanen' : 'Buka') },
  { header: 'Jumlah Foto', width: 12, get: (r) => r.photo_count ?? '' },
  { header: 'Latitude', width: 12, get: (r) => r.lat ?? '' },
  { header: 'Longitude', width: 12, get: (r) => r.lng ?? '' },
  { header: 'Link Google Maps', width: 42, get: (r) => r.maps_url ?? '' },
  { header: 'Kata Kunci', width: 20, get: (r) => r.keyword ?? '' },
  { header: 'Waktu Scrape', width: 22, get: (r) => fmtDateTime(r.scraped_at) },
];

function toRecords(rows: PlaceRow[]): Record<string, string | number>[] {
  return rows.map((row) => {
    const out: Record<string, string | number> = {};
    for (const col of COLUMNS) out[col.header] = col.get(row);
    return out;
  });
}

/** Make a safe, tidy file label out of a run title / keyword. */
function slugify(s: string): string {
  const cleaned = s
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'hasil-scraping';
}

function buildFilename(rows: PlaceRow[], format: ExportFormat, baseName?: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const label = slugify(baseName ?? rows[0]?.keyword ?? 'hasil-scraping');
  return `${label}-${stamp}.${format}`;
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
 * Build a tidy CSV/XLSX from PlaceRows and trigger a browser download.
 *
 * @param rows     places to export (export them already sorted to match the UI)
 * @param format   'csv' or 'xlsx'
 * @param baseName optional file label (e.g. the run title); a date is appended
 */
export function exportPlaces(
  rows: PlaceRow[],
  format: ExportFormat,
  baseName?: string,
): void {
  const headers = COLUMNS.map((c) => c.header);
  const records = toRecords(rows);
  const name = buildFilename(rows, format, baseName);

  if (format === 'csv') {
    const csv = Papa.unparse(records, { columns: headers });
    // Prepend a UTF-8 BOM (U+FEFF) so Excel renders Indonesian characters
    // (and the "–" dash in hours) correctly instead of mojibake.
    const BOM = '﻿';
    triggerDownload(
      new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' }),
      name,
    );
    return;
  }

  const ws = XLSX.utils.json_to_sheet(records, { header: headers });
  ws['!cols'] = COLUMNS.map((c) => ({ wch: c.width }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hasil Scraping');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  triggerDownload(
    new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    name,
  );
}
