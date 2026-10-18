#!/usr/bin/env node
// Builds data/images.json: real, free-to-use photos of the Bay Area for every place, genre, region, city and vibe.
// Sources:
//   • Wikimedia Commons (no key) — real photos of actual Bay Area places & events (CC BY / CC BY-SA / CC0 / PD), credited.
//   • Pexels (PEXELS_API_KEY) — high-quality free photos of people doing things (Pexels license; credit shown anyway).
// Quality checks on every candidate: landscape, ≥1200px wide, JPEG, no maps/logos/diagrams, content blocklist,
// and a live reachability check before anything is saved.
//   node scripts/images/build-images.mjs            # fill in anything missing
//   node scripts/images/build-images.mjs --refresh  # re-pick everything
import fs from 'node:fs';
import { REGIONS, CITIES, NEIGHBORHOODS } from '../../src/lib/geo.mjs';
import { CATEGORIES, VIBES } from '../../src/lib/taxonomy.mjs';

const OUT = new URL('../../data/images.json', import.meta.url);
const UA = 'BayAreaWeekendBot/1.0 (https://github.com/Baxbyte/BayAreaWeeked; images)';
const PEXELS = process.env.PEXELS_API_KEY || process.env.PEXELS_KEY || '';
const refresh = process.argv.includes('--refresh');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BLOCK = /\b(nude|naked|lingerie|bikini|underwear|sexy|erotic|gun|rifle|pistol|weapon|blood|gore|funeral|coffin|grave|protest|riot|fire|smoke|map|logo|diagram|seal|flag|chart|plan|svg|icon|drawing|illustration|painting by|engraving|poster)\b/i;

// ---- providers ------------------------------------------------------------------------------
async function getJSON(url, headers = {}) {
  for (let i = 0; i < 3; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: ctrl.signal });
      clearTimeout(t);
      if (res.status === 429) { await sleep(5000 * (i + 1)); continue; }
      if (!res.ok) return null;
      return await res.json();
    } catch { await sleep(1500); }
  }
  return null;
}

const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function commons(query, { people = false } = {}) {
  const q = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrsearch: `filetype:bitmap ${query}`, gsrnamespace: '6', gsrlimit: '25',
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1280', origin: '*',
  });
  const data = await getJSON(`https://commons.wikimedia.org/w/api.php?${q}`);
  await sleep(350);
  const pages = Object.values(data?.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
  const out = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || ii.mime !== 'image/jpeg' || ii.width < 1200 || ii.width < ii.height * 1.25 || ii.width > ii.height * 2.6) continue;
    const m = ii.extmetadata || {};
    const license = strip(m.LicenseShortName?.value);
    if (!/^(CC BY|CC0|Public domain|PD)/i.test(license) || /NC|ND/.test(license)) continue;
    const title = p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '').replace(/_/g, ' ');
    const desc = strip(m.ImageDescription?.value).slice(0, 200);
    if (BLOCK.test(`${title} ${desc}`) || /\b(19\d\d|18\d\d)\b/.test(title)) continue;
    const score = tokens.filter((t) => `${title} ${desc}`.toLowerCase().includes(t)).length + (people && /crowd|people|visitors|festival|parade|fans|market|audience/i.test(`${title} ${desc}`) ? 2 : 0);
    out.push({
      score, src: ii.thumburl, srcSmall: ii.thumburl.replace(/\/1280px-/, '/640px-'), w: ii.thumbwidth, h: ii.thumbheight,
      alt: desc && desc.length < 140 ? desc : title, credit: strip(m.Artist?.value).slice(0, 80) || 'Wikimedia Commons contributor',
      creditUrl: ii.descriptionurl, source: 'Wikimedia Commons', license, licenseUrl: m.LicenseUrl?.value || ii.descriptionurl, id: `wm:${p.pageid}`,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

async function pexels(query) {
  if (!PEXELS) return [];
  const q = new URLSearchParams({ query, per_page: '20', orientation: 'landscape', size: 'large' });
  const data = await getJSON(`https://api.pexels.com/v1/search?${q}`, { Authorization: PEXELS });
  await sleep(250);
  return (data?.photos || []).filter((p) => p.width >= 1600 && p.width > p.height && !BLOCK.test(p.alt || '')).map((p) => ({
    score: 0, src: `${p.src.original}?auto=compress&cs=tinysrgb&w=1280&h=720&fit=crop`, srcSmall: `${p.src.original}?auto=compress&cs=tinysrgb&w=640&h=400&fit=crop`,
    w: 1280, h: 720, alt: p.alt || query, credit: p.photographer, creditUrl: p.url, source: 'Pexels', license: 'Pexels License', licenseUrl: 'https://www.pexels.com/license/', id: `px:${p.id}`,
  }));
}

async function reachable(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, { headers: { 'User-Agent': UA, Range: 'bytes=0-1023' }, signal: ctrl.signal });
    clearTimeout(t);
    return (res.ok || res.status === 206) && (res.headers.get('content-type') || '').startsWith('image/');
  } catch { return false; }
}

