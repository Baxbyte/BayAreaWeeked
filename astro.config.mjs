import { defineConfig } from 'astro/config';

const SITE_URL = (process.env.SITE_URL || 'https://baxbyte.github.io/BayAreaWeeked').replace(/\/$/, '');
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
