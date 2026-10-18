#!/usr/bin/env node
// Daily scraper: pulls every enabled source, normalizes + classifies items, merges with yesterday's data,
// and writes data/events.json (consumed by the Astro build) plus data/scrape-report.json.
//
//   node scripts/scrape/index.mjs            # full run
//   node scripts/scrape/index.mjs --offline  # no network; rebuild from evergreen + previous data
//   node scripts/scrape/index.mjs --only=19hz,stanford
import fs from 'node:fs';
import { classify } from '../../src/lib/classify.mjs';
import { nearestHood } from '../../src/lib/geo.mjs';
import { toPTISO } from '../../src/lib/time.mjs';
import { geocode, saveGeocache } from './geocode.mjs';
import { hoodAt } from './hoods.mjs';
import { moderateImages } from '../safety/moderate-events.mjs';
import { hash, mergeDuplicates, normalize } from './normalize.mjs';

const ADAPTERS = {
  jsonld: () => import('./adapters/jsonld.mjs'),
  rss: () => import('./adapters/rss.mjs'),
  ical: () => import('./adapters/ical.mjs'),
  localist: () => import('./adapters/localist.mjs'),
  tribe: () => import('./adapters/tribe.mjs'),
  ticketmaster: () => import('./adapters/ticketmaster.mjs'),
  seatgeek: () => import('./adapters/seatgeek.mjs'),
  nineteenhz: () => import('./adapters/nineteenhz.mjs'),
  roundups: () => import('./adapters/roundups.mjs'),
};

const DATA = new URL('../../data/', import.meta.url);
const readJSON = (name, fallback) => {
  try { return JSON.parse(fs.readFileSync(new URL(name, DATA), 'utf8')); } catch { return fallback; }
};

const args = process.argv.slice(2);
const offline = args.includes('--offline');
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const now = process.env.SCRAPE_NOW ? new Date(process.env.SCRAPE_NOW) : new Date();
const HORIZON_DAYS = 45;
const SOURCE_TIMEOUT_MS = Number(process.env.SOURCE_TIMEOUT_MS || 4 * 60000);

