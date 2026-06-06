# Merge `apps/labs` dashboard into `apps/web` (Next.js)

## Context
Monorepo punya dua app web: `apps/web` (Next.js 16, landing page marketing "Petain") dan `apps/labs` (Vite SPA, dashboard hasil scraping + auth Supabase). Tujuan: satukan ke satu app Next.js — home + login + register + dashboard dalam satu domain/deploy, navbar di home punya tombol Login. Extension tetap terpisah.

Semua logic data & auth sudah ada di shared package `@terramap/supabase` (`fetchScrapeRuns`, `fetchPlacesByRun`, `renameScrapeRun`, dst.) dan komponen UI tinggal di-port. Tantangan utamanya bukan logic, tapi adaptasi platform: Vite→Next, `import.meta.env.VITE_*`→`process.env.NEXT_PUBLIC_*`, Tailwind v3 (`bg-brand`)→v4, dan auth localStorage→cookie SSR.

**Keputusan user:**
- Auth model: **cookie SSR** (`@supabase/ssr`) — proteksi route server-side, no flash.
- Scope auth: **Login + Register** (labs sekarang cuma login).
- `apps/labs`: **biarkan dulu** (jangan dihapus) sampai user yakin. Tidak ubah root `package.json` script `dev:labs`.

## Approach

Pindahkan dashboard labs ke `apps/web` sebagai route baru, pakai cookie-based Supabase auth via `@supabase/ssr`. Reuse 100% fungsi dari `@terramap/supabase` dan komponen `@terramap/ui` (`ProductTable`, `EmptyState`). Port 5 file komponen labs + ganti entry point browser supabase dari localStorage ke cookie client.

### Struktur akhir `apps/web/src`
```
app/
  page.tsx                 # + Navbar (tombol Login → /login)
  login/page.tsx           # dari LoginForm di labs App.tsx
  register/page.tsx        # BARU: supabase.auth.signUp
  dashboard/
    page.tsx               # server component: cek user, redirect kalau null
    DashboardClient.tsx    # dari Viewer di labs App.tsx (client)
components/
  Navbar.tsx               # BARU
  dashboard/
    ScrapeRunList.tsx      # port dari labs (no changes besar)
    ScrapeRunDetail.tsx    # port; ganti import supabase + tambah 'use client'
    AreaAnalysis.tsx       # port; tambah 'use client'
    PlaceTable.tsx         # port; tambah 'use client'
  ui/
    tooltip.tsx            # port dari labs (radix)
lib/
  supabase/
    client.ts              # createBrowserClient (cookie)
    server.ts              # createServerClient (cookie + next/headers)
middleware.ts              # refresh sesi + proteksi /dashboard
```

## Langkah implementasi

### 1. Dependencies & env
- `apps/web/package.json` tambah:
  - `@supabase/ssr`, `@supabase/supabase-js` (untuk type `Session`/`SupabaseClient`)
  - `@radix-ui/react-tooltip` (dipakai `tooltip.tsx`)
  - `@terramap/supabase`: `workspace:*`, `@terramap/types`: `workspace:*`
