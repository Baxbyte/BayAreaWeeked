// Client-side card rendering + filtering shared by Explore, Plan and Spin.
import { CITIES, NEIGHBORHOODS, haversineKm } from '../lib/geo.mjs';
import { categoryBySlug } from '../lib/taxonomy.mjs';
import { addPTDays, formatWhen, overlaps, ptStartOfDay, ptWeekday, windows } from '../lib/time.mjs';

const cityName = Object.fromEntries(CITIES.map((c) => [c.slug, c.name]));
const hoodName = Object.fromEntries(NEIGHBORHOODS.map((n) => [n.slug, n.name]));
const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let indexPromise;
export function loadIndex() {
  const base = document.body.dataset.base || '/';
  indexPromise ||= fetch(`${base}data/search.json`).then((r) => r.json()).then((d) => d.items);
  return indexPromise;
}

export const has = (i, f) => i.f.includes(f);
const VIBE_FLAG = { 'kid-friendly': 'k', nightlife: 'n', free: 'f', 'hot-day': 'h', 'rainy-day': 'r', 'fog-escape': 'g', 'date-night': 'd', 'near-bart': 'b' };

export function whenWindow(when, now = new Date()) {
  if (!when || when === 'any') return null;
  const w = windows(now);
  if (when === 'today') return w.today;
  if (when === 'tonight') return w.tonight;
  if (when === 'tomorrow') return w.tomorrow;
  if (when === 'weekend') return w.weekend;
  if (when === 'next-week') return w.nextWeek;
  if (when === 'next-weekend') return w.nextWeekend;
  if (when === 'week') return { start: w.today.start, end: addPTDays(w.today.start, 7) };
  if (when.startsWith('day:')) {
    const target = +when.slice(4);
    const diff = (target - ptWeekday(now) + 7) % 7;
    const start = addPTDays(ptStartOfDay(now), diff);
    return { start, end: addPTDays(start, 1) };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(when)) {
    const [y, m, d] = when.split('-').map(Number);
    const start = ptStartOfDay(new Date(Date.UTC(y, m - 1, d, 12)));
    return { start, end: addPTDays(start, 1) };
  }
  return null;
}

/** state: { when, region, city, hood, cats[], vibes[], maxPrice, includeActivities, textIds:Set|null } */
export function applyFilters(items, st) {
  const win = whenWindow(st.when);
  return items.filter((i) => {
    if (i.ty === 'a') {
      if (!st.includeActivities) return false;
    } else if (win && !overlaps({ start: i.s, end: i.e }, win)) return false;
    if (st.region && i.r !== st.region) return false;
    if (st.city && i.c !== st.city) return false;
    if (st.hood && i.n !== st.hood) return false;
    if (st.cats?.length && !st.cats.some((c) => i.cat.includes(c))) return false;
    for (const v of st.vibes || []) if (!has(i, VIBE_FLAG[v])) return false;
    if (st.adultOnly && !has(i, 'n')) return false;
    if (st.maxPrice != null && !(has(i, 'f') || (i.pm != null && i.pm <= st.maxPrice))) return false;
    if (st.textIds && !st.textIds.has(i.id)) return false;
    return true;
  });
}

export function sortItems(list, mode, origin) {
  const byDate = (a, b) => (a.ty === b.ty ? (a.s || '').localeCompare(b.s || '') : a.ty === 'e' ? -1 : 1);
  const arr = [...list];
  if (mode === 'near' && origin) {
    arr.forEach((i) => { i._km = haversineKm(origin.lat, origin.lng, i.la, i.lo); });
    arr.sort((a, b) => a._km - b._km);
  } else if (mode === 'picks') {
    const q = (i) => (i.img ? 3 : 0) + (i.d.length > 80 ? 1 : 0) + (has(i, 'f') ? 0.5 : 0);
    arr.sort((a, b) => q(b) - q(a) || byDate(a, b));
  } else arr.sort(byDate);
  // Sponsored placements float to the top (highest bid first), clearly labeled.
  const sp = arr.filter((i) => i.sp > 0).sort((a, b) => b.sp - a.sp).slice(0, 3);
  return [...sp, ...arr.filter((i) => !sp.includes(i))];
}

function pill(i) {
  if (!i.s) return '';
  const d = new Date(i.s);
  const f = (o) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', ...o }).format(d);
  return `<div class="date-pill"><small>${f({ weekday: 'short' })}</small><b>${f({ day: 'numeric' })}</b><small>${f({ month: 'short' })}</small></div>`;
}

export function placeOf(i) {
  const where = i.n ? (i.c === 'san-francisco' ? `${hoodName[i.n]}, SF` : `${hoodName[i.n]}, ${cityName[i.c]}`) : cityName[i.c];
  return [i.v, where].filter(Boolean).filter((v, k, a) => a.indexOf(v) === k).join(' · ');
}

function tags(i) {
  const t = [];
  if (i.sp) t.push(['sponsored', '★ Sponsored']);
  if (has(i, 'f')) t.push(['free', 'Free']);
  if (has(i, 'k')) t.push(['kids', '👶 Kid-friendly']);
  if (has(i, 'a')) t.push(['night', '21+']); else if (has(i, 'n')) t.push(['night', '🍸 Nightlife']);
  if (has(i, 'b')) t.push(['bart', '🚇 BART']);
  if (t.length < 3 && has(i, 'r')) t.push(['rainy', '☔ Rainy-day']);
  if (t.length < 3 && has(i, 'h')) t.push(['hot', '☀️ Hot-day']);
  if (t.length < 3 && i.p && !has(i, 'f')) t.push(['', i.p.length > 18 ? `${i.p.slice(0, 16)}…` : i.p]);
  if (i._km != null) t.push(['', `${i._km < 1 ? (i._km * 1000).toFixed(0) + ' m' : i._km.toFixed(1) + ' km'} away`]);
  return t.slice(0, 4).map(([c, l]) => `<span class="tag ${c}">${escHtml(l)}</span>`).join('');
}

export function cardHTML(i) {
  const cat = categoryBySlug[i.cat[0]] || categoryBySlug.community;
  const save = escHtml(JSON.stringify({ id: i.id, t: i.t, u: i.u, s: i.s, c: i.c, img: i.img }));
  const when = i.s ? formatWhen({ start: i.s, end: i.e, allDay: !!i.ad }) : i.sc || 'Open regularly';
  return `<article class="card${i.sp ? ' sponsored' : ''}">
    <div class="media"><div class="ph" style="--h:${cat.hue}" aria-hidden="true"><span>${escHtml(cat.name)}</span></div>${i.img ? `<img src="${escHtml(i.img)}"${i.fb ? ` data-fb="${escHtml(i.fb)}"` : ''} alt="${escHtml(i.t)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="if(this.dataset.fb&&this.src!==this.dataset.fb){this.src=this.dataset.fb}else{this.remove()}">` : ''}${pill(i)}
      <button class="save-btn" type="button" data-save="${save}" aria-pressed="false" aria-label="Save ${escHtml(i.t)}"><svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.4 5 7 5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.6 0 5.8 3.6 4.5 6.8C19.5 16.4 12 21 12 21z"/></svg></button>
    </div>
    <div class="body"><h3><a href="${escHtml(i.u)}">${escHtml(i.t)}</a></h3>
      <div class="meta"><span>${escHtml(when)}</span><span>${escHtml(placeOf(i))}</span></div>
      ${i.deal ? `<div class="deal">🎟️ ${escHtml(i.deal)}</div>` : ''}
      <div class="tags">${tags(i)}</div></div></article>`;
}

export { escHtml };