const used = new Set();
/** Run query plans in order until we have `n` good photos. plan: [['commons'|'pexels', query, opts]] */
async function pick(plan, n = 1) {
  const got = [];
  for (const [provider, query, opts] of plan) {
    const candidates = provider === 'pexels' ? await pexels(query) : await commons(query, opts);
    for (const c of candidates) {
      if (got.length >= n) break;
      if (used.has(c.id) || got.some((g) => g.id === c.id)) continue;
      if (!(await reachable(c.srcSmall))) continue;
      used.add(c.id);
      const { score, ...img } = c;
      got.push(img);
    }
    if (got.length >= n) break;
  }
  return got;
}

// ---- what we need -------------------------------------------------------------------------
const C = (q, o) => ['commons', q, o];
const X = (q) => ['pexels', q];
const CATEGORY_PLANS = {
  'live-music': [C('Outside Lands festival crowd', { people: true }), C('Hardly Strictly Bluegrass crowd', { people: true }), C('Stern Grove Festival audience', { people: true }), X('concert crowd stage lights'), X('live band small club'), X('outdoor music festival crowd')],
  nightlife: [X('nightclub dance floor crowd'), X('dj party crowd lights'), X('friends cocktail bar night'), C('Mission District San Francisco night street'), X('rooftop bar city night')],
  comedy: [X('stand up comedian microphone stage'), X('audience laughing comedy show'), C('comedy club San Francisco')],
  theater: [C('San Francisco Ballet performance'), C('War Memorial Opera House interior'), X('theater stage performance actors'), X('ballet dancers stage')],
  arts: [C('de Young Museum visitors', { people: true }), C('SFMOMA gallery visitors', { people: true }), C('Balmy Alley murals'), X('art gallery visitors'), X('museum visitors looking at art')],
  film: [C('Castro Theatre San Francisco'), C('Roxie Theater San Francisco'), X('outdoor movie night crowd'), X('cinema audience')],
  'food-drink': [C('Ferry Building Marketplace interior', { people: true }), C('Off the Grid Fort Mason food trucks', { people: true }), C('Oxbow Public Market Napa'), X('friends dinner restaurant laughing'), X('food truck festival people'), X('wine tasting friends vineyard')],
  markets: [C('Ferry Plaza Farmers Market', { people: true }), C('Alemany Farmers Market', { people: true }), C('Grand Lake Farmers Market Oakland'), X('farmers market crowd produce'), X('flea market vintage stalls')],
  festivals: [C('San Francisco Pride parade crowd', { people: true }), C('Chinese New Year Parade San Francisco', { people: true }), C('Bay to Breakers runners', { people: true }), C('Carnaval San Francisco parade', { people: true }), C('Northern California Cherry Blossom Festival Japantown', { people: true }), X('street festival crowd')],
  outdoors: [C('Lands End trail San Francisco hikers', { people: true }), C('Muir Woods visitors redwoods', { people: true }), C('Crissy Field Golden Gate Bridge people', { people: true }), C('Mount Tamalpais hikers'), X('hiking trail california friends'), X('picnic park friends sunny')],
  sports: [C('Oracle Park crowd Giants', { people: true }), C('Chase Center Warriors game', { people: true }), C('Levi\'s Stadium 49ers game', { people: true }), X('baseball stadium crowd'), X('basketball arena crowd')],
  wellness: [C('Dolores Park yoga'), X('outdoor yoga class group'), X('indoor rock climbing gym people'), X('running club group')],
  learning: [C('San Francisco Main Library interior'), X('workshop class people learning'), X('author book reading event audience'), X('lecture audience')],
  tech: [C('Moscone Center conference attendees', { people: true }), X('tech meetup presentation audience'), X('hackathon people laptops')],
  community: [C('Ocean Beach cleanup volunteers', { people: true }), X('volunteers community garden'), X('community event people outdoors')],
  family: [C('Children\'s Fairyland Oakland', { people: true }), C('Exploratorium children exhibit', { people: true }), C('California Academy of Sciences visitors', { people: true }), C('Pier 39 sea lions'), X('family kids park playing'), X('children science museum')],
};
const REGION_PLANS = {
  'san-francisco': [C('San Francisco skyline Golden Gate Bridge'), C('Painted Ladies Alamo Square people', { people: true })],
  'east-bay': [C('Lake Merritt Oakland skyline'), C('Lake Merritt Oakland people', { people: true })],
  peninsula: [C('Half Moon Bay coast'), C('Pacifica pier')],
  'south-bay': [C('Downtown San Jose skyline'), C('San Jose Plaza de Cesar Chavez')],
  'north-bay': [C('Sausalito waterfront'), C('Napa Valley vineyards')],
};
const VIBE_PLANS = {
  'kid-friendly': [C('Children\'s Fairyland Oakland', { people: true }), X('family kids playground park')],
  nightlife: [X('nightclub crowd lights'), C('San Francisco nightlife')],
  free: [C('Dolores Park crowd sunny', { people: true }), X('friends picnic park')],
  'hot-day': [C('Ocean Beach San Francisco people', { people: true }), C('Stinson Beach summer'), X('beach friends summer california')],
  'rainy-day': [C('California Academy of Sciences rainforest dome'), X('rainy city umbrella street')],
  'fog-escape': [C('Golden Gate Bridge fog'), C('Karl the Fog San Francisco')],
  'date-night': [X('couple dinner city lights'), C('San Francisco Bay Bridge lights night')],
  'near-bart': [C('BART train station'), C('BART train')],
};

