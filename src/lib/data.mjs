// Build-time data access for pages. Everything is computed once per build.
import crypto from 'node:crypto';
import { tidyPrice } from './price.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { normalize } from '../../scripts/scrape/normalize.mjs';
import { CITIES, NEIGHBORHOODS, REGIONS, cityBySlug, hoodBySlug, regionBySlug } from './geo.mjs';
import { CATEGORIES, VIBES, categoryBySlug, vibeBySlug } from './taxonomy.mjs';
import { overlaps, ptDateKey, windows } from './time.mjs';

const root = process.cwd();
const read = (p, fb) => {
  try { return JSON.parse(fs.readFileSync(path.resolve(root, p), 'utf8')); } catch { return fb; }
};

export const DATA = read(process.env.EVENTS_FILE || 'data/events.json', { generatedAt: null, items: [], sources: [] });
export const SPONSORS = read('data/sponsors.json', { slots: [], campaigns: [] });
const SAFETY = read('data/image-safety.json', {});
const imageKey = (url) => crypto.createHash('sha1').update(url).digest('hex').slice(0, 16);
export const NOW = process.env.BUILD_NOW ? new Date(process.env.BUILD_NOW) : new Date();
export const W = windows(NOW);
export const UPDATED = DATA.generatedAt ? new Date(DATA.generatedAt) : NOW;

export const itemPath = (i) => (i.type === 'activity' ? `/things-to-do/${i.slug}/` : `/events/${i.slug}/`);

function endTime(i) {
  if (!i.start) return Infinity;
  return i.end ? Date.parse(i.end) : Date.parse(i.start) + (i.allDay ? 86400000 : 3 * 3600000);
}

// ---- Sponsored campaigns ------------------------------------------------------------------
const today = ptDateKey(NOW);
const activeCampaigns = (SPONSORS.campaigns || []).filter((c) => (!c.start || c.start <= today) && (!c.end || c.end >= today) && c.bid > 0);

const sponsorItems = [];
for (const c of activeCampaigns) {
  if (c.eventId || !c.event) continue;
  const e = c.event;
  const it = normalize({ ...e, sourceId: `sponsor-${c.id}`, sourceName: c.sponsor, sourceHome: e.url, citySlug: e.city, venueName: e.venueName,
    forceCategories: e.categories, externalId: c.id });
  if (it) { it.firstSeen = DATA.generatedAt; it.imageSafe = !!(it.image && SAFETY[imageKey(it.image)]?.safe); sponsorItems.push(it); }
}

// Family-friendly gate: organizer images that haven't passed the image-safety check are removed here,
// so no page, feed or API can ever show them.
export const ALL = [...(DATA.items || []), ...sponsorItems].map((i) => ({
  ...i, image: i.imageSafe === true ? i.image : null, priceText: tidyPrice(i.priceText, i.priceMin, i.priceMax), path: itemPath(i), past: i.type === 'event' && endTime(i) < NOW.getTime(),
}));
export const byId = new Map(ALL.map((i) => [i.id, i]));

for (const c of activeCampaigns) {
  const target = c.eventId ? byId.get(c.eventId) : ALL.find((a) => a.sources?.[0]?.id === `sponsor-${c.id}`);
  if (target) { target.sponsor = { id: c.id, name: c.sponsor, bid: c.bid, slots: c.slots || [], deal: c.deal || null, match: c.match || {} }; }
}

export const EVENTS = ALL.filter((i) => i.type === 'event' && !i.past).sort((a, b) => a.start.localeCompare(b.start));
export const ACTIVITIES = ALL.filter((i) => i.type === 'activity');
export const PAST = ALL.filter((i) => i.past);

// ---- Filters ------------------------------------------------------------------------------
export const VIBE_TEST = {
  'kid-friendly': (i) => i.flags.kids,
  nightlife: (i) => i.flags.nightlife,
  free: (i) => i.flags.free,
  'hot-day': (i) => i.flags.hot,
  'rainy-day': (i) => i.flags.rainy,
  'fog-escape': (i) => i.flags.fog,
  'date-night': (i) => i.flags.date,
  'near-bart': (i) => !!i.flags.bart,
};

export function filterItems(list, { region, city, hood, category, vibe } = {}) {
  return list.filter((i) => (!region || i.region === region) && (!city || i.city === city) && (!hood || i.neighborhood === hood)
    && (!category || i.categories.includes(category)) && (!vibe || VIBE_TEST[vibe](i)));
}

export const inWindow = (list, win) => list.filter((i) => overlaps(i, win));

/** Collapse repeats of the same title+venue into one card with a "+N more dates" note. */
export function collapseRepeats(list) {
  const seen = new Map();
  const out = [];
  for (const i of list) {
    const k = `${i.title.toLowerCase()}|${(i.venue?.name || '').toLowerCase()}`;
    if (seen.has(k)) { seen.get(k).moreDates = (seen.get(k).moreDates || 0) + 1; continue; }
    const copy = { ...i, moreDates: 0 };
    seen.set(k, copy);
    out.push(copy);
  }
  return out;
}

