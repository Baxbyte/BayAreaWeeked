// Real photos for every listing and page (see scripts/images/build-images.mjs for where they come from).
import fs from 'node:fs';
import path from 'node:path';

import { link } from './site.mjs';

let DB = { places: {}, categories: {}, regions: {}, cities: {}, hoods: {}, vibes: {} };
try { DB = { ...DB, ...JSON.parse(fs.readFileSync(path.resolve(process.cwd(), process.env.IMAGES_FILE || 'data/images.json'), 'utf8')) }; } catch { /* no photos yet */ }

// Self-hosted photos: { file: '/photos/wm-123' } → /photos/wm-123-l.webp (1280×720) and -s.webp (640×400).
const withUrls = (p) => (p && p.file ? { ...p, src: link(`${p.file}-l.webp`), srcSmall: link(`${p.file}-s.webp`) } : p?.src ? p : null);
for (const g of ['places', 'regions', 'cities', 'hoods', 'vibes']) for (const k of Object.keys(DB[g])) DB[g][k] = withUrls(DB[g][k]);
for (const k of Object.keys(DB.categories)) DB.categories[k] = (DB.categories[k] || []).map(withUrls).filter(Boolean);
export const IMAGES = DB;

function h(s) {
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(x);
}

// Catch-all genres: one generic photo would repeat on every unrelated listing, so a photo of the place comes first.
const BROAD = new Set(['community', 'learning']);
const pick = (list, i) => list[h(i.id || i.title) % list.length];

/** A real photo that fits the item: specific genre → vibe → neighborhood/city/region → broad genre. */
export function poolPhoto(i) {
  for (const c of i.categories || []) {
    const list = DB.categories[c];
    if (list?.length && !BROAD.has(c)) return pick(list, i);
  }
  if (i.flags?.kids && DB.vibes['kid-friendly']) return DB.vibes['kid-friendly'];
  if (i.flags?.nightlife && DB.vibes.nightlife) return DB.vibes.nightlife;
  const place = DB.hoods[i.neighborhood] || DB.cities[i.city] || DB.regions[i.region];
  if (place) return place;
  for (const c of i.categories || []) if (DB.categories[c]?.length) return pick(DB.categories[c], i);
  return null;
}

// Venue → place photo ("The Fillmore", "Castro Theatre"…), so events show the real venue instead of a generic photo.
const norm = (s) => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
const PLACE_BY_NAME = new Map(Object.entries(DB.places).map(([k, p]) => [norm(k), p]));
export function venuePhoto(i) {
  const v = norm(i.venue?.name);
  if (v.length < 5) return null;
  if (PLACE_BY_NAME.has(v)) return PLACE_BY_NAME.get(v);
  for (const [k, p] of PLACE_BY_NAME) if (k.length >= 8 && v.startsWith(`${k} `)) return p; // "Yerba Buena Gardens, Children’s Garden"
  return null;
}

/**
 * Best photo for a listing: the organizer's own image, else a real photo of the place or venue, else a matching
 * real photo for its genre. Returns { src, srcSmall, alt, credit, creditUrl, source, license, licenseUrl, fallback }.
 */
export function photoFor(i) {
  const venue = i.type === 'event' ? venuePhoto(i) : null;
  const pool = venue || poolPhoto(i);
  // Organizers' images are shown only after passing the family-friendly image check (see scripts/safety/).
  if (i.image && i.imageSafe === true) {
    return { src: i.image, srcSmall: i.image, alt: i.title, credit: i.sources?.[0]?.name || 'Event organizer', creditUrl: i.url, source: 'organizer', fallback: pool };
  }
  const place = i.type === 'activity' ? DB.places[i.title] : null;
  const p = place || pool;
  return p ? { ...p, fallback: place ? pool : null } : null;
}

export const regionPhoto = (slug) => DB.regions[slug] || null;
export const cityPhoto = (slug) => DB.cities[slug] || null;
export const hoodPhoto = (slug) => DB.hoods[slug] || null;
export const vibePhoto = (slug) => DB.vibes[slug] || null;
export const categoryPhoto = (slug) => DB.categories[slug]?.[0] || null;

export function allCredits() {
  const out = [];
  const add = (label, p) => { if (p && !out.some((x) => x.id === p.id)) out.push({ label, ...p }); };
  for (const [k, list] of Object.entries(DB.categories)) list.forEach((p) => add(k, p));
  for (const g of ['regions', 'cities', 'hoods', 'vibes', 'places']) for (const [k, p] of Object.entries(DB[g])) add(k, p);
  return out;
}

/** Banner photo for a hub page, most specific first. */
export function pagePhoto(f = {}) {
  return (f.hood && DB.hoods[f.hood]) || (f.vibe && DB.vibes[f.vibe]) || (f.category && DB.categories[f.category]?.[0])
    || (f.city && DB.cities[f.city]) || (f.region && DB.regions[f.region]) || DB.categories.festivals?.[0] || DB.regions['san-francisco'] || null;
}
