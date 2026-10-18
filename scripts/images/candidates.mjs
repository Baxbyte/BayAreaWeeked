#!/usr/bin/env node
// Gathers ~10 candidate photos per target and renders numbered contact sheets for hand-picking.
// Picks go into data/photo-picks.json; only picked photos are published.
//   node scripts/images/candidates.mjs <outDir>     (needs `playwright`)
import fs from 'node:fs';
import { chromium } from 'playwright';
import { fromCategory, fromSearch } from './commons.mjs';
import { CATEGORY_SRC, HOOD_CATS, PLACE_CATS, REGION_SRC, VIBE_SRC } from './plans.mjs';

const out = process.argv[2] || 'candidates';
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
fs.mkdirSync(out, { recursive: true });

const EXTRA = {
  'genre:live-music': ['q:concert San Francisco crowd|San Francisco', 'q:concert Oakland crowd|Oakland', 'cat:Concerts in San Francisco'],
  'genre:nightlife': ['cat:Nightclubs in San Francisco', 'cat:Bars in San Francisco', 'q:nightclub San Francisco|San Francisco', 'q:DJ San Francisco|San Francisco'],
  'genre:comedy': ['q:comedy show San Francisco|comedy', 'q:stand-up comedian|comedian', 'cat:Sketchfest'],
  'genre:theater': ['cat:Curran Theatre', 'cat:San Francisco Ballet', 'q:theatre performance San Francisco|San Francisco'],
  'genre:arts': ['cat:Exhibitions in San Francisco', 'q:art gallery San Francisco visitors|San Francisco'],
  'genre:film': ['q:San Francisco International Film Festival|film', 'q:outdoor movie San Francisco|movie'],
  'genre:food-drink': ['cat:Restaurants in San Francisco', 'q:food truck San Francisco|San Francisco', 'q:Oakland restaurant|Oakland'],
  'genre:markets': ['cat:Farmers markets in San Francisco', 'cat:Farmers markets in California', 'q:farmers market Berkeley|Berkeley'],
  'genre:festivals': ['cat:Dia de los Muertos in San Francisco', 'cat:San Francisco Pride Parade 2019', 'q:street fair San Francisco|San Francisco'],
  'genre:outdoors': ['cat:Golden Gate Park', 'q:hikers Marin|Marin', 'q:Crissy Field people|Crissy'],
  'genre:sports': ['cat:San Francisco Giants fans', 'q:Warriors fans Chase Center|Warriors', 'q:Oracle Park game|Oracle'],
  'genre:wellness': ['q:yoga San Francisco|yoga', 'q:yoga park California|yoga', 'q:runners San Francisco|San Francisco'],
  'genre:learning': ['q:lecture San Francisco|San Francisco', 'q:library San Francisco reading|library'],
  'genre:tech': ['cat:TechCrunch Disrupt', 'cat:Dreamforce', 'q:hackathon San Francisco|hackathon'],
  'genre:community': ['q:volunteers San Francisco|volunteers', 'q:community garden San Francisco|garden', 'q:volunteers Oakland|Oakland'],
  'genre:family': ['q:children Exploratorium|Exploratorium', 'q:family Golden Gate Park|Golden Gate Park'],
  'region:san-francisco': ['cat:Mission Dolores Park', 'q:San Francisco skyline people|San Francisco'],
  'region:east-bay': ['cat:Downtown Oakland', 'q:Lake Merritt people|Lake Merritt'],
  'region:peninsula': ['cat:Half Moon Bay, California', 'cat:Pacifica, California', 'cat:Stanford University'],
  'region:south-bay': ['cat:San Pedro Square', 'cat:Santana Row', 'q:San Jose downtown|San Jose'],
  'region:north-bay': ['cat:Napa Valley', 'cat:Point Reyes National Seashore', 'cat:Mill Valley, California'],
  'vibe:nightlife': ['cat:Nightclubs in San Francisco', 'q:San Francisco night lights|San Francisco'],
  'vibe:free': ['q:Dolores Park sunny|Dolores'],
  'vibe:date-night': ['q:San Francisco sunset couple|San Francisco', 'cat:Bay Lights'],
  'vibe:rainy-day': ['cat:Exploratorium', 'q:San Francisco rain|San Francisco'],
};
const CITY_TARGETS = { oakland: ['Downtown Oakland', 'Oakland, California'], berkeley: ['Downtown Berkeley', 'Telegraph Avenue'], 'san-jose': ['Downtown San Jose'],
  'palo-alto': ['University Avenue (Palo Alto)', 'Palo Alto, California'], 'san-mateo': ['Downtown San Mateo', 'San Mateo, California'], 'walnut-creek': ['Walnut Creek, California'],
  napa: ['Napa, California'], sausalito: ['Sausalito, California'], 'half-moon-bay': ['Half Moon Bay, California'], 'santa-rosa': ['Santa Rosa, California'],
  'mountain-view': ['Castro Street (Mountain View)'], alameda: ['Alameda, California'], petaluma: ['Petaluma, California'], sonoma: ['Sonoma, California'],
  'mill-valley': ['Mill Valley, California'], 'redwood-city': ['Redwood City, California'] };

