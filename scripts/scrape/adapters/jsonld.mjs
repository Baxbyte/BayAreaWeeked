// Generic adapter: reads schema.org Event data (JSON-LD) embedded in event listing pages.
// Works with Eventbrite, AllEvents, DoStuff (DoTheBay), many venue sites, WordPress event plugins, etc.
import * as cheerio from 'cheerio';
import { fetchText } from '../http.mjs';
import { expandUrls } from './util.mjs';

const EVENT_TYPES = /(^|:)(Event|.*Event|Festival|ExhibitionEvent|Hackathon|SportsEvent|TheaterEvent|ScreeningEvent)$/;

function types(o) {
  const t = o?.['@type'];
  return Array.isArray(t) ? t : t ? [t] : [];
}

export function collectJsonLd(html) {
  const $ = cheerio.load(html);
  const blocks = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const txt = $(el).contents().text().trim();
    if (!txt) return;
    try {
      blocks.push(JSON.parse(txt));
    } catch {
      try {
        blocks.push(JSON.parse(txt.replace(/,\s*([}\]])/g, '$1').replace(/[\u0000-\u001f]+/g, ' ')));
      } catch { /* ignore broken block */ }
    }
  });
  return blocks;
}

export function findEvents(node, out = [], depth = 0) {
  if (!node || depth > 8) return out;
  if (Array.isArray(node)) { for (const n of node) findEvents(n, out, depth + 1); return out; }
  if (typeof node !== 'object') return out;
  if (types(node).some((t) => EVENT_TYPES.test(t)) && node.name && node.startDate) { out.push(node); return out; }
  for (const k of ['@graph', 'itemListElement', 'item', 'mainEntity', 'subEvent', 'event', 'events']) {
    if (node[k]) findEvents(node[k], out, depth + 1);
  }
  return out;
}

const first = (v) => (Array.isArray(v) ? v[0] : v);
const imgUrl = (v) => {
  const i = first(v);
  return typeof i === 'string' ? i : i?.url || i?.contentUrl || null;
};

function addressText(a) {
  if (!a) return { text: null, locality: null };
  if (typeof a === 'string') return { text: a, locality: null };
  const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean);
  return { text: parts.join(', '), locality: a.addressLocality || null };
}

export function mapJsonLdEvent(ev, src, pageUrl) {
  const mode = String(ev.eventAttendanceMode || '');
  if (/OnlineEventAttendanceMode/i.test(mode)) return null;
  if (/EventCancelled/i.test(String(ev.eventStatus || ''))) return null;
  const loc = first(ev.location) || {};
  if (types(loc).includes('VirtualLocation')) return null;
  const addr = addressText(loc.address);
  const geo = loc.geo || {};
  const offers = [ev.offers].flat().filter(Boolean);
  const prices = offers.flatMap((o) => [o.price, o.lowPrice, o.highPrice]).map(Number).filter((n) => Number.isFinite(n));
  const free = ev.isAccessibleForFree === true || ev.isAccessibleForFree === 'true' || ev.isAccessibleForFree === 'True';
  const offerUrl = offers.find((o) => o.url)?.url;
  const kw = ev.keywords ? (Array.isArray(ev.keywords) ? ev.keywords : String(ev.keywords).split(',')) : [];
  return {
    sourceId: src.id, sourceName: src.name, sourceHome: src.home,
    externalId: ev['@id'] || ev.identifier || null,
    title: ev.name,
    description: ev.description,
    url: ev.url || pageUrl,
    baseUrl: pageUrl,
    ticketUrl: offerUrl || null,
    image: imgUrl(ev.image),
    start: ev.startDate,
    end: ev.endDate,
    venueName: loc.name || null,
    address: addr.text,
    city: addr.locality,
    lat: geo.latitude ?? null,
    lng: geo.longitude ?? null,
    priceMin: free ? 0 : prices.length ? Math.min(...prices) : null,
    priceMax: free ? 0 : prices.length ? Math.max(...prices) : null,
    organizer: first(ev.organizer)?.name || null,
    tags: [...kw, ...types(ev).filter((t) => t !== 'Event')].map(String),
    typicalAgeRange: ev.typicalAgeRange,
  };
}

export async function run(src, ctx) {
  const urls = expandUrls(src, ctx.now);
  const out = [];
  const detailLinks = new Set();
  for (const url of urls) {
    let html;
    try {
      html = await fetchText(url);
    } catch (e) {
      ctx.warn(`${src.id}: ${e.message}`);
      continue;
    }
    const events = findEvents(collectJsonLd(html));
    for (const ev of events) {
      const m = mapJsonLdEvent(ev, src, url);
      if (m) out.push(m);
    }
    if (src.followLinks) {
      const $ = cheerio.load(html);
      $(src.followLinks).each((_, a) => {
        const href = $(a).attr('href');
        if (href) try { detailLinks.add(new URL(href, url).toString()); } catch { /* skip */ }
      });
    }
  }
  if (detailLinks.size) {
    for (const link of [...detailLinks].slice(0, src.maxDetails || 40)) {
      try {
        const html = await fetchText(link);
        for (const ev of findEvents(collectJsonLd(html))) {
          const m = mapJsonLdEvent(ev, src, link);
          if (m) out.push(m);
        }
      } catch (e) {
        ctx.warn(`${src.id}: ${e.message}`);
      }
    }
  }
  return out;
}
