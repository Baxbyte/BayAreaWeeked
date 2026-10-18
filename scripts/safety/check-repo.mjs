#!/usr/bin/env node
// Repo-wide family-friendly check (runs in CI before every deploy). Fails if:
//   • any photo file isn't listed in data/images.json,
//   • any listed Wikimedia photo wasn't hand-picked in data/photo-picks.json,
//   • any photo or site image is flagged by the image-safety gate.
import fs from 'node:fs';
import path from 'node:path';
import { checkImage } from './image-safety.mjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const problems = [];
const images = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/images.json'), 'utf8'));
const picks = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/photo-picks.json'), 'utf8'));
const picked = new Set(Object.entries(picks).filter(([k]) => !k.startsWith('_')).flatMap(([, v]) => v).map((n) => `wm-${n}`));
const listed = [...Object.values(images.categories || {}).flat(), ...['places', 'regions', 'cities', 'hoods', 'vibes'].flatMap((g) => Object.values(images[g] || {}))].filter(Boolean);
const listedIds = new Set(listed.map((p) => p.id));

for (const p of listed) if (p.id.startsWith('wm-') && !picked.has(p.id)) problems.push(`${p.id} is listed but was not hand-picked`);
const dir = path.join(ROOT, 'public/photos');
const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
for (const f of files) if (!listedIds.has(f.replace(/-[ls]\.webp$/, ''))) problems.push(`public/photos/${f} is not listed in data/images.json`);

const toScan = [...files.filter((f) => f.endsWith('-l.webp')).map((f) => path.join(dir, f)),
  ...fs.readdirSync(path.join(ROOT, 'public')).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).map((f) => path.join(ROOT, 'public', f))];
let n = 0;
for (const f of toScan) {
  const r = await checkImage(f);
  n++;
  if (!r.safe) problems.push(`${path.relative(ROOT, f)} flagged: ${r.reason}`);
}
console.log(`family-friendly check: scanned ${n} images`);
if (problems.length) {
  console.error(`✘ ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('✔ all images are hand-picked and pass the G/PG safety check');
