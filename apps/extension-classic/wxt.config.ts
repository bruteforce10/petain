import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  runner: {
    binaries: {
      chrome: process.env.CHROME_PATH || '/opt/thorium-browser-avx2/thorium',
    },
  },
  manifest: {
    name: 'TerraMap Classic (Area)',
    description: 'Pick a point + radius on a map, scrape every POI inside it',
    permissions: ['storage', 'activeTab', 'scripting', 'tabs'],
    host_permissions: ['https://*.google.com/*'],
  },
});
