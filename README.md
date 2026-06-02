# Petain

Monorepo for **Petain**: a Chrome (MV3) **extension** that scrapes Google Maps
places and Shopee / Tokopedia products into **Supabase**, plus a **web dashboard**
to browse what you've saved. Built with Bun + Turborepo + TypeScript.

> ⚠️ Scraping these sites violates their Terms of Service. Use for personal
> experiments only. Risk: account ban / IP block. Site layout changes will break
> scrapers — adjust selectors in `apps/extension/lib/scrapers/*`.

## Layout

```
apps/
  extension/   WXT + React MV3 extension (scrapers, popup, background)
  web/         Next.js (App Router) landing page + saved-rows dashboard
packages/
  types/       shared data shapes (Product, Place, ProductRow, messages)
  supabase/    createPetainClient() factory + fetchProducts/fetchPlaces
  ui/          shared React components (ProductTable, EmptyState)
  config/      shared tsconfig base + Tailwind preset
```

## How it works

- Content scripts run in your logged-in browser session (bypasses anti-bot).
- Marketplace scrapers intercept the sites' internal JSON APIs
  (`*-api.content.ts` in MAIN world), with DOM scraping as fallback.
- Google Maps is DOM-scraped (no clean JSON API).
- The background service worker batch-inserts rows into Supabase.
- The web dashboard reads the same rows directly via the Supabase client (RLS
  scopes results to the logged-in user).

## Setup

Requires [Bun](https://bun.sh). One Supabase project serves both apps.

1. Create a Supabase project. In SQL Editor, run `apps/extension/supabase/schema.sql`.
2. `bun install` (root).
3. Extension env: `cp apps/extension/.env.example apps/extension/.env` →
   fill `WXT_SUPABASE_URL` + `WXT_SUPABASE_ANON_KEY`.
4. Web env: `cp apps/web/.env.example apps/web/.env.local` →
   fill `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Create a user: Supabase → Authentication → Add user (or enable signups).

## Commands (run from root)

```
bun run dev:ext     # WXT dev → load apps/extension/.output/chrome-mv3 unpacked
bun run dev:web     # Next.js dev → http://localhost:3000
bun run dev         # both via turbo
bun run build       # build extension + web
bun run compile     # tsc --noEmit across all packages
```

## Usage

1. **Extension:** click icon → log in → open a Google Maps / Shopee / Tokopedia
   search page → "Scrape this page". Rows land in Supabase `places` / `products`.
2. **Web:** open `/`, click "View saved data" → log in with the same account →
   the dashboard lists your saved products (newest first).
