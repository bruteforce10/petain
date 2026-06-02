import { defineConfig } from 'wxt';
import { existsSync } from 'node:fs';

const chromeBinary = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/opt/thorium-browser-avx2/thorium',
].find((path): path is string => Boolean(path && existsSync(path)));

// https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  runner: chromeBinary ? {
    binaries: {
      chrome: chromeBinary,
    },
  } : undefined,
  manifest: {
    name: 'TerraMap Scraper',
    description: 'Scrape Google Maps places & Shopee/Tokopedia products to Supabase',
    permissions: ['storage', 'activeTab', 'scripting', 'tabs'],
    host_permissions: [
      'https://*.google.com/*',
      'https://*.shopee.co.id/*',
      'https://*.tokopedia.com/*',
    ],
  },
});
