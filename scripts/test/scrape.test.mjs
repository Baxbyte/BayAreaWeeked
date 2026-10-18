import assert from 'node:assert/strict';
import test from 'node:test';
import { collectJsonLd, findEvents, mapJsonLdEvent } from '../scrape/adapters/jsonld.mjs';
import { parseFeed, dateFromText } from '../scrape/adapters/rss.mjs';
import { eventsFromIcs } from '../scrape/adapters/ical.mjs';
import { mapLocalist } from '../scrape/adapters/localist.mjs';
import { mapTicketmaster } from '../scrape/adapters/ticketmaster.mjs';
import { mapSeatGeek } from '../scrape/adapters/seatgeek.mjs';
import { parse19hz } from '../scrape/adapters/nineteenhz.mjs';
import { mergeDuplicates, normalize, parsePrice, slugify } from '../scrape/normalize.mjs';
import { expandUrls } from '../scrape/adapters/util.mjs';
import { windows, toPTISO } from '../../src/lib/time.mjs';

const NOW = new Date('2026-10-20T17:00:00Z'); // Tue Oct 20, 10am PT
const src = { id: 'test', name: 'Test', home: 'https://example.org' };

test('JSON-LD: finds events inside ItemList and @graph', () => {
  const html = `<html><head>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"ItemList","itemListElement":[
    {"@type":"ListItem","position":1,"item":{"@type":"MusicEvent","name":"Jazz on the Lake","startDate":"2026-10-24T19:30:00-07:00","endDate":"2026-10-24T22:00:00-07:00",
      "url":"https://example.org/e/1","image":["https://img.example.org/1.jpg"],"description":"Live <b>jazz</b> trio by Lake Merritt.",
      "location":{"@type":"Place","name":"The Lakeside Lounge","address":{"@type":"PostalAddress","streetAddress":"100 Grand Ave","addressLocality":"Oakland","addressRegion":"CA"},
      "geo":{"@type":"GeoCoordinates","latitude":37.8105,"longitude":-122.2592}},"offers":{"@type":"Offer","price":"15","priceCurrency":"USD","url":"https://tix.example.org/1"}}},
    {"@type":"ListItem","position":2,"item":{"@type":"Event","name":"Online Webinar","startDate":"2026-10-24","eventAttendanceMode":"https://schema.org/OnlineEventAttendanceMode"}}
  ]}</script>
  <script type="application/ld+json">{"@graph":[{"@type":"Event","name":"Kids Pumpkin Patch Day","startDate":"2026-10-25","isAccessibleForFree":true,
    "location":{"@type":"Place","name":"Ardenwood Farm","address":"34600 Ardenwood Blvd, Fremont, CA"}},]}</script>
  </head></html>`;
  const events = findEvents(collectJsonLd(html));
  assert.equal(events.length, 3);
  const mapped = events.map((e) => mapJsonLdEvent(e, src, 'https://example.org/list')).filter(Boolean);
  assert.equal(mapped.length, 2, 'online event dropped');
  const jazz = normalize(mapped[0]);
  assert.equal(jazz.city, 'oakland');
  assert.equal(jazz.region, 'east-bay');
  assert.equal(jazz.neighborhood, 'lake-merritt');
  assert.equal(jazz.priceMin, 15);
  assert.equal(jazz.start, '2026-10-24T19:30:00-07:00');
  assert.ok(jazz.categories.includes('live-music'));
  assert.equal(jazz.description, 'Live jazz trio by Lake Merritt.');
  const kids = normalize(mapped[1]);
  assert.equal(kids.city, 'fremont');
  assert.equal(kids.flags.free, true);
  assert.equal(kids.flags.kids, true);
  assert.equal(kids.allDay, true);
  assert.equal(kids.venue.approx, true);
});

test('RSS: parses items, images and event dates', () => {
  const xml = `<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
    <item><title>Free Outdoor Movie Night in Dolores Park (SF)</title><link>https://sf.example.org/movie</link>
    <pubDate>Sat, 24 Oct 2026 19:00:00 -0700</pubDate><category>Film</category>
    <description><![CDATA[<p>Bring a blanket! <img src="https://img.example.org/m.jpg"/></p>]]></description></item>
  </channel></rss>`;
  const items = parseFeed(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].image, 'https://img.example.org/m.jpg');
  const ev = normalize({ sourceId: 'rss', sourceName: 'RSS', title: items[0].title, description: items[0].description, url: items[0].link, start: items[0].pubDate, tags: items[0].categories });
  assert.equal(ev.city, 'san-francisco');
  assert.equal(ev.neighborhood, 'mission-district');
  assert.equal(ev.flags.free, true);
  assert.ok(ev.categories.includes('film'));
  assert.equal(ev.start, '2026-10-24T19:00:00-07:00');
  assert.equal(dateFromText('Join us Saturday, October 24 at 7:30pm', NOW), '2026-10-24T19:30');
  assert.equal(dateFromText('Jan 3', NOW), '2027-01-03');
});

