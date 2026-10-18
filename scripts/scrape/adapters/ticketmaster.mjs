// Ticketmaster Discovery API (free key: https://developer.ticketmaster.com). Set TICKETMASTER_API_KEY.
import { fetchJSON } from '../http.mjs';

export function mapTicketmaster(e, src) {
  const v = e._embedded?.venues?.[0] || {};
  const img = (e.images || []).filter((i) => i.ratio === '16_9').sort((a, b) => Math.abs(a.width - 1024) - Math.abs(b.width - 1024))[0] || e.images?.[0];
  const cls = e.classifications?.[0] || {};
  const pr = e.priceRanges?.[0];
  const startLocal = e.dates?.start?.localTime ? `${e.dates.start.localDate}T${e.dates.start.localTime.slice(0, 5)}` : e.dates?.start?.localDate;
  if (!startLocal) return null;
  const tags = [cls.segment?.name, cls.genre?.name, cls.subGenre?.name].filter((t) => t && t !== 'Undefined' && t !== 'Other');
  const age = e.ageRestrictions?.legalAgeEnforced ? '21+' : '';
  return {
    sourceId: src.id, sourceName: src.name, sourceHome: src.home,
    externalId: e.id, title: e.name,
    description: [e.info, e.pleaseNote, age && `Age restriction: ${age}`].filter(Boolean).join(' '),
    url: e.url, ticketUrl: e.url, image: img?.url || null,
    start: startLocal, allDay: !e.dates?.start?.localTime,
    venueName: v.name, address: [v.address?.line1, v.city?.name, v.state?.stateCode, v.postalCode].filter(Boolean).join(', '),
    city: v.city?.name || null,
    lat: v.location?.latitude ? Number(v.location.latitude) : null,
    lng: v.location?.longitude ? Number(v.location.longitude) : null,
    priceMin: pr?.min ?? null, priceMax: pr?.max ?? null,
    tags: [...tags, age].filter(Boolean),
    forceCategories: cls.segment?.name === 'Sports' ? ['sports'] : cls.segment?.name === 'Music' ? ['live-music'] : cls.segment?.name === 'Arts & Theatre' ? ['theater'] : [],
    forceFlags: e.ageRestrictions?.legalAgeEnforced ? { adult: true } : undefined,
  };
}

export async function run(src, ctx) {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return ctx.skip('TICKETMASTER_API_KEY not set');
  const out = [];
  // Query week-by-week to stay under the API's deep-paging limit.
  for (let w = 0; w < (src.weeks || 3); w++) {
    const s = new Date(ctx.now.getTime() + w * 7 * 86400000);
    const e = new Date(s.getTime() + 7 * 86400000);
    for (let page = 0; page < (src.pages || 4); page++) {
      const q = new URLSearchParams({
        apikey: key, latlong: '37.70,-122.25', radius: String(src.radiusMiles || 55), unit: 'miles', size: '200', page: String(page),
        sort: 'date,asc', startDateTime: s.toISOString().replace(/\.\d{3}Z$/, 'Z'), endDateTime: e.toISOString().replace(/\.\d{3}Z$/, 'Z'), locale: '*',
      });
      let data;
      try {
        data = await fetchJSON(`https://app.ticketmaster.com/discovery/v2/events.json?${q}`, { skipRobots: true });
      } catch (err) {
        ctx.warn(`${src.id}: ${err.message}`);
        break;
      }
      for (const ev of data._embedded?.events || []) {
        const m = mapTicketmaster(ev, src);
        if (m) out.push(m);
      }
      if (!data.page || page + 1 >= data.page.totalPages) break;
    }
  }
  return out;
}