const targets = [];
for (const [k, specs] of Object.entries(CATEGORY_SRC)) targets.push([`genre:${k}`, [...specs.filter((s) => s.startsWith('cat:')), ...(EXTRA[`genre:${k}`] || [])], 20]);
for (const [k, specs] of Object.entries(REGION_SRC)) targets.push([`region:${k}`, [...specs, ...(EXTRA[`region:${k}`] || [])], 10]);
for (const [k, specs] of Object.entries(VIBE_SRC)) targets.push([`vibe:${k}`, [...specs.filter((s) => s.startsWith('cat:')), ...(EXTRA[`vibe:${k}`] || [])], 10]);
for (const [k, cats] of Object.entries(PLACE_CATS)) targets.push([`place:${k}`, cats.map((c) => `cat:${c}`), 10]);
for (const [k, cats] of Object.entries(HOOD_CATS)) targets.push([`hood:${k}`, cats.map((c) => `cat:${c}`), 10]);
for (const [k, cats] of Object.entries(CITY_TARGETS)) targets.push([`city:${k}`, cats.map((c) => `cat:${c}`), 10]);

const result = {};
for (const [key, specs, n] of targets) {
  if (only && !only.test(key)) continue;
  let pool = [];
  for (const spec of specs) {
    if (spec.startsWith('cat:')) pool = pool.concat(await fromCategory(spec.slice(4), { width: 330 }));
    else if (spec.startsWith('q:')) { const [q, must] = spec.slice(2).split('|'); pool = pool.concat(await fromSearch(q, (must || '').split(',').filter(Boolean), { width: 330 })); }
  }
  const seen = new Set();
  pool = pool.filter((p) => !seen.has(p.pageid) && seen.add(p.pageid)).sort((a, b) => b.score - a.score).slice(0, n);
  result[key] = pool.map((p, i) => ({ n: i, pageid: p.pageid, title: p.title, thumb: p.url }));
  console.log(`${key}: ${pool.length}`);
}
fs.writeFileSync(`${out}/candidates.json`, JSON.stringify(result, null, 1));

const esc = (s) => String(s).replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'));
const rows = Object.entries(result);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
for (let s = 0; s * 8 < rows.length; s++) {
  const chunk = rows.slice(s * 8, s * 8 + 8);
  const html = `<html><body style="margin:0;background:#111;color:#eee;font:13px system-ui">${chunk.map(([key, list]) => `
    <div style="padding:4px 6px 2px;font-weight:700;color:#ffd166">${esc(key)}</div>
    <div style="display:grid;grid-template-columns:repeat(10,1fr);gap:3px;padding:0 4px 6px">${Array.from({ length: 10 }, (_, i) => list[i]).map((c, i) => c
      ? `<div style="position:relative"><img src="${c.thumb}" style="width:100%;aspect-ratio:16/10;object-fit:cover;display:block"><span style="position:absolute;left:3px;top:3px;background:#ef4b25;color:#fff;font-weight:800;padding:1px 6px;border-radius:6px">${i}</span></div>`
      : '<div></div>').join('')}</div>`).join('')}</body></html>`;
  fs.writeFileSync(`${out}/_tmp.html`, html);
  await page.goto(`file://${process.cwd()}/${out}/_tmp.html`, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {});
  await page.screenshot({ path: `${out}/cand-${String(s + 1).padStart(2, '0')}.jpg`, fullPage: true, type: 'jpeg', quality: 72 });
}
fs.rmSync(`${out}/_tmp.html`, { force: true });
await browser.close();
console.log(`${rows.length} targets → ${Math.ceil(rows.length / 8)} sheets`);
