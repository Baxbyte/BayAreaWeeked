#!/usr/bin/env node
// Photo audit of the live site: renders every photo next to the listing/topic it illustrates, scores organizer
// images for "looks like a logo/graphic", and writes review sheets + audit.json to <outDir>.
//   LIVE_URL=https://bayareaweeked.vercel.app node scripts/audit/photo-audit.mjs audit
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';

const LIVE = (process.env.LIVE_URL || 'https://bayareaweeked.vercel.app').replace(/\/$/, '');
const OUT = path.resolve(process.argv[2] || 'audit');
const UA = 'Mozilla/5.0 (compatible; BayAreaWeekendAudit/1.0)';
fs.mkdirSync(`${OUT}/img`, { recursive: true });

const idx = await (await fetch(`${LIVE}/data/search.json`)).json();
const items = idx.items || idx;
const images = JSON.parse(fs.readFileSync('data/images.json', 'utf8'));
const isLocal = (u) => !u || u.startsWith('/'); // our own photos are site-relative; organizer images are absolute URLs

async function grab(url, file) {
  try {
    const res = await fetch(url.startsWith('http') ? url : `${LIVE}${url}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    await sharp(buf).rotate().resize(320, 200, { fit: 'cover' }).flatten({ background: '#fff' }).jpeg({ quality: 70 }).toFile(file);
    return { buf, meta };
  } catch (e) {
    return { error: e.name };
  }
}

/** Higher = more likely a logo / text graphic / placeholder rather than a photo. */
async function logoScore(buf, meta, url) {
  const { data, info } = await sharp(buf).resize(48, 48, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const counts = new Map();
  let transparent = 0;
  for (let p = 0; p < data.length; p += 4) {
    if (data[p + 3] < 200) { transparent++; continue; }
    const k = ((data[p] >> 4) << 8) | ((data[p + 1] >> 4) << 4) | (data[p + 2] >> 4);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const px = info.width * info.height;
  const top = Math.max(0, ...counts.values()) / px;
  const unique = counts.size;
  const w = meta.width || 0;
  const h = meta.height || 0;
  const reasons = [];
  let s = 0;
  if (transparent / px > 0.05) { s += 3; reasons.push('transparent'); }
  if (top > 0.45) { s += 2; reasons.push(`flat ${Math.round(top * 100)}%`); }
  else if (top > 0.3) { s += 1; reasons.push(`flat ${Math.round(top * 100)}%`); }
  if (unique < 60) { s += 2; reasons.push(`${unique} colors`); }
  else if (unique < 140) { s += 1; reasons.push(`${unique} colors`); }
  if (w && w < 300) { s += 1; reasons.push(`${w}px`); }
  if (w && h && Math.abs(w / h - 1) < 0.08) { s += 1; reasons.push('square'); }
  if (/logo|icon|avatar|placeholder|default/i.test(url)) { s += 3; reasons.push('logo in URL'); }
  return { score: s, reasons, w, h, unique, flat: +top.toFixed(2), transparent: +(transparent / px).toFixed(2) };
}

// 1) Organizer images (shown when they passed the G/PG check).
const orgUrls = [...new Set(items.filter((i) => i.img && !isLocal(i.img)).map((i) => i.img))].slice(0, 900);
const org = [];
for (const [n, url] of orgUrls.entries()) {
  const file = `${OUT}/img/o${n}.jpg`;
  const r = await grab(url, file);
  const users = items.filter((i) => i.img === url);
  const rec = { url, host: new URL(url).host, titles: users.slice(0, 3).map((i) => i.t), cats: users[0]?.cat || [], n: users.length };
  if (r.error) org.push({ ...rec, error: r.error });
  else org.push({ ...rec, file, ...(await logoScore(r.buf, r.meta, url)) });
}

// 2) Hand-picked pool photos and what they stand for.
const pool = [];
for (const [k, list] of Object.entries(images.categories || {})) list.forEach((p, i) => pool.push({ label: `genre:${k} #${i}`, p }));
for (const g of ['places', 'regions', 'cities', 'hoods', 'vibes']) for (const [k, p] of Object.entries(images[g] || {})) if (p) pool.push({ label: `${g.replace(/s$/, '')}:${k}`, p });
for (const [n, x] of pool.entries()) {
  x.file = `${OUT}/img/p${n}.jpg`;
  const r = await grab(`${x.p.file}-s.webp`, x.file);
  if (r.error) x.error = r.error;
}

// 3) A sample of listings that show a pool (generic) photo: does the photo fit the event?
const usesPool = items.filter((i) => isLocal(i.img));
const sample = usesPool.filter((_, i) => i % Math.max(1, Math.floor(usesPool.length / 144)) === 0).slice(0, 144);
for (const [n, it] of sample.entries()) {
  it.file = `${OUT}/img/s${n}.jpg`;
  const r = await grab(it.img, it.file);
  if (r.error) it.error = r.error;
}

fs.writeFileSync(`${OUT}/audit.json`, JSON.stringify({ live: LIVE, at: new Date().toISOString(), items: items.length, organizer: org, pool: pool.map(({ label, p, error }) => ({ label, id: p.id, alt: p.alt, error })), sample: sample.map((i) => ({ t: i.t, cat: i.cat, img: i.img })) }, null, 1));

// Sheets
const esc = (s) => String(s ?? '').replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
async function sheets(name, tiles, per = 48) {
  for (let s = 0; s * per < tiles.length; s++) {
    const chunk = tiles.slice(s * per, s * per + per);
    const html = `<html><body style="margin:0;background:#111;color:#eee;font:12px system-ui"><div style="display:grid;grid-template-columns:repeat(8,1fr);gap:4px;padding:4px">${chunk.map((t) => `
      <div style="background:#1d1d1d;border-radius:6px;overflow:hidden">${t.file && fs.existsSync(t.file) ? `<img src="file://${t.file}" style="width:100%;aspect-ratio:16/10;object-fit:cover;display:block">` : '<div style="aspect-ratio:16/10;display:grid;place-items:center;color:#f66">missing</div>'}
      <div style="padding:3px 5px;line-height:1.25"><b style="color:#ffd166">${esc(t.tag)}</b> ${esc(t.text)}</div></div>`).join('')}</div></body></html>`;
    fs.writeFileSync(`${OUT}/_tmp.html`, html);
    await page.goto(`file://${OUT}/_tmp.html`, { waitUntil: 'load' });
    await page.screenshot({ path: `${OUT}/${name}-${String(s + 1).padStart(2, '0')}.jpg`, fullPage: true, type: 'jpeg', quality: 70 });
  }
}
const okOrg = org.filter((o) => !o.error).sort((a, b) => b.score - a.score);
await sheets('organizer', okOrg.map((o, i) => ({ file: o.file, tag: `#${i} s${o.score}`, text: `${o.titles[0]?.slice(0, 46)} · ${o.cats[0] || ''} · ${o.host}` })));
await sheets('pool', pool.map((x, i) => ({ file: x.file, tag: `#${i}`, text: `${x.label} · ${(x.p.alt || '').slice(0, 40)}` })));
await sheets('cards', sample.map((x, i) => ({ file: x.file, tag: `#${i} ${x.cat?.[0] || ''}`, text: x.t.slice(0, 60) })));
fs.writeFileSync(`${OUT}/organizer-index.json`, JSON.stringify(okOrg.map((o, i) => ({ i, score: o.score, reasons: o.reasons, url: o.url, title: o.titles[0], host: o.host })), null, 1));
fs.rmSync(`${OUT}/_tmp.html`, { force: true });
fs.rmSync(`${OUT}/img`, { recursive: true, force: true });
await browser.close();
console.log(`audit: ${items.length} listings · ${org.length} organizer images (${org.filter((o) => o.error).length} failed to load, ${okOrg.filter((o) => o.score >= 4).length} logo-like) · ${pool.length} pool photos · ${sample.length} sampled cards`);
