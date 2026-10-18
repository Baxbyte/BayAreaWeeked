#!/usr/bin/env node
// Builds data/images.json + public/photos/*.webp: real, free-to-use photos for every place, genre, region,
// city, neighborhood and vibe. Photos are downloaded, cropped and self-hosted so they always load fast.
// Sources:
//   • Wikimedia Commons (no key): curated categories for each real Bay Area place/event (CC BY / BY-SA / CC0 / PD).
//   • Pexels (PEXELS_API_KEY): people doing things — concerts, comedy, yoga… (Pexels license).
// Checks: JPEG, ≥1200px wide, landscape, allowed license, location inside the Bay Area when the photo has GPS,
// no maps/logos/old postcards, content blocklist; people-rich, recent photos are preferred.
//   node scripts/images/build-images.mjs            # fill in anything missing
//   node scripts/images/build-images.mjs --refresh  # re-pick everything
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { CITIES, NEIGHBORHOODS } from '../../src/lib/geo.mjs';
import { CATEGORY_SRC, HOOD_CATS, PLACE_CATS, REGION_SRC, VIBE_SRC } from './plans.mjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const OUT = path.join(ROOT, 'data/images.json');
const PHOTO_DIR = path.join(ROOT, 'public/photos');
const UA = 'BayAreaWeekendBot/1.0 (https://github.com/Baxbyte/BayAreaWeeked; photo credits at /photo-credits/)';
const PEXELS = process.env.PEXELS_API_KEY || process.env.PEXELS_KEY || '';
const refresh = process.argv.includes('--refresh');
const PER_CATEGORY = Number(process.env.IMAGES_PER_CATEGORY || 8);
let budget = Number(process.env.IMAGES_MAX_NEW || Infinity); // cap new downloads (daily job stays quick)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(PHOTO_DIR, { recursive: true });

const BLOCK = /\b(nude|naked|nudity|topless|lingerie|bikini|underwear|sexy|erotic|fetish|bdsm|gun|rifle|pistol|weapon|blood|gore|injur|funeral|coffin|grave|cemetery|protest|riot|arrest|police|fire|burn|smoke|crash|accident|homeless|map|logo|diagram|seal|flag of|chart|floor plan|svg|icon|drawing|illustration|engraving|poster|postcard|lithograph|painting|sketch|blueprint|habs|haer|construction|demolition|restoration|aerial|satellite|screenshot|document|letter)\b/i;
const PEOPLE = /\b(crowd|crowds|people|visitors|tourists|festival|parade|fans|audience|families|family|children|kids|market|runners|dancers|dancing|performers|band|concert|shoppers|picnic|friends|spectators|participants|marchers|celebrat)/i;
const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();

async function getJSON(url, headers = {}) {
  for (let i = 0; i < 3; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: ctrl.signal });
      clearTimeout(t);
      if (res.status === 429) { await sleep(6000 * (i + 1)); continue; }
      if (!res.ok) return null;
      return await res.json();
    } catch { await sleep(2000); }
  }
  return null;
}

// ---- Wikimedia Commons ---------------------------------------------------------------------
const IIPROPS = { prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1280', format: 'json', origin: '*' };

function commonsCandidates(pages, { must = [] } = {}) {
  const out = [];
  for (const p of Object.values(pages || {})) {
    const ii = p.imageinfo?.[0];
    if (!ii || ii.mime !== 'image/jpeg' || ii.width < 1200 || ii.width < ii.height * 1.2 || ii.width > ii.height * 2.4) continue;
    const m = ii.extmetadata || {};
    const license = strip(m.LicenseShortName?.value);
    if (!/^(CC BY|CC0|Public domain|PD)/i.test(license) || /NC|ND/.test(license)) continue;
    const title = p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '').replace(/_/g, ' ');
    const desc = strip(m.ImageDescription?.value).slice(0, 300);
    const cats = strip(m.Categories?.value).replace(/\|/g, ' ');
    const text = `${title} ${desc} ${cats}`;
    if (BLOCK.test(`${title} ${desc}`)) continue;
    if (must.length && !must.every((w) => text.toLowerCase().includes(w.toLowerCase()))) continue;
    const lat = Number(strip(m.GPSLatitude?.value));
    const lng = Number(strip(m.GPSLongitude?.value));
    if (lat && lng && !(lat > 36.9 && lat < 38.8 && lng > -123.2 && lng < -121.4)) continue; // photo taken outside the Bay Area
    const year = Number((strip(m.DateTimeOriginal?.value).match(/\b(19|20)\d\d\b/) || [])[0]);
    if (year && year < 2005) continue;
    const score = (PEOPLE.test(text) ? 4 : 0) + (year >= 2015 ? 2 : year >= 2010 ? 1 : 0) + (desc.length > 40 ? 1 : 0) + (ii.width >= 2400 ? 1 : 0);
    out.push({
      score, url: ii.thumburl || ii.url, alt: desc && desc.length < 160 ? desc : title,
      credit: strip(m.Artist?.value).slice(0, 80) || 'Wikimedia Commons contributor', creditUrl: ii.descriptionurl,
      source: 'Wikimedia Commons', license, licenseUrl: strip(m.LicenseUrl?.value) || ii.descriptionurl, id: `wm-${p.pageid}`,
    });
  }
  return out;
}

