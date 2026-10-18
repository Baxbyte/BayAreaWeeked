#!/usr/bin/env node
// V2 prep: build a personalized daily email (HTML + text) for one subscriber.
//   node scripts/digest/build-digest.mjs '{"email":"a@b.com","regions":["east-bay"],"interests":["kids","free"]}' > digest.html
// Sending is intentionally left to V2 (e.g. Resend, Postmark or Buttondown) — see docs/V2-EMAIL.md.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { cityBySlug, hoodBySlug } from '../../src/lib/geo.mjs';
import { categoryBySlug } from '../../src/lib/taxonomy.mjs';
import { formatWhen, overlaps, windows } from '../../src/lib/time.mjs';
import { SITE, absolute } from '../../src/lib/site.mjs';

const INTEREST_TEST = {
  kids: (i) => i.flags.kids, nightlife: (i) => i.flags.nightlife, free: (i) => i.flags.free, weather: () => true,
};

export function pickForSubscriber(items, prefs, now = new Date(), max = 8) {
  const w = windows(now);
  const horizon = { start: w.today.start, end: w.weekend.end > w.tomorrow.end ? w.weekend.end : w.nextWeekend.end };
  let pool = items.filter((i) => i.type === 'event' && overlaps(i, horizon));
  if (prefs.regions?.length) pool = pool.filter((i) => prefs.regions.includes(i.region));
  if (prefs.cities?.length) pool = pool.filter((i) => prefs.cities.includes(i.city));
  if (!prefs.interests?.includes('nightlife') && prefs.interests?.includes('kids')) pool = pool.filter((i) => !i.flags.adult);
  const score = (i) => {
    let s = (i.image ? 2 : 0) + (i.sponsor ? 1 : 0);
    for (const k of prefs.interests || []) {
      if (INTEREST_TEST[k]?.(i)) s += 3;
      if (i.categories.includes(k)) s += 3;
    }
    if (overlaps(i, w.today)) s += 1.5;
    return s;
  };
  const seen = new Set();
  return pool.map((i) => ({ i, s: score(i) })).sort((a, b) => b.s - a.s)
    .filter(({ i }) => { const k = i.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, max).map(({ i }) => i).sort((a, b) => a.start.localeCompare(b.start));
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const path = (i) => (i.type === 'activity' ? `/things-to-do/${i.slug}/` : `/events/${i.slug}/`);
const place = (i) => [i.venue?.name, i.neighborhood ? hoodBySlug[i.neighborhood]?.name : null, cityBySlug[i.city]?.name].filter(Boolean).join(' · ');

export function renderDigest(picks, prefs, now = new Date()) {
  const day = now.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'long', month: 'long', day: 'numeric' });
  const rows = picks.map((i) => `
    <tr><td style="padding:14px 0;border-bottom:1px solid #eee">
      <div style="font:700 12px/1.2 Arial;color:#ef4b25;text-transform:uppercase;letter-spacing:.06em">${esc(categoryBySlug[i.categories[0]]?.emoji || '')} ${esc(formatWhen(i))}</div>
      <a href="${absolute(path(i))}" style="font:700 18px/1.3 Arial;color:#131a2e;text-decoration:none">${esc(i.title)}</a>
      <div style="font:14px/1.4 Arial;color:#6b7386">${esc(place(i))}${i.flags.free ? ' · Free' : i.priceText ? ` · ${esc(i.priceText)}` : ''}${i.sponsor ? ' · Sponsored' : ''}</div>
    </td></tr>`).join('');
  const html = `<!doctype html><html><body style="margin:0;background:#fbf7f0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;padding:24px">
    <tr><td style="font:800 24px Arial;color:#131a2e">🌉 Your Bay Area picks for ${esc(day)}</td></tr>
    <tr><td style="font:15px Arial;color:#3b4458;padding:6px 0 10px">Hand-matched to ${esc([...(prefs.regions || []), ...(prefs.interests || [])].join(', ') || 'everything fun')}.</td></tr>
    ${rows || '<tr><td style="font:15px Arial">Quiet day! Check the full weekend list.</td></tr>'}
    <tr><td style="padding-top:18px"><a href="${absolute('/this-weekend/')}" style="background:#ef4b25;color:#fff;padding:12px 18px;border-radius:999px;font:700 15px Arial;text-decoration:none">See everything this weekend →</a></td></tr>
    <tr><td style="font:12px Arial;color:#8f99b0;padding-top:22px">You’re receiving this because you signed up at ${esc(SITE.name)}. <a href="{{unsubscribe_url}}" style="color:#8f99b0">Unsubscribe</a></td></tr>
  </table></td></tr></table></body></html>`;
  const text = `Your Bay Area picks for ${day}\n\n${picks.map((i) => `• ${i.title} — ${formatWhen(i)} — ${place(i)}\n  ${absolute(path(i))}`).join('\n')}\n\nUnsubscribe: {{unsubscribe_url}}`;
  return { subject: `🌉 ${picks[0] ? `${picks[0].title} + ${Math.max(picks.length - 1, 0)} more` : 'Your Bay Area picks'} — ${day}`, html, text };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const prefs = JSON.parse(process.argv[2] || '{}');
  const data = JSON.parse(fs.readFileSync(process.env.EVENTS_FILE || 'data/events.json', 'utf8'));
  const out = renderDigest(pickForSubscriber(data.items, prefs), prefs);
  process.stdout.write(process.argv.includes('--text') ? out.text : out.html);
}
