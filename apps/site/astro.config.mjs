import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://howitflows.dev',
  integrations: [react(), sitemap()],
  vite: {
    // the snippet studio's highlighter is only found once a database page loads; pre-bundle it
    optimizeDeps: { include: ['highlight.js/lib/core'] },
  },
  redirects: {
    '/databases': '/databases/postgres',
  },
});
