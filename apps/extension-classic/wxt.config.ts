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
    name: 'Petain',
    description: 'Riset bisnis lokal dari Google Maps — scrape kompetitor per kecamatan.',
    permissions: ['storage', 'activeTab', 'scripting', 'tabs', 'alarms'],
    host_permissions: ['https://*.google.com/*'],
  },
});
