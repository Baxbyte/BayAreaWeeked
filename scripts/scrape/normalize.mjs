// Turns raw adapter output into clean, classified, geo-tagged directory items.
import crypto from 'node:crypto';
import { classify } from '../../src/lib/classify.mjs';
import { cityBySlug, cityFromText, hoodFromText, inBayArea, nearestCity, nearestHood } from '../../src/lib/geo.mjs';
import { parseWhen, toPTISO } from '../../src/lib/time.mjs';
import { hoodAt } from './hoods.mjs';
import { clean, isExplicit } from '../../src/lib/policy.mjs';

export const hash = (s, n = 10) => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, n);

export function slugify(s, max = 70) {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, max).replace(/-+$/g, '') || 'event';
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…' };
export function decodeEntities(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9#]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

export function cleanText(s) {
  return decodeEntities(String(s || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{2,}/g, '\n').trim();
}

export function truncate(s, max = 420) {
  const t = cleanText(s).replace(/\n/g, ' ');
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const dot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (dot > max * 0.5 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, '') + '…').trim();
}

export function cleanTitle(s) {
  return cleanText(s).replace(/\s+/g, ' ').replace(/^(\W+)/, '').replace(/\s*[|–-]\s*(tickets|eventbrite)$/i, '').slice(0, 160).trim();
}

function absUrl(u, base) {
  if (!u) return null;
  try {
    const url = new URL(String(u).trim(), base || undefined);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.toString();
  } catch {
    return null;
  }
}

export function parsePrice(text) {
  if (text == null) return {};
  const t = String(text);
  if (/\bfree\b/i.test(t) && !/\$\s*[1-9]/.test(t)) return { priceMin: 0, priceMax: 0 };
  const nums = [...t.matchAll(/\$\s*(\d+(?:\.\d{1,2})?)/g)].map((m) => +m[1]);
  if (!nums.length) return {};
  return { priceMin: Math.min(...nums), priceMax: Math.max(...nums) };
}

function jitter(seed, km = 0.5) {
  const h = parseInt(hash(seed, 8), 16);
  const a = ((h & 0xffff) / 0xffff) * Math.PI * 2;
  const r = (((h >>> 16) & 0xffff) / 0xffff) * km;
  return { dLat: (r / 111) * Math.cos(a), dLng: (r / 88) * Math.sin(a) };
}

/** Resolve city / region / neighborhood / coordinates. Returns null if outside the Bay Area. */
export function resolveGeo(raw, defaults = {}) {
  let lat = raw.lat != null ? Number(raw.lat) : null;
  let lng = raw.lng != null ? Number(raw.lng) : null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) { lat = null; lng = null; }
  if (lat != null && !inBayArea(lat, lng)) return null;

  const placeText = [raw.city, raw.address, raw.venueName].filter(Boolean).join(' , ');
  let city = (raw.citySlug && cityBySlug[raw.citySlug]) || cityFromText(raw.city) || cityFromText(placeText);
  if (!city && lat != null) city = nearestCity(lat, lng, 40);
  // An explicit city we don't recognize (and no coordinates) means it's outside our area.
  if (!city && raw.city && lat == null) return null;
  if (!city) city = cityFromText(raw.title) || (defaults.city && cityBySlug[defaults.city]) || null;
  if (!city) return null;

  let approx = false;
  if (lat == null) {
    const j = jitter(raw.venueName || raw.address || raw.title, city.slug === 'san-francisco' ? 1.2 : 0.8);
    lat = +(city.lat + j.dLat).toFixed(5);
    lng = +(city.lng + j.dLng).toFixed(5);
    approx = true;
  }
  const hoodText = [raw.venueName, raw.address, raw.title].filter(Boolean).join(' ');
  // Curated name matches first (e.g. "Dolores Park" → Mission), then real boundaries, then nearest center.
  let hood = hoodFromText(hoodText, city.slug);
  const polyHood = hood || approx ? null : hoodAt(lat, lng, city.slug);
  if (polyHood) hood = { slug: polyHood };
  if (!hood && !approx) hood = nearestHood(lat, lng, city.slug);
  return { city: city.slug, region: city.region, neighborhood: hood?.slug || null, lat, lng, approxGeo: approx };
}

/**
 * @param raw {sourceId, sourceName, sourceHome, externalId, title, description, url, ticketUrl, image, start, end,
 *             venueName, address, city, lat, lng, priceMin, priceMax, priceText, tags, forceFlags, forceCategories, type}
 */
