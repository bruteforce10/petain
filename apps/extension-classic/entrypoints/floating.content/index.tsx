import { defineContentScript } from 'wxt/sandbox';
import { createRoot } from 'react-dom/client';
import React from 'react';
import App from './App';
import './style.css';

export default defineContentScript({
  matches: ['https://www.google.com/maps/*', 'https://maps.google.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const { createShadowRootUi } = await import('wxt/client');
    
    const ui = await createShadowRootUi(ctx, {
      name: 'petain-floating-ui',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      onMount: (container) => {
        const root = createRoot(container);
        root.render(<App />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
