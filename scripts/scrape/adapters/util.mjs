import { addPTDays, ptParts } from '../../../src/lib/time.mjs';

const pad = (n) => String(n).padStart(2, '0');

/**
 * Source URLs can be a list (`urls`) and/or a template (`urlTemplate`) expanded over the next `days` days.
 * Template tokens: {yyyy} {mm} {dd} {m} {d} {page}
 */
export function expandUrls(src, now = new Date()) {
  const urls = [...(src.urls || [])];
  if (src.urlTemplate) {
    for (let i = 0; i < (src.days || 7); i++) {
      const p = ptParts(addPTDays(now, i));
      urls.push(src.urlTemplate.replace('{yyyy}', p.y).replace('{mm}', pad(p.m)).replace('{dd}', pad(p.d)).replace('{m}', p.m).replace('{d}', p.d));
    }
  }
  if (src.pages && src.pages > 1) {
    const base = [...urls];
    for (const u of base) {
      if (!u.includes('{page}')) continue;
      for (let pg = 2; pg <= src.pages; pg++) urls.push(u.replace('{page}', pg));
    }
  }
  return [...new Set(urls.map((u) => u.replace('{page}', '1')))];
}

export const monthIndex = (s) => ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(String(s).slice(0, 3).toLowerCase()) + 1;

/** Parse "9pm", "9:30 PM", "21:00" into [h, m]. */
export function parseClock(s) {
  const m = String(s || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?/i);
  if (!m) return null;
  let h = +m[1];
  const mi = +(m[2] || 0);
  const ap = (m[3] || '').toLowerCase();
  if (ap.startsWith('p') && h < 12) h += 12;
  if (ap.startsWith('a') && h === 12) h = 0;
  if (h > 23 || mi > 59) return null;
  return [h, mi];
}

/** Guess the year for a month/day that has no year, assuming it's within the next ~10 months. */
export function guessYear(month, day, now = new Date()) {
  const p = ptParts(now);
  const thisYear = new Date(Date.UTC(p.y, month - 1, day));
  const today = new Date(Date.UTC(p.y, p.m - 1, p.d));
  return thisYear < today - 60 * 86400000 ? p.y + 1 : p.y;
}

export const isoLocal = (y, m, d, h = 0, mi = 0) => `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(mi)}`;
export const isoDate = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
