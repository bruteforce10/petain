import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  runner: {
    binaries: {
      chrome: process.env.CHROME_PATH || '/opt/thorium-browser-avx2/thorium',
    },
  },
  manifest: {
    name: 'TerraMap Agent',
    description: 'Chat with Claude to scrape Google Maps and analyse a business area',
    permissions: ['storage', 'activeTab', 'scripting', 'tabs'],
    host_permissions: ['https://*.google.com/*', 'https://api.anthropic.com/*'],
  },
});
