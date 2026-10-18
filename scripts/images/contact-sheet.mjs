#!/usr/bin/env node
// Renders every photo in data/images.json into contact-sheet PNGs for human review.
//   node scripts/images/contact-sheet.mjs <outDir>   (needs `playwright` installed)
import fs from 'node:fs';
import { chromium } from 'playwright';

const db = JSON.parse(fs.readFileSync('data/images.json', 'utf8'));
const out = process.argv[2] || 'review';
fs.mkdirSync(out, { recursive: true });
const rows = [];
for (const [slug, list] of Object.entries(db.categories || {})) list.forEach((img, i) => rows.push([`cat ${slug} #${i + 1}`, img]));
for (const g of ['regions', 'vibes', 'cities', 'hoods', 'places']) for (const [k, img] of Object.entries(db[g] || {})) if (img) rows.push([`${g.slice(0, -1)} ${k}`, img]);
const esc = (s) => String(s).replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'));
const pages = [];
for (let i = 0; i < rows.length; i += 48) pages.push(rows.slice(i, i + 48));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
for (const [n, chunk] of pages.entries()) {
  const html = `<html><body style="margin:0;font:12px system-ui;background:#111;color:#eee;display:grid;grid-template-columns:repeat(8,1fr);gap:4px;padding:4px">${chunk.map(([k, img]) =>
    `<div><img src="${img.srcSmall}" style="width:100%;aspect-ratio:16/10;object-fit:cover;display:block"><div style="padding:2px 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b>${esc(k)}</b> · ${esc(img.source)}</div></div>`).join('')}</body></html>`;
  await page.setContent(html, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {});
  await page.screenshot({ path: `${out}/sheet-${String(n + 1).padStart(2, '0')}.jpg`, fullPage: true, type: 'jpeg', quality: 70 });
}
fs.writeFileSync(`${out}/index.json`, JSON.stringify(rows.map(([k, img]) => ({ k, src: img.srcSmall, alt: img.alt, credit: img.credit, source: img.source }))));
await browser.close();
console.log(`${rows.length} photos → ${pages.length} sheets in ${out}/`);
