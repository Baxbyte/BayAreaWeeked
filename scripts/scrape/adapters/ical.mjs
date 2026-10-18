// iCalendar (.ics) adapter — libraries, parks departments, universities and venues often publish these.
import ical from 'node-ical';
import { fetchText } from '../http.mjs';

export function eventsFromIcs(text, src, now, horizonDays = 30) {
  const data = ical.sync.parseICS(text);
  const from = new Date(now.getTime() - 86400000);
  const to = new Date(now.getTime() + horizonDays * 86400000);
  const out = [];
  for (const ev of Object.values(data)) {
    if (ev.type !== 'VEVENT' || !ev.start) continue;
    const dur = ev.end ? ev.end - ev.start : 2 * 3600000;
    const allDay = ev.datetype === 'date';
    const starts = ev.rrule ? ev.rrule.between(from, to, true).slice(0, 10) : [ev.start];
    for (const s of starts) {
      if (s < from || s > to) continue;
      const geo = ev.geo || {};
      out.push({
        sourceId: src.id, sourceName: src.name, sourceHome: src.home,
        externalId: `${ev.uid || ev.summary}:${+s}`,
        title: typeof ev.summary === 'object' ? ev.summary.val : ev.summary,
        description: typeof ev.description === 'object' ? ev.description.val : ev.description,
        url: (typeof ev.url === 'object' ? ev.url?.val : ev.url) || src.home,
        start: allDay ? s.toISOString().slice(0, 10) : s.toISOString(),
        end: allDay ? null : new Date(+s + dur).toISOString(),
        allDay,
        venueName: typeof ev.location === 'object' ? ev.location.val : ev.location,
        address: typeof ev.location === 'object' ? ev.location.val : ev.location,
        lat: geo.lat ?? null, lng: geo.lon ?? null,
        tags: [ev.categories].flat().filter(Boolean).map(String),
      });
    }
  }
  return out;
}

export async function run(src, ctx) {
  const out = [];
  for (const url of src.urls || []) {
    try {
      out.push(...eventsFromIcs(await fetchText(url), src, ctx.now, src.days || 30));
    } catch (e) {
      ctx.warn(`${src.id}: ${e.message}`);
    }
  }
  return out;
}
