// Pacific-time helpers shared by the scraper and the site.
export const TZ = 'America/Los_Angeles';

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short',
});

/** Wall-clock parts of a Date in Pacific time. */
export function ptParts(date) {
  const o = {};
  for (const p of partsFmt.formatToParts(date)) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour, mi: +o.minute, s: +o.second, wd: o.weekday };
}

/** Offset in minutes of Pacific time from UTC at a given instant (e.g. -420 in summer). */
export function ptOffsetMinutes(date) {
  const p = ptParts(date);
  const asUTC = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Build a Date from Pacific wall-clock values. */
export function fromPT(y, m, d, h = 0, mi = 0) {
  // First guess assumes UTC-8, then correct using the real offset at that instant.
  const guess = new Date(Date.UTC(y, m - 1, d, h, mi) + 8 * 3600000);
  let t = Date.UTC(y, m - 1, d, h, mi) - ptOffsetMinutes(guess) * 60000;
  const off2 = ptOffsetMinutes(new Date(t));
  t = Date.UTC(y, m - 1, d, h, mi) - off2 * 60000;
  return new Date(t);
}

const pad = (n) => String(n).padStart(2, '0');

/** ISO 8601 string with Pacific offset, e.g. 2026-10-24T19:00:00-07:00 */
export function toPTISO(date) {
  const p = ptParts(date);
  const off = ptOffsetMinutes(date);
  const sign = off <= 0 ? '-' : '+';
  const a = Math.abs(off);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}:00${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/** YYYY-MM-DD of an instant in Pacific time. */
export function ptDateKey(date) {
  const p = ptParts(date);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/**
 * Parse many date formats into a Date.
 * - With Z/offset: absolute.
 * - "YYYY-MM-DDTHH:mm[:ss]" without offset: Pacific wall-clock.
 * - "YYYY-MM-DD": Pacific midnight, allDay=true.
 */
export function parseWhen(input) {
  if (input == null || input === '') return null;
  if (input instanceof Date) return Number.isNaN(+input) ? null : { date: input, allDay: false };
  const s = String(input).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return { date: fromPT(+m[1], +m[2], +m[3], 0, 0), allDay: true };
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
  if (m) return { date: fromPT(+m[1], +m[2], +m[3], +m[4], +m[5]), allDay: false };
  const d = new Date(s);
  if (!Number.isNaN(+d)) return { date: d, allDay: false };
  return null;
}

export const DAY_MS = 86400000;

/** Start (00:00 PT) of the Pacific day containing `date`. */
export function ptStartOfDay(date) {
  const p = ptParts(date);
  return fromPT(p.y, p.m, p.d, 0, 0);
}

export function addPTDays(date, n) {
  const p = ptParts(date);
  const base = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return fromPT(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), 0, 0);
}

const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function ptWeekday(date) {
  return WD[ptParts(date).wd];
}

/**
 * Useful date windows relative to `now`.
 * Weekend = Friday 5pm → Monday 00:00. If it's already the weekend, it's the current one.
 */
export function windows(now = new Date()) {
  const today = ptStartOfDay(now);
  const wd = ptWeekday(now);
  const tomorrow = addPTDays(today, 1);
  // Friday of this week (or of the current weekend)
  const daysToFri = wd === 0 ? -2 : wd === 6 ? -1 : 5 - wd;
  const fri = addPTDays(today, daysToFri);
  const friEve = new Date(fri.getTime() + 17 * 3600000);
  const weekendEnd = addPTDays(fri, 3);
  const nextMon = addPTDays(today, wd === 0 ? 1 : 8 - wd);
  const nextSun = addPTDays(nextMon, 7);
  const nextFri = addPTDays(fri, 7);
  const tonightStart = new Date(Math.max(now.getTime() - 2 * 3600000, today.getTime() + 17 * 3600000));
  return {
    now,
    today: { start: today, end: tomorrow },
    tonight: { start: tonightStart, end: new Date(tomorrow.getTime() + 4 * 3600000) },
    tomorrow: { start: tomorrow, end: addPTDays(today, 2) },
    weekend: { start: friEve < now ? now : friEve, end: weekendEnd, fri, sat: addPTDays(fri, 1), sun: addPTDays(fri, 2) },
    nextWeek: { start: nextMon, end: nextSun },
    nextWeekend: { start: new Date(nextFri.getTime() + 17 * 3600000), end: addPTDays(nextFri, 3), fri: nextFri },
    next30: { start: today, end: addPTDays(today, 30) },
  };
}

export function overlaps(item, win) {
  if (!item.start) return false;
  const s = new Date(item.start).getTime();
  const e = item.end ? new Date(item.end).getTime() : s + 3 * 3600000;
  return s < win.end.getTime() && e > win.start.getTime();
}

const fmt = (opts) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...opts });
export const fmtDay = fmt({ weekday: 'short', month: 'short', day: 'numeric' });
export const fmtLongDay = fmt({ weekday: 'long', month: 'long', day: 'numeric' });
export const fmtMonthDay = fmt({ month: 'short', day: 'numeric' });
export const fmtTime = fmt({ hour: 'numeric', minute: '2-digit' });
export const fmtWeekday = fmt({ weekday: 'long' });

export function formatRange(a, b) {
  const sa = fmtMonthDay.format(a);
  const sb = fmtMonthDay.format(new Date(b.getTime() - 1));
  if (sa === sb) return sa;
  const [ma] = sa.split(' ');
  const [mb, db] = sb.split(' ');
  return ma === mb ? `${sa}–${db}` : `${sa}–${mb} ${db}`;
}

export function formatWhen(item) {
  if (!item.start) return item.schedule || 'Open regularly';
  const s = new Date(item.start);
  if (item.allDay) {
    if (item.end) {
      const e = new Date(item.end);
      if (e - s > DAY_MS + 3600000) return `${fmtDay.format(s)} – ${fmtDay.format(new Date(e.getTime() - 1))}`;
    }
    return `${fmtDay.format(s)} · All day`;
  }
  return `${fmtDay.format(s)} · ${fmtTime.format(s).replace(':00', '')}`;
}
