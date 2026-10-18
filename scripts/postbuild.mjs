#!/usr/bin/env node
// After `astro build`: write XML sitemaps (with honest lastmod dates) and the IndexNow key file.
import fs from 'node:fs';
import path from 'node:path';
import { SITE, SITE_URL, BASE_PATH } from '../src/lib/site.mjs';

const DIST = path.resolve('dist');
const data = JSON.parse(fs.readFileSync(process.env.EVENTS_FILE || 'data/events.json', 'utf8'));
const built = new Date().toISOString();
const bySlug = new Map(data.items.map((i) => [`${i.type === 'activity' ? 'things-to-do' : 'events'}/${i.slug}`, i]));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'index.html') out.push(p);
  }
  return out;
}

const groups = { pages: [], events: [], places: [] };
for (const file of walk(DIST)) {
  const rel = path.relative(DIST, path.dirname(file)).split(path.sep).join('/');
  if (rel === '404') continue;
  const html = fs.readFileSync(file, 'utf8');
  if (/<meta name="robots" content="noindex/.test(html)) continue;
  const loc = `${SITE_URL}/${rel ? `${rel}/` : ''}`;
  const item = bySlug.get(rel);
  if (item) {
    const img = item.image ? `<image:image><image:loc>${xml(item.image)}</image:loc></image:image>` : '';
    (item.type === 'activity' ? groups.places : groups.events).push(`<url><loc>${xml(loc)}</loc><lastmod>${new Date(item.updatedAt || item.firstSeen || data.generatedAt).toISOString()}</lastmod>${img}</url>`);
  } else {
    // Hub pages (weekend, cities, neighborhoods, genres, vibes) are regenerated with fresh listings on every data update.
    groups.pages.push(`<url><loc>${xml(loc)}</loc><lastmod>${new Date(data.generatedAt || built).toISOString()}</lastmod><changefreq>daily</changefreq></url>`);
  }
}

function xml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const files = [];
for (const [name, urls] of Object.entries(groups)) {
  if (!urls.length) continue;
  const file = `sitemap-${name}.xml`;
  fs.writeFileSync(path.join(DIST, file), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`);
  files.push(file);
}
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files.map((f) => `<sitemap><loc>${SITE_URL}/${f}</loc><lastmod>${built}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>\n`);

// IndexNow ownership proof: https://<host>/<key>.txt must contain the key.
fs.writeFileSync(path.join(DIST, `${SITE.indexNowKey}.txt`), SITE.indexNowKey);
// GitHub Pages: disable Jekyll processing so every file is served as-is.
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

console.log(`postbuild: ${groups.pages.length} pages, ${groups.events.length} events, ${groups.places.length} places in sitemaps (base: ${BASE_PATH || '/'})`);
