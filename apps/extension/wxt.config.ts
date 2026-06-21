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

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  runner: chromeBinary ? {
    binaries: {
      chrome: chromeBinary,
    },
  } : undefined,
  manifest: {
    name: 'Petain Scrapper',
    description: 'Ekstensi untuk mengekstrak data POI dari Google Maps ke dalam format CSV/XLSX untuk riset bisnis lokal.',
    version: '1.0.0',
    icons: {
      "16": "icon.png",
      "48": "icon.png",
      "128": "icon.png"
    },
    permissions: ['storage', 'activeTab', 'scripting', 'tabs', 'alarms'],
    host_permissions: ['https://*.google.com/*'],
    web_accessible_resources: [
      {
        resources: ['popup.html', 'logo.svg'],
        matches: ['https://*.google.com/*'],
      },
    ],
  },
});
