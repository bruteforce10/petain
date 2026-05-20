# TerraMap

Chrome (MV3) extension that scrapes **Google Maps places** and **Shopee /
Tokopedia products**, then stores them in **Supabase**. Built with WXT + React +
TypeScript + Tailwind.

> ⚠️ Scraping these sites violates their Terms of Service. Use for personal
> experiments only. Risk: account ban / IP block. Site layout changes will break
> scrapers — adjust selectors in `lib/scrapers/*`.

## How it works

- Content scripts run in your logged-in browser session (bypasses anti-bot).
- Marketplace scrapers intercept the sites' internal JSON APIs (`*-api.content.ts`
  in MAIN world) for stability, with DOM scraping as fallback.
- Google Maps is DOM-scraped (no clean JSON API).
- The background service worker batch-inserts rows into Supabase.

## Setup

1. Create a Supabase project. In SQL Editor, run `supabase/schema.sql`.
2. `cp .env.example .env` and fill `WXT_SUPABASE_URL` + `WXT_SUPABASE_ANON_KEY`
   (Supabase → Settings → API).
3. Create a user: Supabase → Authentication → Add user (or enable signups).
4. `npm install`
5. `npm run dev` → load `.output/chrome-mv3` as an unpacked extension
   (chrome://extensions → Developer mode → Load unpacked).

## Usage

1. Click the extension icon → log in.
2. Open Google Maps (search results), Shopee, or Tokopedia search page.
3. Reopen popup → "Scrape this page". Rows land in Supabase `places` / `products`.

## Layout

```
entrypoints/         background, content scripts, popup
lib/scrapers/        gmaps.ts, shopee.ts, tokopedia.ts
lib/supabase.ts      Supabase client (session in chrome.storage)
lib/types.ts         Place, Product, message types
utils/               apiIntercept.ts (MAIN-world fetch/XHR hook), scroll.ts
supabase/schema.sql  tables + RLS
```
