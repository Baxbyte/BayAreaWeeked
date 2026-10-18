#!/usr/bin/env node
// Browser smoke test of the built site (dist/): key pages, filters, map, search, forms, SEO files.
//   npm run build && node scripts/test/smoke-browser.mjs [screenshotDir]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const DIST = path.resolve('dist');
const BASE = '/BayAreaWeeked';
const SHOTS = process.argv[2];
const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', xml: 'application/xml', svg: 'image/svg+xml', webp: 'image/webp', png: 'image/png', txt: 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (!p.startsWith(BASE)) { res.writeHead(404).end(); return; }
  p = path.join(DIST, p.slice(BASE.length));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404).end('nf'); return; }
  res.writeHead(200, { 'content-type': types[p.split('.').pop()] || 'application/octet-stream' }).end(fs.readFileSync(p));
}).listen(4399);
const U = (p) => `http://localhost:4399${BASE}${p}`;

const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? '✔' : '✘'} ${name}${info ? ` — ${info}` : ''}`); };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const shot = async (n) => SHOTS && page.screenshot({ path: `${SHOTS}/${n}.png` });
const count = async () => Number(((await page.textContent('[data-count]')) || '').replace(/[^\d]/g, '')) || 0;

// Home
await page.goto(U('/'), { waitUntil: 'load' });
const ld = await page.$$eval('script[type="application/ld+json"]', (s) => s.map((x) => x.textContent));
check('home: structured data', ld.some((t) => t.includes('WebSite')) && ld.some((t) => t.includes('SearchAction')), `${ld.length} blocks`);
check('home: real hero photo', await page.$eval('img', (i) => i.src.includes('/photos/wm-')).catch(() => false));
await shot('home');

// Explore: filters + map
await page.goto(U('/explore/'), { waitUntil: 'load' });
await page.waitForFunction(() => /\d/.test(document.querySelector('[data-count]')?.textContent || ''), null, { timeout: 15000 });
const all = await count();
check('explore: listings load', all > 100, `${all} results`);
check('explore: interactive map', !!(await page.$('#map .leaflet-container, #map.leaflet-container')));
await page.click('[data-region="east-bay"]'); await page.waitForTimeout(400);
const east = await count();
check('filter: East Bay region', east > 0 && east < all, `${east}`);
await page.click('[data-region=""]'); await page.waitForTimeout(300);
await page.check('input[data-vibe="kid-friendly"]').catch(() => {}); await page.waitForTimeout(400);
const kids = await count();
check('filter: kid-friendly', kids > 0 && kids < all, `${kids}`);
await page.uncheck('input[data-vibe="kid-friendly"]').catch(() => {});
await page.check('input[data-vibe="nightlife"]').catch(() => {}); await page.waitForTimeout(400);
const night = await count();
check('filter: adult nightlife', night > 0 && night < all, `${night}`);
await page.uncheck('input[data-vibe="nightlife"]').catch(() => {});
await page.click('[data-cat="live-music"]'); await page.waitForTimeout(400);
const music = await count();
check('filter: genre (live music)', music > 0 && music < all, `${music}`);
await page.click('[data-cat="live-music"]');
await page.click('[data-when="weekend"]').catch(() => {}); await page.waitForTimeout(400);
check('filter: this weekend', (await count()) > 0, `${await count()}`);
await page.click('[data-when="any"]').catch(() => {});
await shot('explore');
await page.fill('#sq', 'free outdoor things for kids in oakland'); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
check('smart search: natural language', (await count()) < all, `${await count()} for "free outdoor things for kids in oakland"`);
await page.fill('#sq', ''); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
await page.click('[data-spin]'); await page.waitForTimeout(800);
check('Spin the Bay picks something', await page.$eval('[data-spin-dialog]', (d) => d.open).catch(() => false));

// Breakdowns
for (const p of ['/this-weekend/', '/next-week/', '/hot-day/', '/rainy-day/', '/kid-friendly/', '/nightlife/', '/region/peninsula/', '/region/east-bay/', '/city/oakland/', '/city/san-francisco/mission-district/', '/directory/', '/plan/']) {
  const r = await page.goto(U(p), { waitUntil: 'load' });
  check(`page ${p}`, r.status() === 200 && (await page.$$('.card')).length + (await page.$$('a')).length > 20);
}
await page.goto(U('/hot-day/'), { waitUntil: 'load' }); await shot('hot-day');

// Event page
const ev = await page.goto(U('/this-weekend/'), { waitUntil: 'load' }).then(() => page.$eval('a[href*="/events/"]', (a) => a.getAttribute('href')));
await page.goto(`http://localhost:4399${ev}`, { waitUntil: 'load' });
const evld = await page.$$eval('script[type="application/ld+json"]', (s) => s.map((x) => x.textContent).join(' '));
check('event page: Event schema + breadcrumbs', /"@type":"(\w*Event|Event)"/.test(evld) && evld.includes('BreadcrumbList'));
await shot('event');

// Sponsors / signup
await page.goto(U('/advertise/'), { waitUntil: 'load' });
check('advertise: bid form + live bid board', !!(await page.$('#bid')) && !!(await page.$('#bid-board')));
await page.goto(U('/deals/'), { waitUntil: 'load' });
check('deals page', (await page.title()).length > 0);
await page.goto(U('/subscribe/'), { waitUntil: 'load' });
check('email signup form (V2 prep)', !!(await page.$('form input[type="email"]')));
await shot('subscribe');

// Indexing files
for (const f of ['/sitemap.xml', '/sitemap-events.xml', '/robots.txt', '/rss.xml', '/feed.json', '/llms.txt']) {
  const r = await page.goto(U(f));
  check(`SEO file ${f}`, r.status() === 200 && (await r.text()).length > 100);
}
check('no JavaScript errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); server.close();
const bad = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - bad}/${results.length} checks passed`);
process.exit(bad ? 1 : 0);