test('iCal: expands single and recurring events', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1@example
DTSTART:20261024T170000Z
DTEND:20261024T190000Z
SUMMARY:Toddler Storytime
LOCATION:Berkeley Public Library\\, 2090 Kittredge St\\, Berkeley\\, CA
END:VEVENT
BEGIN:VEVENT
UID:2@example
DTSTART:20261021T020000Z
DTEND:20261021T040000Z
RRULE:FREQ=WEEKLY;COUNT=4
SUMMARY:Trivia Night 21+
LOCATION:The Pub, Oakland, CA
END:VEVENT
END:VCALENDAR`;
  const evs = eventsFromIcs(ics, src, NOW, 30);
  assert.equal(evs.filter((e) => e.title === 'Toddler Storytime').length, 1);
  assert.equal(evs.filter((e) => e.title.startsWith('Trivia')).length, 4);
  const story = normalize(evs[0]);
  assert.equal(story.city, 'berkeley');
  assert.equal(story.flags.kids, true);
  assert.equal(story.flags.rainy, true);
  const trivia = normalize(evs.find((e) => e.title.startsWith('Trivia')));
  assert.equal(trivia.flags.adult, true);
  assert.equal(trivia.flags.nightlife, true);
  assert.equal(trivia.flags.kids, false);
});

test('Localist, Ticketmaster and SeatGeek mapping', () => {
  const lo = normalize(mapLocalist({ id: 9, title: 'Stanford Jazz Orchestra', description_text: 'Free concert.', localist_url: 'https://events.stanford.edu/e/9',
    location_name: 'Bing Concert Hall', geo: { latitude: '37.4291', longitude: '-122.1658', city: 'Stanford' }, free: true,
    event_instances: [{ event_instance: { start: '2026-10-23T19:30:00-07:00', end: null, all_day: false } }], filters: { event_types: [{ name: 'Concert/Music' }] } }, src));
  assert.equal(lo.city, 'palo-alto');
  assert.equal(lo.region, 'peninsula');
  assert.equal(lo.flags.free, true);

  const tm = normalize(mapTicketmaster({ id: 'TM1', name: 'Golden State Warriors vs. Los Angeles Lakers', url: 'https://tm.example/1',
    images: [{ url: 'https://img/16.jpg', ratio: '16_9', width: 1024 }], dates: { start: { localDate: '2026-10-27', localTime: '19:00:00' } },
    classifications: [{ segment: { name: 'Sports' }, genre: { name: 'Basketball' } }], priceRanges: [{ min: 89, max: 900 }],
    _embedded: { venues: [{ name: 'Chase Center', city: { name: 'San Francisco' }, address: { line1: '1 Warriors Way' }, location: { latitude: '37.768', longitude: '-122.3877' } }] } }, src));
  assert.equal(tm.neighborhood, 'mission-bay');
  assert.equal(tm.categories[0], 'sports');
  assert.equal(tm.priceMin, 89);
  assert.equal(tm.start, '2026-10-27T19:00:00-07:00');

  const sg = normalize(mapSeatGeek({ id: 5, title: 'Comedy Night', url: 'https://sg/5', datetime_local: '2026-10-24T20:00:00',
    venue: { name: 'Cobb’s', city: 'San Jose', location: { lat: 37.33, lon: -121.89 } }, performers: [{ image: 'https://img/p.jpg' }], taxonomies: [{ name: 'comedy' }], stats: { lowest_price: 30 } }, src));
  assert.equal(sg.city, 'san-jose');
  assert.ok(sg.categories.includes('comedy'));
});

test('19hz table parsing', () => {
  const html = `<table><tr><th>Date</th><th>Event</th></tr>
  <tr><td>Sat: Oct 24 (10pm-4am)</td><td><a href="https://ra.example/1">Deep Space Disco</a> @ Monarch (San Francisco)</td><td>house, disco</td><td>$20 | 21+</td><td>Some Crew</td><td></td><td>2026/10/24</td></tr>
  </table>`;
  const evs = parse19hz(html, src, NOW);
  assert.equal(evs.length, 1);
  const e = normalize(evs[0]);
  assert.equal(e.title, 'Deep Space Disco');
  assert.equal(e.start, '2026-10-24T22:00:00-07:00');
  assert.equal(e.end, '2026-10-25T04:00:00-07:00');
  assert.equal(e.flags.nightlife, true);
  assert.equal(e.flags.adult, true);
  assert.equal(e.priceMin, 20);
});

test('normalize drops non-Bay-Area and dedupes across sources', () => {
  assert.equal(normalize({ sourceId: 'x', title: 'LA Show', start: '2026-10-24T20:00', city: 'Los Angeles', lat: 34.05, lng: -118.24 }), null);
  const a = normalize({ sourceId: 'a', title: 'The Lumineers', start: '2026-10-24T20:00', venueName: 'Greek Theatre', city: 'Berkeley' });
  const b = normalize({ sourceId: 'b', title: 'The Lumineers - Live', start: '2026-10-24T19:30', venueName: 'Greek Theatre', city: 'Berkeley', image: 'https://img/x.jpg', lat: 37.8738, lng: -122.2545 });
  const merged = mergeDuplicates([a, b]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].sources.length, 2);
  assert.ok(merged[0].image);
});

test('helpers', () => {
  assert.equal(slugify('Día de los Muertos @ 24th St & Mission!'), 'dia-de-los-muertos-24th-st-and-mission');
  assert.deepEqual(parsePrice('$15 - $25'), { priceMin: 15, priceMax: 25 });
  assert.deepEqual(parsePrice('Free (RSVP)'), { priceMin: 0, priceMax: 0 });
  assert.equal(expandUrls({ urlTemplate: 'https://x/{yyyy}/{mm}/{dd}', days: 2 }, NOW).join(' '), 'https://x/2026/10/20 https://x/2026/10/21');
  const w = windows(NOW);
  assert.equal(toPTISO(w.weekend.start), '2026-10-23T17:00:00-07:00');
  assert.equal(toPTISO(w.nextWeek.start), '2026-10-26T00:00:00-07:00');
});
