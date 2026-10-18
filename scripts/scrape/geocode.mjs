// Optional venue geocoding via OpenStreetMap Nominatim (1 req/sec, cached). Enable with GEOCODE=1.
import fs from 'node:fs';
import { USER_AGENT } from './http.mjs';

const CACHE_FILE = new URL('../../data/geocache.json', import.meta.url);
let cache = null;

function load() {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { cache = {}; }
  return cache;
}

export function saveGeocache() {
  if (cache) fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 0));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let used = 0;

export async function geocode(query) {
  const c = load();
  const key = query.toLowerCase().replace(/\s+/g, ' ').trim();
  if (key in c) return c[key];
  if (process.env.GEOCODE !== '1' || used >= Number(process.env.GEOCODE_MAX || 150)) return null;
  used++;
  await sleep(1100);
  const q = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1', countrycodes: 'us', viewbox: '-123.2,38.75,-121.4,36.9', bounded: '1' });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, { headers: { 'User-Agent': USER_AGENT } });
    const data = res.ok ? await res.json() : [];
    c[key] = data[0] ? { lat: +(+data[0].lat).toFixed(5), lng: +(+data[0].lon).toFixed(5) } : null;
  } catch {
    return null;
  }
  return c[key];
}
