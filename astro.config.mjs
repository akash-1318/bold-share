// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

import node from '@astrojs/node';

// TODO: replace with the real production domain before deploying.
const SITE_URL = 'https://boldshare.app';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  site: SITE_URL,
  integrations: [
    react(),
    sitemap({
      // /p/ and /f/ are ephemeral, user-generated share links and must
      // never be indexed or listed in the sitemap.
      filter: (page) => !page.includes('/p/') && !page.includes('/f/'),
    }),
  ],

  vite: {
    plugins: [tailwindcss()]
  },

  adapter: node({
    mode: 'standalone'
  })
});
