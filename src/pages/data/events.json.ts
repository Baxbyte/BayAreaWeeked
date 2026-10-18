// Public, documented feed of upcoming events. Powers the V2 personalized daily email (see docs/V2-EMAIL.md).
import { EVENTS, ACTIVITIES, DATA } from '../../lib/data.mjs';
import { absolute } from '../../lib/site.mjs';

export function GET() {
  const strip = (i) => ({
    id: i.id, type: i.type, title: i.title, url: absolute(i.path), sourceUrl: i.url, ticketUrl: i.ticketUrl, image: i.image,
    start: i.start, end: i.end, allDay: i.allDay, schedule: i.schedule, description: i.description,
    venue: i.venue, city: i.city, region: i.region, neighborhood: i.neighborhood, categories: i.categories, flags: i.flags,
    priceText: i.priceText, priceMin: i.priceMin, sponsored: !!i.sponsor, deal: i.sponsor?.deal || null, firstSeen: i.firstSeen,
  });
  return new Response(JSON.stringify({ generatedAt: DATA.generatedAt, events: EVENTS.map(strip), activities: ACTIVITIES.map(strip) }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
