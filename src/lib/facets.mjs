// Facet (sub-page) helpers: which vibe/genre/neighborhood pages exist for a place.
import { ACTIVITIES, EVENTS, filterItems } from './data.mjs';
import { CATEGORIES, VIBES } from './taxonomy.mjs';
import { NEIGHBORHOODS } from './geo.mjs';

const pool = () => [...EVENTS, ...ACTIVITIES];
const vibeSlugs = new Set(VIBES.map((v) => v.slug));

/** Facet definitions with counts for a base filter. kind: vibe | category | hood */
export function facetDefs(base, { includeHoods = false, min = 1 } = {}) {
  const out = [];
  for (const v of VIBES) {
    const n = filterItems(pool(), { ...base, vibe: v.slug }).length;
    if (n >= min) out.push({ kind: 'vibe', slug: v.slug, label: `${v.emoji} ${v.name}`, name: v.name, n, def: v });
  }
  for (const c of CATEGORIES) {
    if (vibeSlugs.has(c.slug)) continue;
    const n = filterItems(pool(), { ...base, category: c.slug }).length;
    if (n >= min) out.push({ kind: 'category', slug: c.slug, label: `${c.emoji} ${c.name}`, name: c.name, n, def: c });
  }
  if (includeHoods && base.city) {
    for (const h of NEIGHBORHOODS.filter((x) => x.city === base.city)) {
      const n = filterItems(pool(), { ...base, hood: h.slug }).length;
      if (n >= min) out.push({ kind: 'hood', slug: h.slug, label: `📍 ${h.name}`, name: h.name, n, def: h });
    }
  }
  return out;
}

export const facetFilter = (f) => (f.kind === 'vibe' ? { vibe: f.slug } : f.kind === 'category' ? { category: f.slug } : { hood: f.slug });
export const facetQuery = (f) => (f.kind === 'vibe' ? `vibe=${f.slug}` : f.kind === 'category' ? `cat=${f.slug}` : `hood=${f.slug}`);
