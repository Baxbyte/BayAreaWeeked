// SeatGeek Platform API (free client id: https://platform.seatgeek.com). Set SEATGEEK_CLIENT_ID.
import { fetchJSON } from '../http.mjs';

export function mapSeatGeek(e, src) {
  const v = e.venue || {};
  const perf = e.performers?.find((p) => p.image) || e.performers?.[0];
  const tax = (e.taxonomies || []).map((t) => t.name.replace(/_/g, ' '));
  return {
    sourceId: src.id, sourceName: src.name, sourceHome: src.home,
    externalId: String(e.id), title: e.title || e.short_title,
    description: e.description || '',
    url: e.url, ticketUrl: e.url, image: perf?.image || null,
    start: e.datetime_tbd ? e.datetime_local?.slice(0, 10) : e.datetime_local?.slice(0, 16), allDay: !!e.datetime_tbd,
    venueName: v.name, address: [v.address, v.extended_address].filter(Boolean).join(', '), city: v.city || null,
    lat: v.location?.lat ?? null, lng: v.location?.lon ?? null,
    priceMin: e.stats?.lowest_price ?? null, priceMax: e.stats?.highest_price ?? null,
    tags: [e.type, ...tax].filter(Boolean),
    forceCategories: tax.some((t) => /sports|baseball|basketball|football|hockey|soccer/.test(t)) ? ['sports'] : tax.includes('concert') ? ['live-music'] : [],
  };
}

export async function run(src, ctx) {
  const id = process.env.SEATGEEK_CLIENT_ID;
  if (!id) return ctx.skip('SEATGEEK_CLIENT_ID not set');
  const out = [];
  const until = new Date(ctx.now.getTime() + (src.days || 21) * 86400000).toISOString().slice(0, 19);
  for (let page = 1; page <= (src.pages || 5); page++) {
    const q = new URLSearchParams({ client_id: id, lat: '37.70', lon: '-122.25', range: `${src.radiusMiles || 55}mi`, per_page: '100', page: String(page),
      'datetime_local.lte': until, sort: 'datetime_local.asc' });
    let data;
    try {
      data = await fetchJSON(`https://api.seatgeek.com/2/events?${q}`, { skipRobots: true });
    } catch (err) {
      ctx.warn(`${src.id}: ${err.message}`);
      break;
    }
    for (const ev of data.events || []) out.push(mapSeatGeek(ev, src));
    if ((data.events || []).length < 100) break;
  }
  return out;
}