export function normalize(raw, defaults = {}) {
  const title = clean(cleanTitle(raw.title));
  if (!title || title.length < 3) return null;
  // Family-friendly policy: sexually explicit listings are never included.
  if (isExplicit(raw.title, raw.description, raw.venueName, (raw.tags || []).join(' '), raw.organizer)) return null;
  const isActivity = raw.type === 'activity';

  let start = null;
  let end = null;
  let allDay = false;
  if (!isActivity) {
    const s = parseWhen(raw.start);
    if (!s) return null;
    start = s.date;
    allDay = raw.allDay ?? s.allDay;
    const e = parseWhen(raw.end);
    if (e && e.date > start) end = e.date;
    if (end && end - start > 120 * 86400000) end = null; // ignore implausible multi-month ranges
  }

  const geo = resolveGeo({ ...raw, title }, defaults);
  if (!geo) return null;

  // Price text must look like a price (no links or long blurbs).
  if (raw.priceText && (/https?:|www\.|\.(org|com)\b/i.test(raw.priceText) || raw.priceText.length > 60)) raw = { ...raw, priceText: null };
  const price = raw.priceMin != null ? { priceMin: raw.priceMin, priceMax: raw.priceMax ?? raw.priceMin } : parsePrice(raw.priceText);
  const description = clean(truncate(raw.description || '', 600));
  const url = absUrl(raw.url, raw.baseUrl);
  const keyBase = raw.externalId ? `${raw.sourceId}:${raw.externalId}` : `${raw.sourceId}:${url || ''}:${title}:${start?.toISOString() || ''}`;
  const id = hash(keyBase, 12);
  const datePart = start ? toPTISO(start).slice(0, 10) : '';
  const slug = isActivity ? slugify(title) : `${slugify(title, 60)}-${datePart}-${id.slice(0, 4)}`;

  const item = {
    id, slug, type: isActivity ? 'activity' : 'event',
    title, description,
    url: url || null,
    ticketUrl: absUrl(raw.ticketUrl, raw.baseUrl),
    image: absUrl(Array.isArray(raw.image) ? raw.image[0] : raw.image, raw.baseUrl),
    start: start ? toPTISO(start) : null,
    end: end ? toPTISO(end) : null,
    allDay,
    schedule: raw.schedule || null,
    tip: raw.tip || null,
    venue: { name: clean(cleanText(raw.venueName || '')) || null, address: cleanText(raw.address || '') || null, lat: geo.lat, lng: geo.lng, approx: geo.approxGeo },
    city: geo.city, region: geo.region, neighborhood: geo.neighborhood,
    priceMin: price.priceMin ?? null, priceMax: price.priceMax ?? null,
    priceText: raw.priceText ? cleanText(raw.priceText).slice(0, 80) : (price.priceMin === 0 ? 'Free' : price.priceMin != null ? (price.priceMax > price.priceMin ? `$${price.priceMin}–$${price.priceMax}` : `$${price.priceMin}`) : null),
    organizer: raw.organizer ? clean(cleanText(raw.organizer)).slice(0, 100) : null,
    sourceTags: (raw.tags || []).map((t) => clean(cleanText(t))).filter(Boolean).slice(0, 12),
    sources: [{ id: raw.sourceId, name: raw.sourceName, url: url || raw.sourceHome || null }],
  };
  const { categories, flags } = classify({ ...item, forceFlags: raw.forceFlags, forceCategories: raw.forceCategories });
  item.categories = categories;
  item.flags = flags;
  return item;
}

const STOP = /\b(the|a|an|presents?|live|at|in|with|and|feat|featuring|ft|tickets?|sf|san francisco)\b/g;
export function dedupeKey(item) {
  const t = item.title.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(STOP, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  return `${t}|${item.start ? item.start.slice(0, 10) : 'activity'}|${item.city}`;
}

function score(item) {
  return (item.image ? 3 : 0) + (item.venue.approx ? 0 : 2) + Math.min(item.description.length / 200, 2) + (item.ticketUrl ? 1 : 0) + (item.priceMin != null ? 1 : 0);
}

export function mergeDuplicates(items) {
  const byKey = new Map();
  for (const it of items) {
    const k = dedupeKey(it);
    const prev = byKey.get(k);
    if (!prev) { byKey.set(k, it); continue; }
    const [keep, other] = score(it) > score(prev) ? [it, prev] : [prev, it];
    keep.image ||= other.image;
    keep.ticketUrl ||= other.ticketUrl;
    if (keep.description.length < 80 && other.description.length > keep.description.length) keep.description = other.description;
    if (keep.priceMin == null && other.priceMin != null) Object.assign(keep, { priceMin: other.priceMin, priceMax: other.priceMax, priceText: other.priceText });
    const seen = new Set(keep.sources.map((s) => s.id));
    for (const s of other.sources) if (!seen.has(s.id)) keep.sources.push(s);
    keep.sourceTags = [...new Set([...keep.sourceTags, ...other.sourceTags])].slice(0, 12);
    byKey.set(k, keep);
  }
  return [...byKey.values()];
}