- Buat `apps/web/.env.local` + `apps/web/.env.example`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=...
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...
  ```
  (isi nilai dari `apps/labs/.env`; `.env.local` sudah di-gitignore). Jalankan `bun install` di root.
- `apps/web/next.config.ts`: kalau build gagal resolve workspace TS package, tambah `transpilePackages: ["@terramap/supabase", "@terramap/types", "@terramap/ui"]`. (Web sekarang sudah import `@terramap/ui` tanpa ini, jadi mungkin tak perlu — verifikasi saat build.)

### 2. Supabase clients (cookie-based)
Ganti pola `lib/supabase-browser.ts` labs (yang pakai `createTerramapClient` + localStorage) dengan dua factory `@supabase/ssr`:
- `lib/supabase/client.ts` — `createBrowserClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)`. Dipakai semua komponen client (`signInWithPassword`, `signUp`, `signOut`, `fetch*`).
- `lib/supabase/server.ts` — `async createClient()` pakai `createServerClient` + `cookies()` dari `next/headers` (Next 16: `await cookies()`), dengan `getAll`/`setAll` (try/catch di `setAll` untuk Server Component). Dipakai `dashboard/page.tsx`.

> Penting: client browser HARUS dari `@supabase/ssr` (bukan `createTerramapClient`) supaya sesi disimpan di cookie, bisa dibaca middleware & server component. Fungsi data dari `@terramap/supabase` tetap dipakai apa adanya — semua terima `client` sebagai argumen.

### 3. Middleware proteksi route
`apps/web/src/middleware.ts` (pola resmi `@supabase/ssr`):
- `createServerClient` dengan cookie `getAll`/`setAll` dari `request`/`response`.
- Panggil `supabase.auth.getUser()` (jangan ada kode antara create & getUser).
- Kalau `!user` dan path mulai `/dashboard` → redirect `/login`.
- (Opsional) kalau `user` ada dan path `/login`|`/register` → redirect `/dashboard`.
- `config.matcher` exclude `_next/static`, `_next/image`, `favicon.ico`, file gambar.
- Return `supabaseResponse` apa adanya.

### 4. Halaman auth (Login + Register)
- `app/login/page.tsx` — port `LoginForm` dari `apps/labs/src/App.tsx`. `'use client'`, pakai browser client `signInWithPassword`; sukses → `router.push('/dashboard')` + `router.refresh()`. Tambah link ke `/register`.
- `app/register/page.tsx` — BARU, struktur mirip login tapi `supabase.auth.signUp({ email, password })`. Tampilkan pesan "cek email konfirmasi" kalau Supabase email confirmation aktif; kalau sesi langsung ada → redirect `/dashboard`. Link balik ke `/login`.
  - Catatan: email confirmation diatur di Supabase dashboard (Auth settings) — di luar kode.

### 5. Dashboard
- `app/dashboard/page.tsx` — server component: `const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect('/login');` lalu render `<DashboardClient email={user.email} />`. (Middleware sudah proteksi; ini lapis kedua + sumber email.)
- `app/dashboard/DashboardClient.tsx` — `'use client'`, port `Viewer` dari labs `App.tsx`: state `runs`/`selectedId`, `fetchScrapeRuns(supabase)`, render `ScrapeRunList`/`ScrapeRunDetail`/`EmptyState`, tombol logout `supabase.auth.signOut()` → `router.push('/login')`.

### 6. Port komponen labs → `components/dashboard/`
Pindahkan 4 komponen + tooltip. Perubahan per file:
- **Semua** yang pakai `useState`/`useEffect`/`useMemo`/`window`: tambah `'use client'` di baris atas.
- `ScrapeRunDetail.tsx`: ganti `import { supabase } from '../../lib/supabase-browser'` → `import { supabase } from '@/lib/supabase/client'` (atau buat instance via `createClient()`); update import relatif `./PlaceTable`, `./AreaAnalysis` → tetap relatif dalam folder dashboard. `window.confirm` OK di client component.
- `AreaAnalysis.tsx`: import tooltip ganti `@/components/ui/tooltip` (alias `@/` web → `./src/*`, sudah ada di `tsconfig.json`). Tambah `'use client'`.
- `ScrapeRunList.tsx`, `PlaceTable.tsx`: tambah `'use client'`; import `@terramap/types` tetap.
- `tooltip.tsx`: copy apa adanya (radix), tambah `'use client'`.

### 7. Tailwind brand color (v3 → v4)
Labs pakai `bg-brand`, `text-brand`, `bg-brand-dark`, `hover:border-brand`, `hover:text-brand` (dari preset `@terramap/config`: brand `#16a34a`, brand-dark `#15803d`). Web Tailwind v4 belum punya. Tambah di `apps/web/src/app/globals.css` dalam blok `@theme inline`:
```css
--color-brand: #16a34a;
--color-brand-dark: #15803d;
```
Ini auto-generate util `bg-brand`, `text-brand`, `border-brand`, `bg-brand-dark`, dst. — semua kelas labs jalan tanpa edit komponen.

### 8. Navbar di home
- `components/Navbar.tsx` — `'use client'` (atau server kalau tak ada state). Logo + tombol `Login` (`<Link href="/login">`). Style ikut tema web (warna primary `rgb(0 55 46)` dari `@terramap/ui` globals).
- `app/page.tsx`: render `<Navbar />` di atas konten. (Opsional: deteksi sesi untuk tampilkan "Dashboard" vs "Login" — bisa via server wrapper, tapi MVP cukup tombol Login statis.)

## File yang disentuh (ringkas)
**Baru:** `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts`, `app/login/page.tsx`, `app/register/page.tsx`, `app/dashboard/page.tsx`, `app/dashboard/DashboardClient.tsx`, `components/Navbar.tsx`, `components/dashboard/{ScrapeRunList,ScrapeRunDetail,AreaAnalysis,PlaceTable}.tsx`, `components/ui/tooltip.tsx`, `.env.local`, `.env.example`.
**Diubah:** `package.json` (deps), `src/app/globals.css` (brand), `src/app/page.tsx` (navbar), mungkin `next.config.ts`.
**Tidak disentuh:** `apps/labs` (dibiarkan), root `package.json`, `@terramap/*` packages.

## Verifikasi (end-to-end)
1. `bun install` di root sukses.
2. `bun run dev:web` (atau `cd apps/web && bun run dev`) — landing page tampil + navbar dengan tombol Login.
3. Buka `/dashboard` tanpa login → redirect ke `/login` (middleware jalan, no flash).
4. `/register` → daftar user baru. Jika email confirmation aktif: muncul pesan cek email. Jika tidak: langsung masuk `/dashboard`.
5. `/login` dengan kredensial valid → redirect `/dashboard`, daftar scrape runs muncul (data sama seperti labs).
6. Buka satu run gmaps → `AreaAnalysis` + `PlaceTable` render, tooltip "Gap Score" jalan, sorting `PlaceTable` jalan. Run non-gmaps → `ProductTable`.
7. Rename & Delete run berfungsi (window.confirm). Logout → balik `/login`, lalu `/dashboard` ke-block lagi.
8. `cd apps/web && bun run check` (lint + typecheck + build) hijau. Cek warna `bg-brand`/`text-brand` ter-render hijau, bukan transparan.
9. Bandingkan tampilan dashboard dengan labs lama (`bun run dev:labs`) — fungsional setara.
