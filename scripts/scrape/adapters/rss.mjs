// RSS/Atom adapter for event blogs and calendars that publish feeds.
import { XMLParser } from 'fast-xml-parser';
import { fetchText } from '../http.mjs';
import { guessYear, isoDate, isoLocal, monthIndex, parseClock } from './util.mjs';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#text', cdataPropName: '#cdata' });

const txt = (v) => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return txt(v[0]);
  return v['#cdata'] ?? v['#text'] ?? '';
};

export function parseFeed(xml) {
  const doc = parser.parse(xml);
  const items = doc?.rss?.channel?.item || doc?.feed?.entry || doc?.['rdf:RDF']?.item || [];
  return (Array.isArray(items) ? items : [items]).map((it) => {
    const link = typeof it.link === 'string' ? it.link : Array.isArray(it.link) ? (it.link.find((l) => l['@rel'] !== 'self')?.['@href'] || txt(it.link[0])) : it.link?.['@href'] || txt(it.link);
    const content = txt(it['content:encoded']) || txt(it.content) || '';
    const description = txt(it.description) || txt(it.summary) || '';
    const media = it['media:content'] || it['media:thumbnail'] || it.enclosure;
    const mediaUrl = (Array.isArray(media) ? media[0] : media)?.['@url'];
    const img = mediaUrl || (content + description).match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || null;
    const cats = [it.category].flat().filter(Boolean).map(txt);
    return {
      title: txt(it.title), link, guid: txt(it.guid) || link, content, description, image: img, categories: cats,
      pubDate: txt(it.pubDate) || txt(it.published) || txt(it.updated) || txt(it['dc:date']),
      evStart: txt(it['ev:startdate']) || txt(it['xcal:dtstart']) || txt(it['event:startdate']) || null,
      evEnd: txt(it['ev:enddate']) || txt(it['xcal:dtend']) || null,
      evLocation: txt(it['ev:location']) || txt(it['xcal:location']) || null,
    };
  });
}

// Finds a date like "Saturday, October 24" or "Oct 24, 2026 at 7pm" in free text.
export function dateFromText(s, now) {
  const m = String(s).match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?(?:[^\n\d]{0,12}?(\d{1,2}(?::\d{2})?\s*(?:am|pm)))?/i);
  if (!m) return null;
  const mo = monthIndex(m[1]);
  const d = +m[2];
  const y = m[3] ? +m[3] : guessYear(mo, d, now);
  const clock = parseClock(m[4]);
  return clock ? isoLocal(y, mo, d, clock[0], clock[1]) : isoDate(y, mo, d);
}

export async function run(src, ctx) {
  const out = [];
  for (const url of src.urls || []) {
    let xml;
    try {
      xml = await fetchText(url);
    } catch (e) {
      ctx.warn(`${src.id}: ${e.message}`);
      continue;
    }
    for (const it of parseFeed(xml)) {
      let start = it.evStart;
      if (!start && src.pubDateIsEventDate) start = it.pubDate;
      if (!start && src.dateFromText) start = dateFromText(`${it.title}\n${it.description}`, ctx.now);
      if (!start) continue;
      out.push({
        sourceId: src.id, sourceName: src.name, sourceHome: src.home,
        externalId: it.guid, title: it.title, description: it.description || it.content, url: it.link,
        image: it.image, start, end: it.evEnd,
        venueName: it.evLocation, address: it.evLocation, city: null,
        priceText: /\bfree\b/i.test(it.title) ? 'Free' : null,
        tags: it.categories,
      });
    }
  }
  return out;
}
