// Localist calendar API (used by Stanford and many universities/cities): {base}/api/2/events
import { fetchJSON } from '../http.mjs';

export function mapLocalist(e, src) {
  const inst = e.event_instances?.[0]?.event_instance || {};
  if (e.experience === 'virtual') return null;
  const types = (e.filters?.event_types || []).map((t) => t.name);
  return {
    sourceId: src.id, sourceName: src.name, sourceHome: src.home,
    externalId: `${e.id}:${inst.start}`,
    title: e.title,
    description: e.description_text || e.description,
    url: e.localist_url || e.url,
    ticketUrl: e.ticket_url || null,
    image: e.photo_url && !/placeholder|default/i.test(e.photo_url) ? e.photo_url.replace('/huge/', '/big/') : null,
    start: inst.start, end: inst.end, allDay: !!inst.all_day,
    venueName: e.location_name || e.location, address: e.address || null,
    city: e.geo?.city || src.defaultCityName || null,
    lat: e.geo?.latitude ? Number(e.geo.latitude) : null,
    lng: e.geo?.longitude ? Number(e.geo.longitude) : null,
    priceMin: e.free ? 0 : null,
    priceText: e.free ? 'Free' : e.ticket_cost || null,
    tags: [...types, ...(e.tags || []), ...(e.keywords || [])],
  };
}

export async function run(src, ctx) {
  const out = [];
  const maxPages = src.pages || 5;
  for (let page = 1; page <= maxPages; page++) {
    const url = `${src.base.replace(/\/$/, '')}/api/2/events?days=${src.days || 21}&pp=100&page=${page}`;
    let data;
    try {
      data = await fetchJSON(url);
    } catch (e) {
      ctx.warn(`${src.id}: ${e.message}`);
      break;
    }
    for (const wrap of data.events || []) {
      const m = mapLocalist(wrap.event || wrap, src);
      if (m) out.push(m);
    }
    if (!data.page || page >= data.page.total) break;
  }
  return out;
}