async function main() {
  let db = {};
  try { db = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { /* first run */ }
  db = { places: {}, categories: {}, regions: {}, cities: {}, hoods: {}, vibes: {}, ...db };
  if (refresh) db = { places: {}, categories: {}, regions: {}, cities: {}, hoods: {}, vibes: {} };
  for (const group of ['places', 'regions', 'cities', 'hoods', 'vibes']) for (const v of Object.values(db[group])) if (v?.id) used.add(v.id);
  for (const list of Object.values(db.categories)) for (const v of list) used.add(v.id);

  const log = (k, n) => console.log(`${n ? '✔' : '✘'} ${k}${n > 1 ? ` (${n})` : ''}`);
  const want = Number(process.env.IMAGES_PER_CATEGORY || 8);

  for (const [slug, plan] of Object.entries(CATEGORY_PLANS)) {
    const have = db.categories[slug] || [];
    if (have.length >= want) continue;
    const add = await pick(plan, want - have.length);
    db.categories[slug] = [...have, ...add];
    log(`category:${slug}`, db.categories[slug].length);
  }
  for (const [slug, plan] of Object.entries(REGION_PLANS)) {
    if (db.regions[slug]) continue;
    [db.regions[slug]] = await pick(plan);
    log(`region:${slug}`, db.regions[slug] ? 1 : 0);
  }
  for (const [slug, plan] of Object.entries(VIBE_PLANS)) {
    if (db.vibes[slug]) continue;
    [db.vibes[slug]] = await pick(plan);
    log(`vibe:${slug}`, db.vibes[slug] ? 1 : 0);
  }
  for (const c of CITIES) {
    if (db.cities[c.slug] !== undefined && !refresh) continue;
    [db.cities[c.slug]] = await pick([C(`${c.name} California downtown`), C(`${c.name} California`)]);
    db.cities[c.slug] ||= null;
    log(`city:${c.slug}`, db.cities[c.slug] ? 1 : 0);
  }
  for (const h of NEIGHBORHOODS) {
    if (db.hoods[h.slug] !== undefined && !refresh) continue;
    const cityName = CITIES.find((c) => c.slug === h.city).name;
    [db.hoods[h.slug]] = await pick([C(`${h.name} ${cityName}`, { people: true }), ...h.aliases.slice(0, 1).map((a) => C(`${a} ${cityName}`))]);
    db.hoods[h.slug] ||= null;
    log(`hood:${h.slug}`, db.hoods[h.slug] ? 1 : 0);
  }
  const evergreen = JSON.parse(fs.readFileSync(new URL('../../data/evergreen.json', import.meta.url), 'utf8'));
  for (const e of evergreen) {
    const key = e.title;
    if (db.places[key] !== undefined && !refresh) continue;
    const city = CITIES.find((c) => c.slug === e.venue.city)?.name || '';
    const plan = [C(e.photoQuery || `${e.title.replace(/&/g, '')} ${city}`, { people: true }), C(e.venue.name)];
    if (e.pexelsQuery) plan.push(X(e.pexelsQuery));
    [db.places[key]] = await pick(plan);
    db.places[key] ||= null;
    log(`place:${key}`, db.places[key] ? 1 : 0);
  }
  db.generatedAt = new Date().toISOString();
  fs.writeFileSync(OUT, JSON.stringify(db, null, 1));
  const count = Object.values(db.categories).flat().length + ['places', 'regions', 'cities', 'hoods', 'vibes'].reduce((s, g) => s + Object.values(db[g]).filter(Boolean).length, 0);
  console.log(`\nimages.json: ${count} photos (Pexels ${PEXELS ? 'on' : 'off — add PEXELS_API_KEY secret for more variety'})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
