#!/usr/bin/env node
// Tests candidate event sources and reports which ones respond with usable event data.
//   node scripts/scrape/probe.mjs
import { collectJsonLd, findEvents } from './adapters/jsonld.mjs';
import { USER_AGENT } from './http.mjs';

const localist = ['events.berkeley.edu', 'events.sjsu.edu', 'calendar.ucsf.edu', 'events.scu.edu', 'events.usfca.edu', 'events.sfsu.edu', 'events.csueastbay.edu',
  'calendar.stanford.edu', 'events.mills.edu', 'events.ggu.edu', 'calendar.berkeley.edu', 'events.santaclaraca.gov', 'events.sanjoseca.gov'];
const pages = [
  'https://allevents.in/san-francisco/music', 'https://allevents.in/san-francisco/kids', 'https://allevents.in/palo-alto/all', 'https://allevents.in/walnut-creek/all',
  'https://allevents.in/santa-rosa/all', 'https://allevents.in/san-mateo/all', 'https://allevents.in/san-francisco/all?page=2',
  'https://lu.ma/sf', 'https://www.sfgate.com/events/', 'https://www.kqed.org/events', 'https://www.timeout.com/san-francisco/things-to-do/things-to-do-in-san-francisco-this-weekend',
  'https://www.berkeleyside.org/events', 'https://oaklandside.org/events/', 'https://www.sfpl.org/events', 'https://oaklandlibrary.org/events/',
  'https://www.sfrecpark.org/Calendar.aspx', 'https://www.exploratorium.edu/visit/calendar', 'https://www.calacademy.org/events', 'https://www.sfmoma.org/events/',
  'https://www.famsf.org/calendar', 'https://www.thefreight.org/shows/', 'https://www.theindependentsf.com/', 'https://www.thechapelsf.com/music/',
  'https://www.greatamericanmusichall.com/', 'https://www.bottomofthehill.com/calendar.html', 'https://www.cobbscomedy.com/events', 'https://www.punchlinecomedyclub.com/events',
  'https://www.sfjazz.org/calendar/', 'https://www.yoshis.com/calendar', 'https://www.thefoxoakland.com/events', 'https://www.paramounttheatre.com/events',
  'https://www.ebparks.org/calendar', 'https://www.openspace.org/events', 'https://www.sanjose.org/events', 'https://www.visitoakland.com/events/',
  'https://www.sftravel.com/events', 'https://www.cuesa.org/events', 'https://www.offthegrid.com/events', 'https://www.ferrybuildingmarketplace.com/events/',
  'https://www.sfsymphony.org/Calendar', 'https://www.berkeleyrep.org/season/', 'https://www.do510.com/events', 'https://www.bayareaparent.com/calendar/',
  'https://www.redwoodcity.org/departments/parks-recreation-and-community-services/events', 'https://www.mountainview.gov/our-city/news/events',
  'https://www.cityofpaloalto.org/News-Articles/Events', 'https://www.walnut-creek.org/departments/arts-recreation/events', 'https://www.sanrafael.org/events/',
];
const tribe = ['https://www.thebaylink.com', 'https://www.sfbayarea.com', 'https://www.thebold.com', 'https://sfweekly.com', 'https://www.48hills.org', 'https://www.sfweekly.com',
  'https://www.marinmommies.com', 'https://www.bayareakidfun.com', 'https://www.funcheap.com'];
const ical = ['https://events.stanford.edu/calendar.ics', 'https://www.sfpl.org/events/ical', 'https://www.ebparks.org/calendar/ical'];

async function get(url, accept = 'text/html') {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': USER_AGENT, Accept: accept } });
    const text = await res.text();
    return { status: res.status, text };
  } catch (e) {
    return { status: 0, text: '', err: e.name };
  } finally { clearTimeout(t); }
}

const rows = [];
await Promise.all([
  ...localist.map(async (host) => {
    const r = await get(`https://${host}/api/2/events?days=14&pp=10`, 'application/json');
    let n = 0; try { n = JSON.parse(r.text).events?.length || 0; } catch { /* not json */ }
    rows.push(['localist', host, r.status, n]);
  }),
  ...pages.map(async (u) => {
    const r = await get(u);
    let n = 0; try { n = findEvents(collectJsonLd(r.text)).length; } catch { /* */ }
    const tribeHint = /tribe-events|wp-json\/tribe/.test(r.text) ? ' tribe' : '';
    const ics = /\.ics["']/.test(r.text) ? ' ics' : '';
    rows.push(['jsonld', u, r.status, n, `${tribeHint}${ics}`]);
  }),
  ...tribe.map(async (site) => {
    const r = await get(`${site}/wp-json/tribe/events/v1/events?per_page=5`, 'application/json');
    let n = 0; try { n = JSON.parse(r.text).events?.length || 0; } catch { /* */ }
    rows.push(['tribe', site, r.status, n]);
  }),
  ...ical.map(async (u) => { const r = await get(u, 'text/calendar'); rows.push(['ical', u, r.status, (r.text.match(/BEGIN:VEVENT/g) || []).length]); }),
]);
rows.sort((a, b) => b[3] - a[3]);
for (const r of rows) console.log(`${String(r[3]).padStart(4)}  ${String(r[2]).padEnd(4)} ${r[0].padEnd(8)} ${r[1]}${r[4] || ''}`);