async function commonsCategory(cat, depth = 1) {
  const q = new URLSearchParams({ action: 'query', generator: 'categorymembers', gcmtitle: `Category:${cat}`, gcmtype: 'file', gcmlimit: '80', ...IIPROPS });
  const data = await getJSON(`https://commons.wikimedia.org/w/api.php?${q}`);
  await sleep(300);
  let out = commonsCandidates(data?.query?.pages);
  if (out.length < 6 && depth > 0) {
    const sq = new URLSearchParams({ action: 'query', list: 'categorymembers', cmtitle: `Category:${cat}`, cmtype: 'subcat', cmlimit: '12', format: 'json' });
    const subs = (await getJSON(`https://commons.wikimedia.org/w/api.php?${sq}`))?.query?.categorymembers || [];
    for (const s of subs.filter((x) => !BLOCK.test(x.title)).slice(0, 5)) out = out.concat(await commonsCategory(s.title.replace(/^Category:/, ''), depth - 1));
  }
  return out;
}

async function commonsSearch(query, must) {
  const q = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: `filetype:bitmap ${query}`, gsrnamespace: '6', gsrlimit: '40', ...IIPROPS });
  const data = await getJSON(`https://commons.wikimedia.org/w/api.php?${q}`);
  await sleep(300);
  return commonsCandidates(data?.query?.pages, { must });
}

// ---- Pexels -----------------------------------------------------------------------------------
async function pexels(query) {
  if (!PEXELS) return [];
  const q = new URLSearchParams({ query, per_page: '24', orientation: 'landscape', size: 'large' });
  const data = await getJSON(`https://api.pexels.com/v1/search?${q}`, { Authorization: PEXELS });
  await sleep(250);
  return (data?.photos || []).filter((p) => p.width >= 1600 && p.width > p.height && !BLOCK.test(p.alt || '')).map((p, i) => ({
    score: 3 - i * 0.05, url: `${p.src.original}?auto=compress&cs=tinysrgb&w=1600`, alt: p.alt || query, credit: p.photographer, creditUrl: p.url,
    source: 'Pexels', license: 'Pexels License', licenseUrl: 'https://www.pexels.com/license/', id: `px-${p.id}`,
  }));
}

// ---- Download + self-host -------------------------------------------------------------------
async function download(c) {
  const large = path.join(PHOTO_DIR, `${c.id}-l.webp`);
  const small = path.join(PHOTO_DIR, `${c.id}-s.webp`);
  if (fs.existsSync(large) && fs.existsSync(small)) return true;
  if (budget <= 0) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    const res = await fetch(c.url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    const img = sharp(buf).rotate();
    const meta = await img.metadata();
    if ((meta.width || 0) < 1000) return false;
    await img.clone().resize(1280, 720, { fit: 'cover', position: 'attention' }).webp({ quality: 76 }).toFile(large);
    await img.clone().resize(640, 400, { fit: 'cover', position: 'attention' }).webp({ quality: 70 }).toFile(small);
    await sleep(200);
    budget--;
    return true;
  } catch {
    return false;
  }
}

const used = new Set();
async function fromSpec(spec) {
  if (spec.startsWith('cat:')) return commonsCategory(spec.slice(4));
  if (spec.startsWith('px:')) return pexels(spec.slice(3));
  if (spec.startsWith('q:')) { const [q, must] = spec.slice(2).split('|'); return commonsSearch(q, (must || q).split(',').map((s) => s.trim())); }
  return [];
}

/** Try each source in order; collect up to n good, downloaded, de-duplicated photos. */
async function pick(specs, n = 1) {
  const got = [];
  for (const spec of specs) {
    const cands = (await fromSpec(spec)).sort((a, b) => b.score - a.score);
    for (const c of cands) {
      if (got.length >= n) break;
      if (used.has(c.id)) continue;
      if (!(await download(c))) continue;
      used.add(c.id);
      const { score, url, ...rest } = c;
      got.push({ ...rest, file: `/photos/${c.id}` });
    }
    if (got.length >= n) break;
  }
  return got;
}

