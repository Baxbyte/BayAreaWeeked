#!/usr/bin/env node
// Downloads real county + neighborhood boundaries (Code for America / click_that_hood, sourced from
// official city & Census data) and writes a compact, simplified src/data/boundaries.json.
//   node scripts/geo/build-boundaries.mjs
import fs from 'node:fs';

const SRC = 'https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/';
const COUNTY_REGION = {
  'San Francisco': 'san-francisco', Alameda: 'east-bay', 'Contra Costa': 'east-bay', 'San Mateo': 'peninsula',
  'Santa Clara': 'south-bay', Marin: 'north-bay', Sonoma: 'north-bay', Napa: 'north-bay', Solano: 'north-bay',
};
// click_that_hood neighborhood name → our neighborhood slug (unmapped ones are still drawn, just not linked)
const HOOD_MAP = {
  'san-francisco': {
    Bayview: 'bayview', 'Bernal Heights': 'bernal-heights', 'Castro/Upper Market': 'castro', Chinatown: 'chinatown', 'Downtown/Civic Center': 'civic-center',
    Excelsior: 'excelsior', 'Financial District': 'financial-district', 'Glen Park': 'glen-park', 'Golden Gate Park': 'golden-gate-park',
    'Haight Ashbury': 'haight-ashbury', 'Inner Richmond': 'inner-richmond', 'Inner Sunset': 'inner-sunset', Marina: 'marina', Mission: 'mission-district',
    'Nob Hill': 'nob-hill', 'Noe Valley': 'noe-valley', 'North Beach': 'north-beach', 'Outer Richmond': 'outer-richmond', 'Outer Sunset': 'outer-sunset',
    'Pacific Heights': 'pacific-heights', 'Potrero Hill': 'potrero-hill', Presidio: 'presidio', 'Russian Hill': 'russian-hill', 'South of Market': 'soma',
    'Treasure Island/YBI': 'treasure-island', 'Twin Peaks': 'twin-peaks', 'West of Twin Peaks': 'west-portal', 'Western Addition': 'fillmore',
  },
  oakland: {
    Downtown: 'downtown-oakland', 'Lake Merritt': 'lake-merritt', 'Grand Lake': 'lake-merritt', 'Adams Point': 'lake-merritt', Temescal: 'temescal',
    Rockridge: 'rockridge', 'Upper Rockridge': 'rockridge', Fruitvale: 'fruitvale', 'Fruitvale Station': 'fruitvale', 'Jack London Square': 'jack-london-square',
    'Jack London Gateway': 'west-oakland', 'West Oakland': 'west-oakland', 'Prescott': 'west-oakland', 'Ralph Bunche': 'west-oakland', 'Montclair': 'montclair', 'Civic Center': 'downtown-oakland',
    Chinatown: 'downtown-oakland', 'Northgate': 'downtown-oakland',
  },
  'san-jose': { Downtown: 'downtown-san-jose', 'Willow Glen': 'willow-glen', 'West San Jose': 'santana-row' },
};

// ---- geometry helpers ----
function sqSegDist(p, a, b) {
  let [x, y] = a;
  let dx = b[0] - x, dy = b[1] - y;
  if (dx || dy) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) [x, y] = b; else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = p[0] - x; dy = p[1] - y;
  return dx * dx + dy * dy;
}
function simplify(pts, tol) {
  if (pts.length <= 4) return pts;
  const sq = tol * tol;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [f, l] = stack.pop();
    let max = 0, idx = 0;
    for (let i = f + 1; i < l; i++) { const d = sqSegDist(pts[i], pts[f], pts[l]); if (d > max) { max = d; idx = i; } }
    if (max > sq) { keep[idx] = 1; stack.push([f, idx], [idx, l]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const area = (r) => Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
const round = (r) => r.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]);

function cleanGeom(g, tol, minArea) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const out = [];
  for (const poly of polys) {
    const rings = poly.map((r) => round(simplify(r, tol))).filter((r) => r.length >= 4 && area(r) >= minArea);
    if (rings.length) out.push(rings);
  }
  return out.length ? { type: 'MultiPolygon', coordinates: out } : null;
}

async function get(name) {
  const res = await fetch(`${SRC}${name}.geojson`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.json();
}

const counties = await get('california-counties');
const regions = counties.features.filter((f) => COUNTY_REGION[f.properties.name]).map((f) => ({
  type: 'Feature', properties: { county: f.properties.name, region: COUNTY_REGION[f.properties.name] },
  geometry: cleanGeom(f.geometry, 0.0015, 0.00002),
}));

const hoods = [];
for (const [city, map] of Object.entries(HOOD_MAP)) {
  const fc = await get(city);
  for (const f of fc.features) {
    const geometry = cleanGeom(f.geometry, 0.00025, 0.0000005);
    if (geometry) hoods.push({ type: 'Feature', properties: { city, name: f.properties.name, slug: map[f.properties.name] || null }, geometry });
  }
}

const out = { source: 'Code for America click_that_hood (official city/Census boundaries)', regions: { type: 'FeatureCollection', features: regions }, hoods: { type: 'FeatureCollection', features: hoods } };
fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/boundaries.json', JSON.stringify(out));
console.log(`boundaries.json: ${regions.length} counties, ${hoods.length} neighborhoods, ${(fs.statSync('src/data/boundaries.json').size / 1024).toFixed(0)} KB`);
