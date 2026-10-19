// Checks organizers' event images (and sponsor images) with the image-safety gate.
// Results are cached by URL in data/image-safety.json. Items get `imageSafe: true` only when verified safe;
// anything unchecked, flagged or unverifiable is hidden (the site falls back to a hand-picked photo).
import crypto from 'node:crypto';
import fs from 'node:fs';
import { checkRemoteImage } from './image-safety.mjs';
import { reviewImages } from './review-images.mjs';
import { USER_AGENT } from '../scrape/http.mjs';

const FILE = new URL('../../data/image-safety.json', import.meta.url);
const key = (url) => crypto.createHash('sha1').update(url).digest('hex').slice(0, 16);

export function loadSafety() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; }
}

export async function moderateImages(items, { offline = false, max = Number(process.env.IMAGE_CHECK_MAX || 800) } = {}) {
  const db = loadSafety();
  const sponsors = (() => { try { return JSON.parse(fs.readFileSync(new URL('../../data/sponsors.json', import.meta.url), 'utf8')).campaigns || []; } catch { return []; } })();
  const urls = [...new Set([...items.map((i) => i.image), ...sponsors.map((c) => c.event?.image)].filter(Boolean))];
  let checked = 0, flagged = 0;
  for (const url of urls) {
    const k = key(url);
    if (db[k] || offline || checked >= max) continue;
    const r = await checkRemoteImage(url, { userAgent: USER_AGENT });
    db[k] = { safe: r.safe, reason: r.reason || null, at: new Date().toISOString().slice(0, 10) };
    checked++;
    if (!r.safe) flagged++;
  }
  for (const it of items) it.imageSafe = !!(it.image && db[key(it.image)]?.safe);
  await reviewImages(items, key);
  // Keep the cache small: forget entries older than 60 days.
  const cutoff = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  for (const [k, v] of Object.entries(db)) if (v.at < cutoff) delete db[k];
  fs.writeFileSync(FILE, JSON.stringify(db));
  console.log(`image safety: ${checked} newly checked, ${flagged} rejected, ${items.filter((i) => i.imageSafe).length}/${items.filter((i) => i.image).length} event images approved`);
}

export const imageKey = key;