function withTimeout(p, ms, label) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms / 1000}s`)), ms))]);
}

async function runSource(src) {
  const t0 = Date.now();
  const report = { id: src.id, name: src.name, type: src.type, status: 'ok', raw: 0, kept: 0, warnings: [], ms: 0 };
  const ctx = {
    now,
    warn: (m) => { if (report.warnings.length < 15) report.warnings.push(String(m).slice(0, 240)); },
    skip: (reason) => { report.status = 'skipped'; report.reason = reason; return []; },
  };
  let raw = [];
  console.log(`→ ${src.id} …`);
  try {
    const mod = await ADAPTERS[src.type]();
    raw = (await withTimeout(mod.run(src, ctx), SOURCE_TIMEOUT_MS, src.id)) || [];
  } catch (e) {
    report.status = 'error';
    report.error = String(e.message || e).slice(0, 300);
  }
  if (report.status === 'ok' && raw.length === 0 && report.warnings.length) report.status = 'error';
  report.raw = raw.length;
  const items = [];
  for (const r of raw) {
    try {
      const it = normalize(r, { city: src.defaultCity });
      if (it) items.push(it);
    } catch (e) {
      ctx.warn(`normalize: ${e.message}`);
    }
  }
  report.ms = Date.now() - t0;
  return { report, items };
}

async function pool(list, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < list.length) {
      const idx = i++;
      out[idx] = await fn(list[idx]);
    }
  }));
  return out;
}

function isUpcoming(it) {
  const end = it.end ? Date.parse(it.end) : Date.parse(it.start) + (it.allDay ? 86400000 : 4 * 3600000);
  return end >= now.getTime() - 3 * 3600000 && Date.parse(it.start) <= now.getTime() + HORIZON_DAYS * 86400000;
}

async function improveGeo(items) {
  for (const it of items) {
    if (!it.venue.approx || !(it.venue.name || it.venue.address)) continue;
    const q = [it.venue.name, it.venue.address].filter(Boolean).join(', ');
    const g = await geocode(q.includes('CA') ? q : `${q}, CA`);
    if (!g) continue;
    Object.assign(it.venue, { lat: g.lat, lng: g.lng, approx: false });
    it.neighborhood = hoodAt(g.lat, g.lng, it.city) || it.neighborhood || nearestHood(g.lat, g.lng, it.city)?.slug || null;
    const { flags } = classify(it);
    it.flags.bart = flags.bart;
  }
}

async function main() {
  const { sources } = readJSON('sources.json', { sources: [] });
  const evergreen = readJSON('evergreen.json', []);
  const previous = readJSON('events.json', { items: [] });
  const prevById = new Map(previous.items.map((it) => [it.id, it]));

  const enabled = sources.filter((s) => s.enabled !== false && (!only.length || only.includes(s.id)));
  const results = offline ? [] : await pool(enabled, 6, runSource);
  const reports = results.map((r) => r.report);
  for (const r of results) r.report.kept = r.items.filter(isUpcoming).length;
  for (const r of reports) console.log(`${r.status.padEnd(7)} ${r.id.padEnd(22)} raw=${String(r.raw).padStart(4)} kept=${String(r.kept).padStart(4)} ${r.error || r.reason || ''}`);

  let fresh = results.flatMap((r) => r.items).filter(isUpcoming);
  fresh = mergeDuplicates(fresh);
  if (!offline) await improveGeo(fresh);
  saveGeocache();

  const nowIso = toPTISO(now);
  const freshIds = new Set(fresh.map((f) => f.id));
  const contentHash = (it) => hash(JSON.stringify([it.title, it.start, it.end, it.venue?.name, it.priceText, it.description, it.image, it.ticketUrl]), 10);
  for (const it of fresh) {
    const prev = prevById.get(it.id);
    it.firstSeen = prev?.firstSeen || nowIso;
    it.lastSeen = nowIso;
    it.hash = contentHash(it);
    it.updatedAt = prev && prev.hash === it.hash ? prev.updatedAt || prev.firstSeen : nowIso;
  }

  // Keep yesterday's upcoming events if their source failed today or they were seen very recently
  // (avoids events flickering in and out when a listing page paginates differently).
  const okSources = new Set(reports.filter((r) => r.status === 'ok').map((r) => r.id));
  const carried = previous.items.filter((it) => {
    if (it.type !== 'event' || freshIds.has(it.id) || !isUpcoming(it)) return false;
    const srcOk = it.sources?.some((s) => okSources.has(s.id));
    const seenRecently = now - Date.parse(it.lastSeen || 0) < 36 * 3600000;
    return offline || !srcOk || seenRecently;
  });

  const activities = evergreen.map((e) => normalize({
    ...e, type: 'activity', sourceId: 'editors', sourceName: 'Bay Area Weekend editors', sourceHome: e.url,
    venueName: e.venue.name, address: e.venue.address, citySlug: e.venue.city, lat: e.venue.lat, lng: e.venue.lng,
    priceText: e.price, forceCategories: e.cats, forceFlags: e.flags,
  })).filter(Boolean).map((a) => {
    const prev = prevById.get(a.id);
    const h = contentHash(a);
    return { ...a, firstSeen: prev?.firstSeen || nowIso, hash: h, updatedAt: prev && prev.hash === h ? prev.updatedAt : nowIso };
  });

  const events = mergeDuplicates([...fresh, ...carried]).sort((a, b) => a.start.localeCompare(b.start));
  // Family-friendly gate: organizers' images are only shown after passing the image-safety check.
  await moderateImages(events, { offline });
  const items = [...events, ...activities];

  const out = {
    generatedAt: nowIso,
    counts: { events: events.length, activities: activities.length, newToday: fresh.filter((f) => f.firstSeen === nowIso).length },
    sources: offline ? previous.sources || [] : reports.map(({ id, name, status, kept }) => ({ id, name, status, kept })),
    items,
  };
  fs.writeFileSync(new URL('events.json', DATA), JSON.stringify(out));
  fs.writeFileSync(new URL('scrape-report.json', DATA), JSON.stringify({ generatedAt: nowIso, offline, reports }, null, 2));
  console.log(`\n✔ ${events.length} events (${out.counts.newToday} new, ${carried.length} carried over) + ${activities.length} activities → data/events.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