function quality(i) {
  return (i.image ? 4 : 0) + Math.min((i.description || '').length / 150, 2) + (i.venue?.approx ? 0 : 1) + (i.sources?.length > 1 ? 1.5 : 0)
    + (i.flags.free ? 0.5 : 0) + (i.priceMin != null ? 0.3 : 0);
}

/** Best-looking, most varied picks from a list. */
export function topPicks(list, n = 12) {
  const pool = collapseRepeats(list).map((i) => ({ i, q: quality(i) })).sort((a, b) => b.q - a.q);
  const out = [];
  const perCat = {};
  for (const { i } of pool) {
    const c = i.categories[0];
    if ((perCat[c] || 0) >= Math.max(2, Math.ceil(n / 5))) continue;
    perCat[c] = (perCat[c] || 0) + 1;
    out.push(i);
    if (out.length >= n) break;
  }
  if (out.length < n) for (const { i } of pool) { if (!out.includes(i)) out.push(i); if (out.length >= n) break; }
  return out.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
}

/** Sponsored items for a placement, highest bid first. ctx narrows by region/city/category/vibe. */
export function sponsoredFor(slot, ctx = {}, pool = [...EVENTS, ...ACTIVITIES]) {
  const slotDef = (SPONSORS.slots || []).find((s) => s.id === slot);
  return pool.filter((i) => i.sponsor?.slots.includes(slot)).filter((i) => {
    const m = i.sponsor.match || {};
    if (ctx.region && m.regions?.length && !m.regions.includes(ctx.region)) return false;
    if (ctx.region && !m.regions?.length && i.region !== ctx.region) return false;
    if (ctx.city && i.city !== ctx.city && !(m.cities || []).includes(ctx.city)) return false;
    if (ctx.category && !i.categories.includes(ctx.category) && !(m.categories || []).includes(ctx.category)) return false;
    if (ctx.vibe && !VIBE_TEST[ctx.vibe](i) && !(m.vibes || []).includes(ctx.vibe)) return false;
    return true;
  }).sort((a, b) => b.sponsor.bid - a.sponsor.bid).slice(0, slotDef?.maxWinners || 2);
}

export const topBidFor = (slot) => Math.max(0, ...activeCampaigns.filter((c) => (c.slots || []).includes(slot)).map((c) => c.bid));
export const DEALS = ALL.filter((i) => i.sponsor?.deal && !i.past).sort((a, b) => b.sponsor.bid - a.sponsor.bid);

// ---- Counts & lookups ---------------------------------------------------------------------
const countBy = (list, key) => list.reduce((m, i) => { const k = key(i); if (k) m[k] = (m[k] || 0) + 1; return m; }, {});
export const COUNTS = {
  region: countBy([...EVENTS, ...ACTIVITIES], (i) => i.region),
  city: countBy([...EVENTS, ...ACTIVITIES], (i) => i.city),
  hood: countBy([...EVENTS, ...ACTIVITIES], (i) => i.neighborhood),
  category: Object.fromEntries(CATEGORIES.map((c) => [c.slug, filterItems([...EVENTS, ...ACTIVITIES], { category: c.slug }).length])),
  vibe: Object.fromEntries(VIBES.map((v) => [v.slug, filterItems([...EVENTS, ...ACTIVITIES], { vibe: v.slug }).length])),
  weekend: inWindow(EVENTS, W.weekend).length,
};

export const MIN_INDEXABLE = 3; // pages with fewer items get noindex to avoid thin content

export { CATEGORIES, CITIES, NEIGHBORHOODS, REGIONS, VIBES, categoryBySlug, cityBySlug, hoodBySlug, regionBySlug, vibeBySlug };

export function placeName(i) {
  const hood = i.neighborhood && hoodBySlug[i.neighborhood];
  const city = cityBySlug[i.city];
  if (hood && city?.slug === 'san-francisco') return hood.name;
  if (hood) return `${hood.name}, ${city.name}`;
  return city?.name || '';
}

/** Items for a hub page: { weekend, nextWeek, later, activities } */
export function sectionsFor(filter) {
  const ev = filterItems(EVENTS, filter);
  const weekend = inWindow(ev, W.weekend);
  const nextWeek = inWindow(ev, W.nextWeek).filter((i) => !weekend.includes(i));
  const later = ev.filter((i) => Date.parse(i.start) >= W.nextWeek.end.getTime());
  const soon = ev.filter((i) => !weekend.includes(i) && !nextWeek.includes(i) && !later.includes(i));
  return { all: ev, weekend, soon, nextWeek, later, activities: filterItems(ACTIVITIES, filter) };
}
