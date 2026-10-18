#!/usr/bin/env node
// Instant indexing pings after each deploy:
//  1. IndexNow (Bing, Yandex, Seznam, Naver, Yep…): submits only URLs that are new or changed since the last run.
//  2. WebSub/PubSubHubbub: tells Google's hub our RSS feed changed (Google reads feeds to discover new URLs fast).
//  3. Optional Google Indexing API (GOOGLE_INDEXING_SA_JSON) — note Google officially supports it only for
//     JobPosting/BroadcastEvent pages, so it's off unless you set the secret.
// State lives in data/indexnow-state.json so each URL+lastmod is only submitted once.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { SITE, SITE_URL } from '../src/lib/site.mjs';

const DIST = path.resolve('dist');
const STATE = path.resolve('data/indexnow-state.json');
const dry = process.argv.includes('--dry-run');

function sitemapUrls() {
  const out = [];
  for (const f of fs.readdirSync(DIST).filter((f) => /^sitemap-.*\.xml$/.test(f))) {
    const xml = fs.readFileSync(path.join(DIST, f), 'utf8');
    for (const m of xml.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)) out.push({ loc: m[1].replace(/&amp;/g, '&'), lastmod: m[2] });
  }
  return out;
}

let state = {};
try { state = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { /* first run */ }
const urls = sitemapUrls();
const changed = urls.filter((u) => state[u.loc] !== u.lastmod);
// Hub pages change daily; always include the most important ones.
const priority = ['/', '/this-weekend/', '/today/', '/tonight/', '/next-week/', '/next-weekend/'].map((p) => `${SITE_URL}${p}`);
const toSend = [...new Set([...priority, ...changed.map((u) => u.loc)])].slice(0, 10000);
const host = new URL(SITE_URL).host;
console.log(`IndexNow: ${urls.length} URLs in sitemaps, ${changed.length} new/changed, sending ${toSend.length}`);

async function post(url, body, headers = {}) {
  if (dry) { console.log('[dry-run] POST', url); return { ok: true, status: 0 }; }
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  return res;
}

async function indexNow() {
  // keyLocation may sit in a sub-folder (e.g. GitHub Pages project sites); URLs must live under that folder.
  for (let i = 0; i < toSend.length; i += 10000) {
    const res = await post('https://api.indexnow.org/indexnow', {
      host, key: SITE.indexNowKey, keyLocation: `${SITE_URL}/${SITE.indexNowKey}.txt`, urlList: toSend.slice(i, i + 10000),
    });
    console.log(`IndexNow → HTTP ${res.status}`);
    if (!(res.ok || res.status === 202)) return false;
  }
  return true;
}

async function webSub() {
  const body = new URLSearchParams({ 'hub.mode': 'publish', 'hub.url': `${SITE_URL}/rss.xml` }).toString();
  if (dry) return console.log('[dry-run] WebSub publish');
  const res = await fetch('https://pubsubhubbub.appspot.com/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  console.log(`WebSub hub → HTTP ${res.status}`);
}

async function googleIndexing() {
  const raw = process.env.GOOGLE_INDEXING_SA_JSON;
  if (!raw) return;
  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/indexing', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
  const tok = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }) })).json();
  const limit = Number(process.env.GOOGLE_INDEXING_MAX || 180); // default quota is 200/day
  let ok = 0;
  for (const url of toSend.slice(0, limit)) {
    const res = await post('https://indexing.googleapis.com/v3/urlNotifications:publish', { url, type: 'URL_UPDATED' }, { Authorization: `Bearer ${tok.access_token}` });
    if (res.ok) ok++;
  }
  console.log(`Google Indexing API: ${ok}/${Math.min(limit, toSend.length)} accepted`);
}

const okIndexNow = await indexNow().catch((e) => { console.error('IndexNow failed:', e.message); return false; });
await webSub().catch((e) => console.error('WebSub failed:', e.message));
await googleIndexing().catch((e) => console.error('Google Indexing API failed:', e.message));

if (okIndexNow && !dry) {
  const next = Object.fromEntries(urls.map((u) => [u.loc, u.lastmod]));
  fs.writeFileSync(STATE, JSON.stringify(next));
}
