# Design: Port Kalkulator HPP ke apps/web

Tanggal: 2026-07-11 · Status: disetujui implisit (request eksplisit user, sesi otonom)

## Tujuan

Memindahkan fitur kalkulator HPP (aplikasi Vite standalone di `kalkulator-hpp/`) ke monolith
Next.js `apps/web` sebagai halaman `/kalkulator-hpp`, dengan menu navigasi bersama di area
dashboard sehingga user bisa berpindah antara **Dashboard** (riwayat scrape/tabel) dan
**Kalkulator HPP**. Fungsi harus setara 1:1 dengan aplikasi asal.

## Keputusan Arsitektur

1. **Route**: `/kalkulator-hpp`, auth-gated seperti `/dashboard` (proxy.ts + cek user di server
   page). Alasan: menu dashboard mengasumsikan user login; konsisten dengan pola yang ada.
2. **Gemini pindah ke server**. Aplikasi asal memakai `VITE_GEMINI_API_KEY` di client — key bocor
   ke bundle browser. Port memakai pola yang sudah ada di web (`/api/ai-summary` +
   `lib/ai/marketSummary.ts`): REST fetch ke Gemini dengan `responseSchema` (structured output),
   key `GEMINI_API_KEY` server-only yang sudah terpasang. Route baru: `POST /api/hpp-ai` dengan
   `action: "costs" | "price"`. Fallback multi-model + regex-extract JSON dari versi asal dibuang —
   structured output menjamin JSON valid (KISS, konsisten dengan marketSummary).
3. **Logika murni di-port apa adanya** ke TypeScript: `src/lib/hpp/format.ts` (parsing/format
   angka id-ID + konversi satuan) dan `src/lib/hpp/calculations.ts` (HPP, rekomendasi harga,
   markup/margin, BEP, simulasi). Test suite asal (vitest) di-port ke `bun:test` (runner monorepo).
4. **UI primitives baru** `card/input/select/label` di `src/components/ui/` bergaya shadcn
   base-nova (token design system @terramap/ui), memakai `Button` yang sudah ada. Komponen fitur
   di `src/components/hpp/` (satu file per kartu, mengikuti aturan file kecil).
5. **Navigasi**: `DashboardShell` (header brand + tab "Dashboard" / "Kalkulator HPP" via Link +
   email + logout) dipakai `/dashboard` dan `/kalkulator-hpp`; `DashboardClient` dirapikan agar
   memakai shell yang sama (penyesuaian UI/UX yang diminta).
6. **Dependency baru**: `recharts` (grafik profit). Versi 3.x (kompatibel React 19).
7. **UX perbaikan kecil saat port**: `alert()` diganti banner error inline; `console.log` dibuang;
   handler state memakai functional update immutable.

## Komponen

| Asal (jsx) | Tujuan (tsx) |
|---|---|
| App.jsx (state + layout) | `app/kalkulator-hpp/KalkulatorHppClient.tsx` + `components/hpp/ProductInfoCard.tsx` |
| VariableCostsInput | `components/hpp/VariableCostsCard.tsx` |
| FixedCostsInput | `components/hpp/FixedCostsCard.tsx` |
| HPPResult | `components/hpp/HppResultCard.tsx` |
| PriceRecommendation | `components/hpp/PriceRecommendationSection.tsx` |
| ProfitAnalysis | `components/hpp/ProfitAnalysisCard.tsx` |
| BEPAnalysis | `components/hpp/BepAnalysisCard.tsx` |
| ProfitChart | `components/hpp/ProfitChartCard.tsx` |
| SimulationTable | `components/hpp/SimulationTableCard.tsx` |
| lib/gemini.js (client) | `lib/ai/hppSuggestions.ts` (server) + `api/hpp-ai/route.ts` |

## Alur Data

Input form (string terformat id-ID) → `parseFormattedNumber` → `calculateHPP` (derived setiap
render, tanpa efek samping) → kartu hasil/rekomendasi → pilih harga → analisis profit + BEP +
grafik + tabel simulasi. Tombol AI → `fetch("/api/hpp-ai")` → isi ulang state biaya / rekomendasi
harga.

## Error Handling

- API route: 400 body invalid, 401 belum login, 500 `AiConfigError` (key belum diatur), 502
  kegagalan Gemini; pesan bahasa Indonesia (pola ai-summary).
- Client: banner error inline per aksi AI; validasi input angka via `sanitizeNumberInput`.

## Testing

- `bun test` untuk `format.test.ts` + `calculations.test.ts` (port 1:1 dari suite vitest asal,
  perilaku terjaga — angka snapshot skenario "Kopi Susu Gula Aren").
- Verifikasi akhir: `npm run check` (lint + typecheck + build) di apps/web.
