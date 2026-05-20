import { defineConfig } from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // `wxt dev` auto-launches a Chromium browser. No google-chrome on this box;
  // point it at the installed Thorium (Chromium fork). Override with CHROME_PATH.
  runner: {
    binaries: {
      chrome: process.env.CHROME_PATH || '/opt/thorium-browser-avx2/thorium',
    },
  },
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
