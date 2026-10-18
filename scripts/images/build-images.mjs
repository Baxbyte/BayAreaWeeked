#!/usr/bin/env node
// Builds data/images.json + public/photos/*.webp from HAND-PICKED photos only (data/photo-picks.json).
// Picks are chosen from the numbered candidate sheets (scripts/images/candidates.mjs → photo-candidates branch).
// Optional: with PEXELS_API_KEY, genres without enough picks are topped up from Pexels people photos.
// Every run rebuilds the list from the picks file and deletes any photo file not in it.
//   node scripts/images/build-images.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NSFW, UA, byPageIds, getJSON, sleep } from './commons.mjs';
import { CATEGORY_SRC } from './plans.mjs';
import { checkImage } from '../safety/image-safety.mjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const OUT = path.join(ROOT, 'data/images.json');
const PICKS = path.join(ROOT, 'data/photo-picks.json');
const PHOTO_DIR = path.join(ROOT, 'public/photos');
const BLOCKED = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/photo-blocklist.json'), 'utf8')).ids);
const PEXELS = process.env.PEXELS_API_KEY || process.env.PEXELS_KEY || '';
const PER_GENRE = 6;
fs.mkdirSync(PHOTO_DIR, { recursive: true });

async function download(id, url) {
  const large = path.join(PHOTO_DIR, `${id}-l.webp`);
  const small = path.join(PHOTO_DIR, `${id}-s.webp`);
  if (fs.existsSync(large) && fs.existsSync(small)) {
    // Existing files are re-checked every run (the safety rules can get stricter over time).
    for (const f of [large, small]) {
      const v = await checkImage(f);
      if (!v.safe) { console.log(`✘ removed ${id} (${v.reason})`); fs.rmSync(large, { force: true }); fs.rmSync(small, { force: true }); return false; }
    }
    return true;
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    // Family-friendly gate: even hand-picked photos must pass the image-safety check.
    const verdict = await checkImage(buf);
    if (!verdict.safe) { console.log(`✘ rejected ${id} (${verdict.reason})`); return false; }
    const img = sharp(buf).rotate();
    if (((await img.metadata()).width || 0) < 1000) return false;
    await img.clone().resize(1280, 720, { fit: 'cover', position: 'attention' }).webp({ quality: 78 }).toFile(large);
    await img.clone().resize(640, 400, { fit: 'cover', position: 'attention' }).webp({ quality: 72 }).toFile(small);
    // Re-check the exact crops the site will show (cropping can change what's in frame).
    for (const f of [large, small]) {
      const v = await checkImage(f);
      if (!v.safe) { console.log(`✘ rejected ${id} after crop (${v.reason})`); fs.rmSync(large, { force: true }); fs.rmSync(small, { force: true }); return false; }
    }
    await sleep(200);
    return true;
  } catch {
    return false;
  }
}

async function pexels(query, n, used) {
  const q = new URLSearchParams({ query, per_page: '20', orientation: 'landscape', size: 'large' });
  const data = await getJSON(`https://api.pexels.com/v1/search?${q}`, { Authorization: PEXELS });
  const out = [];
  for (const p of data?.photos || []) {
    if (out.length >= n) break;
    if (p.width < 1600 || p.width <= p.height || NSFW.test(p.alt || '') || used.has(`px-${p.id}`)) continue;
    const rec = { id: `px-${p.id}`, alt: p.alt || query, credit: p.photographer, creditUrl: p.url, source: 'Pexels', license: 'Pexels License', licenseUrl: 'https://www.pexels.com/license/' };
    if (await download(rec.id, `${p.src.original}?auto=compress&cs=tinysrgb&w=1600`)) { used.add(rec.id); out.push({ ...rec, file: `/photos/${rec.id}` }); }
  }
  return out;
}

async function main() {
  const picks = JSON.parse(fs.readFileSync(PICKS, 'utf8'));
  const ids = [...new Set(Object.entries(picks).filter(([k]) => !k.startsWith('_')).flatMap(([, v]) => v))].filter((id) => !BLOCKED.has(id));
  const meta = new Map((await byPageIds(ids)).map((p) => [p.pageid, p]));
  // If Wikimedia can't be reached, stop before touching anything (otherwise every photo would look "missing" and be deleted).
  if (meta.size < ids.length * 0.5) {
    console.error(`Only ${meta.size}/${ids.length} picked photos could be looked up — Wikimedia unreachable? Leaving photos unchanged.`);
    process.exit(1);
  }
  const db = { places: {}, categories: {}, regions: {}, cities: {}, hoods: {}, vibes: {} };
  const group = { genre: 'categories', place: 'places', region: 'regions', city: 'cities', hood: 'hoods', vibe: 'vibes' };
  const used = new Set();
  let missing = 0;
  for (const [key, list] of Object.entries(picks)) {
    if (key.startsWith('_')) continue;
    const [kind, ...rest] = key.split(':');
    const name = rest.join(':');
    const recs = [];
    for (const pid of list) {
      if (BLOCKED.has(pid)) continue;
      const m = meta.get(pid);
      if (!m) { missing++; console.log(`· ${key}: page ${pid} unavailable`); continue; }
      if (!(await download(m.id, m.url))) { missing++; continue; }
      const { pageid, url, width, score, title, ...rec } = m;
      used.add(m.id);
      recs.push({ ...rec, file: `/photos/${m.id}` });
    }
    if (!recs.length) continue;
    if (kind === 'genre') db.categories[name] = recs;
    else db[group[kind]][name] = recs[0];
  }
  if (PEXELS) {
    for (const [slug, specs] of Object.entries(CATEGORY_SRC)) {
      const have = db.categories[slug] || [];
      if (have.length >= PER_GENRE) continue;
      for (const spec of specs.filter((s) => s.startsWith('px:'))) {
        have.push(...(await pexels(spec.slice(3), PER_GENRE - have.length, used)));
        if (have.length >= PER_GENRE) break;
      }
      if (have.length) db.categories[slug] = have;
    }
  }
  db.generatedAt = new Date().toISOString();
  fs.writeFileSync(OUT, JSON.stringify(db, null, 1));
  for (const f of fs.readdirSync(PHOTO_DIR)) if (!used.has(f.replace(/-[ls]\.webp$/, ''))) fs.unlinkSync(path.join(PHOTO_DIR, f));
  console.log(`${used.size} hand-picked photos${missing ? `, ${missing} unavailable` : ''} (Pexels ${PEXELS ? 'on' : 'off'})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
