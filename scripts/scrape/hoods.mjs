// Point-in-polygon neighborhood lookup using real boundaries (src/data/boundaries.json).
import fs from 'node:fs';
import { NEIGHBORHOODS, haversineKm } from '../../src/lib/geo.mjs';

// Official districts are coarser than everyday names; refine to the closest familiar neighborhood inside them.
const REFINE = {
  'civic-center': ['civic-center', 'tenderloin', 'union-square', 'hayes-valley'],
  'financial-district': ['financial-district', 'embarcadero'],
  soma: ['soma', 'mission-bay'],
  'potrero-hill': ['potrero-hill', 'dogpatch', 'mission-bay'],
  fillmore: ['fillmore', 'japantown', 'nopa', 'hayes-valley', 'lower-haight'],
  'haight-ashbury': ['haight-ashbury', 'lower-haight'],
  marina: ['marina', 'cow-hollow'],
  'pacific-heights': ['pacific-heights', 'cow-hollow', 'japantown'],
  'north-beach': ['north-beach', 'fishermans-wharf', 'embarcadero'],
  'russian-hill': ['russian-hill', 'fishermans-wharf'],
};
const hoodPt = Object.fromEntries(NEIGHBORHOODS.map((h) => [h.slug, h]));
function refine(slug, lat, lng) {
  const group = REFINE[slug];
  if (!group) return slug;
  return group.map((g) => [g, haversineKm(lat, lng, hoodPt[g].lat, hoodPt[g].lng)]).sort((a, b) => a[1] - b[1])[0][0];
}

let features = null;
function load() {
  if (features) return features;
  try {
    const b = JSON.parse(fs.readFileSync(new URL('../../src/data/boundaries.json', import.meta.url), 'utf8'));
    features = b.hoods.features.filter((f) => f.properties.slug).map((f) => ({ ...f.properties, polys: f.geometry.coordinates, bbox: bbox(f.geometry.coordinates) }));
  } catch {
    features = [];
  }
  return features;
}

function bbox(polys) {
  let [w, s, e, n] = [180, 90, -180, -90];
  for (const poly of polys) for (const [x, y] of poly[0]) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
  return [w, s, e, n];
}

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Our neighborhood slug for a coordinate, or null. */
export function hoodAt(lat, lng, citySlug) {
  for (const f of load()) {
    if (citySlug && f.city !== citySlug) continue;
    const [w, s, e, n] = f.bbox;
    if (lng < w || lng > e || lat < s || lat > n) continue;
    for (const poly of f.polys) {
      if (inRing(lng, lat, poly[0]) && !poly.slice(1).some((hole) => inRing(lng, lat, hole))) return refine(f.slug, lat, lng);
    }
  }
  return null;
}
