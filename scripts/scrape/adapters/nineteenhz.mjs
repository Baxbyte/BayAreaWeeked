// 19hz.info — the long-running community listing of Bay Area electronic music & nightlife events.
import * as cheerio from 'cheerio';
import { fetchText } from '../http.mjs';
import { guessYear, isoDate, isoLocal, monthIndex, parseClock } from './util.mjs';

export function parse19hz(html, src, now) {
  const $ = cheerio.load(html);
  const out = [];
  $('table tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 4) return;
    const cell = (i) => $(tds[i]).text().replace(/\s+/g, ' ').trim();
    const whenText = cell(0);
    // Prefer a hidden sortable yyyy/mm/dd column if present.
    let y, mo, d;
    const hidden = tds.toArray().map((td) => $(td).text()).find((t) => /^\s*\d{4}\/\d{2}\/\d{2}\s*$/.test(t));
    if (hidden) [y, mo, d] = hidden.trim().split('/').map(Number);
    else {
      const m = whenText.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})/i);
      if (!m) return;
      mo = monthIndex(m[1]); d = +m[2]; y = guessYear(mo, d, now);
    }
    const timeM = whenText.match(/\(([^)]+)\)/);
    const startClock = timeM ? parseClock(timeM[1].split('-')[0]) : null;
    let endIso = null;
    if (timeM && timeM[1].includes('-')) {
      const ec = parseClock(timeM[1].split('-')[1]);
      if (ec && startClock) {
        const endDay = ec[0] < startClock[0] ? new Date(Date.UTC(y, mo - 1, d + 1)) : new Date(Date.UTC(y, mo - 1, d));
        endIso = isoLocal(endDay.getUTCFullYear(), endDay.getUTCMonth() + 1, endDay.getUTCDate(), ec[0], ec[1]);
      }
    }
    const titleCell = $(tds[1]);
    const link = titleCell.find('a').first().attr('href') || null;
    const full = titleCell.text().replace(/\s+/g, ' ').trim();
    const [titlePart, ...rest] = full.split(' @ ');
    const venueRaw = rest.join(' @ ');
    const cityM = venueRaw.match(/\(([^)]+)\)\s*$/);
    const venueName = venueRaw.replace(/\([^)]*\)\s*$/, '').trim();
    const tags = cell(2).split(/[,/]/).map((t) => t.trim()).filter(Boolean);
    const priceAge = cell(3);
    const [priceText, ageText] = priceAge.split('|').map((s) => s.trim());
    if (!titlePart) return;
    out.push({
      sourceId: src.id, sourceName: src.name, sourceHome: src.home,
      externalId: `${y}-${mo}-${d}:${titlePart}`,
      title: titlePart,
      description: `${tags.join(', ')}${tags.length ? ' · ' : ''}${venueName}${ageText ? ` · ${ageText}` : ''}${cell(4) ? ` · Presented by ${cell(4)}` : ''}`,
      url: link, ticketUrl: link,
      start: startClock ? isoLocal(y, mo, d, startClock[0], startClock[1]) : isoDate(y, mo, d),
      end: endIso,
      venueName, address: cityM ? `${venueName}, ${cityM[1]}` : venueName, city: cityM ? cityM[1] : null,
      priceText: priceText || null,
      tags: [...tags, ageText].filter(Boolean),
      forceCategories: ['nightlife'],
      forceFlags: { nightlife: true, kids: false, ...(/21|18/.test(ageText || '') ? { adult: true } : {}) },
    });
  });
  return out;
}

export async function run(src, ctx) {
  const html = await fetchText(src.url);
  return parse19hz(html, src, ctx.now).filter((e) => {
    const t = Date.parse(e.start);
    return !Number.isNaN(t) ? t < ctx.now.getTime() + (src.days || 21) * 86400000 : true;
  });
}
