import { defineConfig } from 'astro/config';
import { SITE_URL } from './src/lib/site.mjs';

const base = new URL(SITE_URL).pathname.replace(/\/$/, '') || '/';

export default defineConfig({
  site: new URL(SITE_URL).origin,
  base,
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  compressHTML: true,
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  vite: { build: { chunkSizeWarningLimit: 900 } },
});
