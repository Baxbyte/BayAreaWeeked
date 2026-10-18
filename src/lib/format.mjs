// Small display helpers shared by components.
import { categoryBySlug } from './taxonomy.mjs';
import { cityBySlug, hoodBySlug } from './geo.mjs';
import { formatWhen, fmtMonthDay, TZ } from './time.mjs';
import { photoFor } from './images.mjs';

export const primaryCat = (i) => categoryBySlug[i.categories?.[0]] || categoryBySlug.community;
export const emojiFor = (i) => primaryCat(i).emoji;
export const hueFor = (i) => primaryCat(i).hue;

export function datePill(i) {
  if (!i.start) return null;
  const d = new Date(i.start);
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d);
  const md = fmtMonthDay.format(d);
  return { wd, day: md.split(' ')[1], mon: md.split(' ')[0] };
}

export function placeLine(i) {
  const city = cityBySlug[i.city]?.name;
  const hood = i.neighborhood ? hoodBySlug[i.neighborhood]?.name : null;
  const where = hood && i.city === 'san-francisco' ? `${hood}, SF` : hood ? `${hood}, ${city}` : city;
  return [i.venue?.name, where].filter(Boolean).filter((v, idx, a) => a.indexOf(v) === idx).join(' · ');
}

export function tagsFor(i, max = 3) {
  const t = [];
  if (i.sponsor) t.push(['sponsored', '★ Sponsored']);
  if (i.flags.free) t.push(['free', 'Free']);
  if (i.flags.kids) t.push(['kids', '👶 Kid-friendly']);
  if (i.flags.adult) t.push(['night', '21+']);
  else if (i.flags.nightlife) t.push(['night', '🍸 Nightlife']);
  if (i.flags.bart) t.push(['bart', '🚇 BART']);
  if (i.flags.rainy && t.length < max) t.push(['rainy', '☔ Rainy-day']);
  if (i.flags.hot && t.length < max) t.push(['hot', '☀️ Hot-day']);
  if (t.length < max && i.priceText && !i.flags.free) t.push(['', i.priceText.length > 18 ? i.priceText.slice(0, 16) + '…' : i.priceText]);
  return t.slice(0, max + (i.sponsor ? 1 : 0));
}

export { formatWhen };

/** Compact record for client-side search, map and plan features. */
export function toIndexRecord(i, linkFn) {
  const f = i.flags;
  const ph = photoFor(i);
  return {
    id: i.id, t: i.title, u: linkFn(i.path), ty: i.type === 'activity' ? 'a' : 'e',
    s: i.start || null, e: i.end || null, ad: i.allDay ? 1 : 0, sc: i.schedule || null,
    c: i.city, r: i.region, n: i.neighborhood || null, cat: i.categories,
    v: i.venue?.name || null, la: i.venue?.lat, lo: i.venue?.lng,
    img: ph?.srcSmall || null, fb: ph?.fallback?.srcSmall || null, p: i.priceText || null, pm: i.priceMin,
    d: (i.description || '').slice(0, 160),
    f: [f.kids && 'k', f.nightlife && 'n', f.adult && 'a', f.free && 'f', f.hot && 'h', f.rainy && 'r', f.fog && 'g', f.date && 'd', f.bart && 'b'].filter(Boolean).join(''),
    bart: f.bart || null,
    sp: i.sponsor ? i.sponsor.bid : 0,
    deal: i.sponsor?.deal?.headline || null,
    tg: (i.sourceTags || []).slice(0, 6).join(', '),
  };
}
