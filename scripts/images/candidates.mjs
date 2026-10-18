#!/usr/bin/env node
// Gathers ~10 candidate photos per target and renders numbered contact sheets for hand-picking.
// Picks go into data/photo-picks.json; only picked photos are published.
//   node scripts/images/candidates.mjs <outDir>     (needs `playwright`)
import fs from 'node:fs';
import { chromium } from 'playwright';
import { UA, fromCategory, fromSearch, sleep } from './commons.mjs';
import { checkImage } from '../safety/image-safety.mjs';
import { CATEGORY_SRC, HOOD_CATS, PLACE_CATS, REGION_SRC, VIBE_SRC } from './plans.mjs';

const out = process.argv[2] || 'candidates';
const BLOCKED = new Set(JSON.parse(fs.readFileSync('data/photo-blocklist.json', 'utf8')).ids);
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

// Only gather what still needs photos (genres with < 4 picks, anything without a photo), within a time budget.
let have = { places: {}, categories: {}, regions: {}, cities: {}, hoods: {}, vibes: {} };
try { have = { ...have, ...JSON.parse(fs.readFileSync('data/images.json', 'utf8')) }; } catch { /* none yet */ }
const group = { genre: 'categories', place: 'places', region: 'regions', city: 'cities', hood: 'hoods', vibe: 'vibes' };
const needs = ([key]) => {
  const [kind, ...rest] = key.split(':');
  const v = have[group[kind]]?.[rest.join(':')];
  return kind === 'genre' ? !v || v.length < 4 : !v;
};
const deadline = Date.now() + Number(process.env.CANDIDATE_BUDGET_MIN || 18) * 60000;
const result = {};
for (const [key, specs, n] of targets) {
  if (only && !only.test(key)) continue;
  if (!only && !needs([key])) continue;
  if (Date.now() > deadline) { console.log(`(time budget reached — stopping before ${key})`); break; }
  let pool = [];
  for (const spec of specs) {
    if (spec.startsWith('cat:')) pool = pool.concat(await fromCategory(spec.slice(4), { width: 330, depth: key.startsWith('genre:') || key.startsWith('region:') ? 1 : 0 }));
    else if (spec.startsWith('q:')) { const [q, must] = spec.slice(2).split('|'); pool = pool.concat(await fromSearch(q, (must || '').split(',').filter(Boolean), { width: 330 })); }
  }
  const seen = new Set();
  pool = pool.filter((p) => !BLOCKED.has(p.pageid) && !seen.has(p.pageid) && seen.add(p.pageid)).sort((a, b) => b.score - a.score).slice(0, n);
  result[key] = pool.map((p, i) => ({ n: i, pageid: p.pageid, title: p.title, thumb: p.url }));
  console.log(`${key}: ${pool.length}`);
}
fs.writeFileSync(`${out}/candidates.json`, JSON.stringify(result, null, 1));

// Download thumbnails one at a time (Wikimedia throttles bursts), then render from local files.
fs.mkdirSync(`${out}/thumbs`, { recursive: true });
async function grab(c) {
  const file = `${out}/thumbs/${c.pageid}.jpg`;
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(c.thumb, { headers: { 'User-Agent': UA } });
      if (res.status === 429) { await sleep(4000 * (i + 1)); continue; }
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      // Family-friendly gate: flagged photos are never written, rendered or offered for picking.
      if (!(await checkImage(buf)).safe) { c.blocked = true; return null; }
      fs.writeFileSync(file, buf);
      await sleep(150);
      return `file://${process.cwd()}/${file}`;
    } catch { await sleep(2000); }
  }
  return null;
}
for (const list of Object.values(result)) for (const c of list) c.local = await grab(c);
for (const k of Object.keys(result)) result[k] = result[k].filter((c) => !c.blocked);
fs.writeFileSync(`${out}/candidates.json`, JSON.stringify(result, null, 1));

const esc = (s) => String(s).replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'));
const rows = Object.entries(result);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
const per = 6;
for (let s = 0; s * per < rows.length; s++) {
  const chunk = rows.slice(s * per, s * per + per);
  const html = `<html><body style="margin:0;background:#111;color:#eee;font:13px system-ui">${chunk.map(([key, list]) => `
    <div style="padding:4px 6px 2px;font-weight:700;color:#ffd166">${esc(key)}</div>
     <div style="display:grid;grid-template-columns:repeat(10,1fr);gap:3px;padding:0 4px 6px">${list.map((c, i) => c.local
      ? `<div style="position:relative"><img src="${c.local}" style="width:100%;aspect-ratio:16/10;object-fit:cover;display:block"><span style="position:absolute;left:3px;top:3px;background:#ef4b25;color:#fff;font-weight:800;padding:1px 6px;border-radius:6px">${i}</span></div>`
      : `<div style="aspect-ratio:16/10;background:#333;color:#888;display:grid;place-items:center">${i} n/a</div>`).join('')}</div>`).join('')}</body></html>`;
  fs.writeFileSync(`${out}/_tmp.html`, html);
  await page.goto(`file://${process.cwd()}/${out}/_tmp.html`, { waitUntil: 'load', timeout: 120000 }).catch(() => {});
  await page.screenshot({ path: `${out}/cand-${String(s + 1).padStart(2, '0')}.jpg`, fullPage: true, type: 'jpeg', quality: 72 });
}
fs.rmSync(`${out}/_tmp.html`, { force: true });
await browser.close();
fs.rmSync(`${out}/thumbs`, { recursive: true, force: true });
console.log(`${rows.length} targets → ${Math.ceil(rows.length / per)} sheets`);