async function main() {
  let db = {};
  try { db = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { /* first run */ }
  const fresh = { places: {}, categories: {}, regions: {}, cities: {}, hoods: {}, vibes: {} };
  // Entries from the old hot-linking format (no `file`) are discarded.
  const keep = (v) => v && v.file;
  db = refresh ? fresh : {
    places: Object.fromEntries(Object.entries(db.places || {}).filter(([, v]) => keep(v))),
    categories: Object.fromEntries(Object.entries(db.categories || {}).map(([k, v]) => [k, (v || []).filter(keep)])),
    regions: Object.fromEntries(Object.entries(db.regions || {}).filter(([, v]) => keep(v))),
    cities: Object.fromEntries(Object.entries(db.cities || {}).filter(([, v]) => keep(v))),
    hoods: Object.fromEntries(Object.entries(db.hoods || {}).filter(([, v]) => keep(v))),
    vibes: Object.fromEntries(Object.entries(db.vibes || {}).filter(([, v]) => keep(v))),
  };
  for (const g of ['places', 'regions', 'cities', 'hoods', 'vibes']) for (const v of Object.values(db[g])) used.add(v.id);
  for (const list of Object.values(db.categories)) for (const v of list) used.add(v.id);
  const log = (k, n) => console.log(`${n ? '✔' : '·'} ${k}${n > 1 ? ` (${n})` : ''}`);
  const save = () => { db.generatedAt = new Date().toISOString(); fs.writeFileSync(OUT, JSON.stringify(db, null, 1)); };

  // Most visible first: genres, regions, vibes, then places, neighborhoods, cities.
  for (const [slug, specs] of Object.entries(CATEGORY_SRC)) {
    const have = db.categories[slug] || [];
    if (have.length >= PER_CATEGORY) continue;
    db.categories[slug] = [...have, ...(await pick(specs, PER_CATEGORY - have.length))];
    log(`genre ${slug}`, db.categories[slug].length);
  }
  for (const [slug, specs] of Object.entries(REGION_SRC)) { if (!db.regions[slug]) { [db.regions[slug]] = await pick(specs); log(`region ${slug}`, db.regions[slug] ? 1 : 0); } }
  for (const [slug, specs] of Object.entries(VIBE_SRC)) { if (!db.vibes[slug]) { [db.vibes[slug]] = await pick(specs); log(`vibe ${slug}`, db.vibes[slug] ? 1 : 0); } }
  save();
  const evergreen = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/evergreen.json'), 'utf8'));
  for (const e of evergreen) {
    if (db.places[e.title]) continue;
    const cats = PLACE_CATS[e.title] || [];
    const specs = [...cats.map((c) => `cat:${c}`), ...(e.pexelsQuery ? [`px:${e.pexelsQuery}`] : [])];
    [db.places[e.title]] = await pick(specs);
    log(`place ${e.title}`, db.places[e.title] ? 1 : 0);
  }
  save();
  for (const h of NEIGHBORHOODS) {
    if (db.hoods[h.slug]) continue;
    [db.hoods[h.slug]] = await pick((HOOD_CATS[h.slug] || []).map((c) => `cat:${c}`));
    log(`hood ${h.slug}`, db.hoods[h.slug] ? 1 : 0);
  }
  for (const c of CITIES) {
    if (db.cities[c.slug]) continue;
    const name = c.slug === 'san-francisco' ? 'San Francisco' : `${c.name}, California`;
    [db.cities[c.slug]] = await pick([`cat:Downtown ${c.name}`, `cat:${name}`, `q:${c.name} California downtown|${c.name},California`]);
    log(`city ${c.slug}`, db.cities[c.slug] ? 1 : 0);
  }
  for (const g of ['places', 'regions', 'cities', 'hoods', 'vibes']) for (const k of Object.keys(db[g])) if (!db[g][k]) delete db[g][k];
  save();

  // Remove photo files nothing references anymore.
  const live = new Set([...Object.values(db.categories).flat(), ...['places', 'regions', 'cities', 'hoods', 'vibes'].flatMap((g) => Object.values(db[g]))].map((p) => p.id));
  for (const f of fs.readdirSync(PHOTO_DIR)) if (!live.has(f.replace(/-[ls]\.webp$/, ''))) fs.unlinkSync(path.join(PHOTO_DIR, f));
  console.log(`\n${live.size} photos (Pexels ${PEXELS ? 'on' : 'off — add the PEXELS_API_KEY secret for genre photos of people'})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
