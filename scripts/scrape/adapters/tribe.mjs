// "The Events Calendar" WordPress plugin REST API: {site}/wp-json/tribe/events/v1/events
import { fetchJSON } from '../http.mjs';

export function mapTribe(e, src) {
  const v = e.venue && !Array.isArray(e.venue) ? e.venue : {};
  const cost = e.cost || '';
  return {
    sourceId: src.id, sourceName: src.name, sourceHome: src.home,
    externalId: String(e.id), title: e.title, description: e.description || e.excerpt,
    url: e.url, ticketUrl: e.website || null, image: e.image?.url || null,
    start: e.all_day ? e.start_date?.slice(0, 10) : e.start_date?.replace(' ', 'T').slice(0, 16),
    end: e.all_day ? null : e.end_date?.replace(' ', 'T').slice(0, 16), allDay: !!e.all_day,
    venueName: v.venue || null, address: [v.address, v.city].filter(Boolean).join(', '), city: v.city || src.defaultCityName || null,
    lat: v.geo_lat ? Number(v.geo_lat) : null, lng: v.geo_lng ? Number(v.geo_lng) : null,
    priceText: cost || null,
    tags: [...(e.categories || []).map((c) => c.name), ...(e.tags || []).map((t) => t.name)],
  };
}

export async function run(src, ctx) {
  const out = [];
  const end = new Date(ctx.now.getTime() + (src.days || 21) * 86400000).toISOString().slice(0, 10);
  for (const site of src.sites || []) {
    for (let page = 1; page <= (src.pages || 3); page++) {
      const url = `${site.replace(/\/$/, '')}/wp-json/tribe/events/v1/events?per_page=50&page=${page}&end_date=${end}`;
      let data;
      try {
        data = await fetchJSON(url);
      } catch (e) {
        ctx.warn(`${src.id}: ${e.message}`);
        break;
      }
      for (const ev of data.events || []) out.push(mapTribe(ev, src));
      if (!data.total_pages || page >= data.total_pages) break;
    }
  }
  return out;
}
