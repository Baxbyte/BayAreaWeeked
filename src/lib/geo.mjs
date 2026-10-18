// Bay Area gazetteer: regions, cities, neighborhoods and transit stations.
// Shared by the scraper (Node) and the site (Astro). Coordinates are approximate centroids.

export const REGIONS = [
  { slug: 'san-francisco', name: 'San Francisco', short: 'SF', emoji: '🌉', lat: 37.7599, lng: -122.4348, radiusKm: 7,
    blurb: 'Fog, hills, world-class museums and a different neighborhood vibe every few blocks.' },
  { slug: 'east-bay', name: 'East Bay', short: 'East Bay', emoji: '🌞', lat: 37.83, lng: -122.15, radiusKm: 28,
    blurb: 'Oakland, Berkeley and the sunny inland valleys — great food, live music and redwood hikes.' },
  { slug: 'peninsula', name: 'Peninsula', short: 'Peninsula', emoji: '🌊', lat: 37.52, lng: -122.3, radiusKm: 20,
    blurb: 'From Daly City to Palo Alto: coastal trails, Caltrain-town downtowns and family-friendly weekends.' },
  { slug: 'south-bay', name: 'South Bay', short: 'South Bay', emoji: '🌴', lat: 37.33, lng: -121.95, radiusKm: 22,
    blurb: 'San José and Silicon Valley — warm weather, big venues, festivals and foothill escapes.' },
  { slug: 'north-bay', name: 'North Bay', short: 'North Bay', emoji: '🍇', lat: 38.1, lng: -122.55, radiusKm: 35,
    blurb: 'Marin, Sonoma and Napa — coastal hikes, small-town festivals and wine country.' },
];

// [slug, name, regionSlug, county, lat, lng, aliases]
const CITY_ROWS = [
  ['san-francisco', 'San Francisco', 'san-francisco', 'San Francisco', 37.7749, -122.4194, ['sf', 'san fran', 'frisco']],
  // East Bay
  ['oakland', 'Oakland', 'east-bay', 'Alameda', 37.8044, -122.2712, ['the town']],
  ['berkeley', 'Berkeley', 'east-bay', 'Alameda', 37.8716, -122.2727, []],
  ['alameda', 'Alameda', 'east-bay', 'Alameda', 37.7652, -122.2416, []],
  ['emeryville', 'Emeryville', 'east-bay', 'Alameda', 37.8313, -122.2852, []],
  ['albany', 'Albany', 'east-bay', 'Alameda', 37.8869, -122.2978, []],
  ['piedmont', 'Piedmont', 'east-bay', 'Alameda', 37.8244, -122.2317, []],
  ['el-cerrito', 'El Cerrito', 'east-bay', 'Contra Costa', 37.9161, -122.3108, []],
  ['richmond', 'Richmond', 'east-bay', 'Contra Costa', 37.9358, -122.3478, []],
  ['san-leandro', 'San Leandro', 'east-bay', 'Alameda', 37.7249, -122.1561, []],
  ['castro-valley', 'Castro Valley', 'east-bay', 'Alameda', 37.6941, -122.0864, []],
  ['hayward', 'Hayward', 'east-bay', 'Alameda', 37.6688, -122.0808, []],
  ['union-city', 'Union City', 'east-bay', 'Alameda', 37.5934, -122.0439, []],
  ['fremont', 'Fremont', 'east-bay', 'Alameda', 37.5485, -121.9886, []],
  ['newark', 'Newark', 'east-bay', 'Alameda', 37.5297, -122.0402, []],
  ['dublin', 'Dublin', 'east-bay', 'Alameda', 37.7022, -121.9358, []],
  ['pleasanton', 'Pleasanton', 'east-bay', 'Alameda', 37.6624, -121.8747, []],
  ['livermore', 'Livermore', 'east-bay', 'Alameda', 37.6819, -121.768, []],
  ['san-ramon', 'San Ramon', 'east-bay', 'Contra Costa', 37.7799, -121.978, []],
  ['danville', 'Danville', 'east-bay', 'Contra Costa', 37.8216, -121.9999, []],
  ['walnut-creek', 'Walnut Creek', 'east-bay', 'Contra Costa', 37.9101, -122.0652, []],
  ['lafayette', 'Lafayette', 'east-bay', 'Contra Costa', 37.8858, -122.118, []],
  ['orinda', 'Orinda', 'east-bay', 'Contra Costa', 37.8771, -122.1797, []],
  ['moraga', 'Moraga', 'east-bay', 'Contra Costa', 37.8349, -122.1297, []],
  ['pleasant-hill', 'Pleasant Hill', 'east-bay', 'Contra Costa', 37.948, -122.0608, []],
  ['concord', 'Concord', 'east-bay', 'Contra Costa', 37.978, -122.0311, []],
  ['martinez', 'Martinez', 'east-bay', 'Contra Costa', 38.0194, -122.1341, []],
  ['pittsburg', 'Pittsburg', 'east-bay', 'Contra Costa', 38.028, -121.8847, []],
  ['antioch', 'Antioch', 'east-bay', 'Contra Costa', 38.0049, -121.8058, []],
  ['brentwood', 'Brentwood', 'east-bay', 'Contra Costa', 37.9318, -121.6958, []],
  // Peninsula
  ['daly-city', 'Daly City', 'peninsula', 'San Mateo', 37.6879, -122.4702, []],
  ['brisbane', 'Brisbane', 'peninsula', 'San Mateo', 37.6808, -122.3999, []],
  ['south-san-francisco', 'South San Francisco', 'peninsula', 'San Mateo', 37.6547, -122.4077, ['south sf', 'ssf']],
  ['san-bruno', 'San Bruno', 'peninsula', 'San Mateo', 37.6305, -122.4111, []],
  ['pacifica', 'Pacifica', 'peninsula', 'San Mateo', 37.6138, -122.4869, []],
  ['millbrae', 'Millbrae', 'peninsula', 'San Mateo', 37.5985, -122.3872, []],
  ['burlingame', 'Burlingame', 'peninsula', 'San Mateo', 37.5841, -122.3661, []],
  ['san-mateo', 'San Mateo', 'peninsula', 'San Mateo', 37.563, -122.3255, []],
  ['foster-city', 'Foster City', 'peninsula', 'San Mateo', 37.5585, -122.2711, []],
  ['belmont', 'Belmont', 'peninsula', 'San Mateo', 37.5202, -122.2758, []],
  ['san-carlos', 'San Carlos', 'peninsula', 'San Mateo', 37.5072, -122.2605, []],
  ['redwood-city', 'Redwood City', 'peninsula', 'San Mateo', 37.4852, -122.2364, []],
  ['half-moon-bay', 'Half Moon Bay', 'peninsula', 'San Mateo', 37.4636, -122.4286, []],
  ['woodside', 'Woodside', 'peninsula', 'San Mateo', 37.4299, -122.2539, []],
  ['atherton', 'Atherton', 'peninsula', 'San Mateo', 37.4613, -122.1977, []],
  ['menlo-park', 'Menlo Park', 'peninsula', 'San Mateo', 37.453, -122.1817, []],
  ['east-palo-alto', 'East Palo Alto', 'peninsula', 'San Mateo', 37.4688, -122.1411, []],
  ['palo-alto', 'Palo Alto', 'peninsula', 'Santa Clara', 37.4419, -122.143, ['stanford']],
  // South Bay
  ['mountain-view', 'Mountain View', 'south-bay', 'Santa Clara', 37.3861, -122.0839, []],
  ['los-altos', 'Los Altos', 'south-bay', 'Santa Clara', 37.3852, -122.1141, []],
  ['sunnyvale', 'Sunnyvale', 'south-bay', 'Santa Clara', 37.3688, -122.0363, []],
  ['santa-clara', 'Santa Clara', 'south-bay', 'Santa Clara', 37.3541, -121.9552, []],
  ['cupertino', 'Cupertino', 'south-bay', 'Santa Clara', 37.323, -122.0322, []],
  ['san-jose', 'San Jose', 'south-bay', 'Santa Clara', 37.3382, -121.8863, ['san josé', 'sj']],
  ['milpitas', 'Milpitas', 'south-bay', 'Santa Clara', 37.4323, -121.8996, []],
  ['campbell', 'Campbell', 'south-bay', 'Santa Clara', 37.2872, -121.95, []],
  ['saratoga', 'Saratoga', 'south-bay', 'Santa Clara', 37.2638, -122.023, []],
  ['los-gatos', 'Los Gatos', 'south-bay', 'Santa Clara', 37.2358, -121.9624, []],
  ['morgan-hill', 'Morgan Hill', 'south-bay', 'Santa Clara', 37.1305, -121.6544, []],
  ['gilroy', 'Gilroy', 'south-bay', 'Santa Clara', 37.0058, -121.5683, []],
  // North Bay
  ['sausalito', 'Sausalito', 'north-bay', 'Marin', 37.8591, -122.4853, []],
  ['tiburon', 'Tiburon', 'north-bay', 'Marin', 37.8735, -122.4566, []],
  ['mill-valley', 'Mill Valley', 'north-bay', 'Marin', 37.906, -122.545, []],
  ['corte-madera', 'Corte Madera', 'north-bay', 'Marin', 37.9255, -122.5275, []],
  ['larkspur', 'Larkspur', 'north-bay', 'Marin', 37.9341, -122.5353, []],
  ['san-anselmo', 'San Anselmo', 'north-bay', 'Marin', 37.9746, -122.5616, []],
  ['fairfax', 'Fairfax', 'north-bay', 'Marin', 37.9871, -122.5889, []],
  ['san-rafael', 'San Rafael', 'north-bay', 'Marin', 37.9735, -122.5311, []],
  ['novato', 'Novato', 'north-bay', 'Marin', 38.1074, -122.5697, []],
  ['stinson-beach', 'Stinson Beach', 'north-bay', 'Marin', 37.9005, -122.6444, []],
  ['point-reyes-station', 'Point Reyes Station', 'north-bay', 'Marin', 38.0691, -122.8069, ['point reyes']],
  ['petaluma', 'Petaluma', 'north-bay', 'Sonoma', 38.2324, -122.6367, []],
  ['sonoma', 'Sonoma', 'north-bay', 'Sonoma', 38.2919, -122.458, []],
  ['santa-rosa', 'Santa Rosa', 'north-bay', 'Sonoma', 38.4405, -122.7144, []],
  ['healdsburg', 'Healdsburg', 'north-bay', 'Sonoma', 38.6105, -122.8692, []],
  ['napa', 'Napa', 'north-bay', 'Napa', 38.2975, -122.2869, []],
  ['yountville', 'Yountville', 'north-bay', 'Napa', 38.4016, -122.3608, []],
  ['st-helena', 'St. Helena', 'north-bay', 'Napa', 38.5052, -122.4703, ['saint helena']],
  ['calistoga', 'Calistoga', 'north-bay', 'Napa', 38.5788, -122.5797, []],
  ['vallejo', 'Vallejo', 'north-bay', 'Solano', 38.1041, -122.2566, []],
  ['benicia', 'Benicia', 'north-bay', 'Solano', 38.0494, -122.1586, []],
];

export const CITIES = CITY_ROWS.map(([slug, name, region, county, lat, lng, aliases]) => ({
  slug, name, region, county, lat, lng, aliases,
}));

// [slug, name, citySlug, lat, lng, aliases]
const HOOD_ROWS = [
  ['mission-district', 'Mission District', 'san-francisco', 37.7599, -122.4148, ['the mission', 'mission st', 'valencia st', 'valencia street', 'mission street', 'mission dolores', 'dolores park', 'dolores st', '24th st', '16th st']],
  ['castro', 'The Castro', 'san-francisco', 37.7609, -122.435, ['castro district', 'castro st']],
  ['noe-valley', 'Noe Valley', 'san-francisco', 37.7502, -122.4337, []],
  ['haight-ashbury', 'Haight-Ashbury', 'san-francisco', 37.7692, -122.4481, ['upper haight', 'haight st', 'haight street']],
  ['lower-haight', 'Lower Haight', 'san-francisco', 37.7717, -122.431, []],
  ['hayes-valley', 'Hayes Valley', 'san-francisco', 37.7759, -122.4245, []],
  ['soma', 'SoMa', 'san-francisco', 37.7785, -122.4056, ['south of market', 'yerba buena', 'moscone', 'sfmoma', 'third st', '3rd st', 'folsom st', 'howard st']],
  ['financial-district', 'Financial District', 'san-francisco', 37.7946, -122.3999, ['fidi', 'downtown sf']],
  ['embarcadero', 'Embarcadero', 'san-francisco', 37.7993, -122.3977, ['ferry building', 'exploratorium', 'pier 15', 'pier 33']],
  ['north-beach', 'North Beach', 'san-francisco', 37.8061, -122.4103, ['telegraph hill', 'coit tower', 'columbus ave', 'washington square']],
  ['chinatown', 'Chinatown', 'san-francisco', 37.7941, -122.4078, []],
  ['nob-hill', 'Nob Hill', 'san-francisco', 37.793, -122.4161, ['grace cathedral']],
  ['russian-hill', 'Russian Hill', 'san-francisco', 37.8011, -122.4194, ['lombard street', 'polk street']],
  ['fishermans-wharf', "Fisherman's Wharf", 'san-francisco', 37.808, -122.4177, ['fishermans wharf', 'ghirardelli', 'pier 39', 'pier 45', 'beach st']],
  ['marina', 'Marina', 'san-francisco', 37.8037, -122.4368, ['marina district', 'chestnut st', 'fort mason']],
  ['cow-hollow', 'Cow Hollow', 'san-francisco', 37.7976, -122.4369, ['union street']],
  ['pacific-heights', 'Pacific Heights', 'san-francisco', 37.7925, -122.4382, ['pac heights', 'fillmore street']],
  ['union-square', 'Union Square', 'san-francisco', 37.788, -122.4075, []],
  ['tenderloin', 'Tenderloin', 'san-francisco', 37.7847, -122.4141, []],
  ['civic-center', 'Civic Center', 'san-francisco', 37.7793, -122.4193, ['city hall', 'davies symphony hall', 'war memorial opera house']],
  ['japantown', 'Japantown', 'san-francisco', 37.7854, -122.4294, []],
  ['fillmore', 'Fillmore / Western Addition', 'san-francisco', 37.7816, -122.433, ['western addition', 'the fillmore']],
  ['nopa', 'NoPa', 'san-francisco', 37.7757, -122.4404, ['north of panhandle', 'divisadero']],
  ['inner-richmond', 'Inner Richmond', 'san-francisco', 37.7802, -122.4645, ['clement street']],
  ['outer-richmond', 'Outer Richmond', 'san-francisco', 37.7775, -122.4935, ['lands end', 'sutro baths']],
  ['inner-sunset', 'Inner Sunset', 'san-francisco', 37.76, -122.468, ['irving street']],
  ['outer-sunset', 'Outer Sunset', 'san-francisco', 37.755, -122.494, ['ocean beach', 'judah street', 'sloat blvd', 'great hwy', 'sf zoo']],
  ['golden-gate-park', 'Golden Gate Park', 'san-francisco', 37.7694, -122.4862, ['de young', 'academy of sciences', 'music concourse', 'john f kennedy dr', 'jfk drive', 'hagiwara tea garden']],
  ['presidio', 'Presidio', 'san-francisco', 37.7989, -122.4662, ['crissy field', 'baker beach']],
  ['potrero-hill', 'Potrero Hill', 'san-francisco', 37.7587, -122.401, []],
  ['dogpatch', 'Dogpatch', 'san-francisco', 37.7585, -122.3878, []],
  ['mission-bay', 'Mission Bay', 'san-francisco', 37.7706, -122.3915, ['chase center', 'oracle park']],
  ['bernal-heights', 'Bernal Heights', 'san-francisco', 37.7389, -122.4152, []],
  ['glen-park', 'Glen Park', 'san-francisco', 37.734, -122.4337, []],
  ['excelsior', 'Excelsior', 'san-francisco', 37.7246, -122.4255, []],
  ['bayview', 'Bayview–Hunters Point', 'san-francisco', 37.7304, -122.3844, ['bayview', 'hunters point']],
  ['twin-peaks', 'Twin Peaks', 'san-francisco', 37.7544, -122.4477, []],
  ['west-portal', 'West Portal', 'san-francisco', 37.7405, -122.4664, []],
  ['treasure-island', 'Treasure Island', 'san-francisco', 37.8235, -122.3706, []],
  // Oakland
  ['downtown-oakland', 'Downtown Oakland', 'oakland', 37.8029, -122.2721, ['uptown oakland', 'uptown', 'fox theater', 'paramount theatre']],
  ['jack-london-square', 'Jack London Square', 'oakland', 37.7946, -122.2766, []],
  ['lake-merritt', 'Lake Merritt', 'oakland', 37.8027, -122.2585, ['grand lake', 'grand ave']],
  ['temescal', 'Temescal', 'oakland', 37.8338, -122.2633, []],
  ['rockridge', 'Rockridge', 'oakland', 37.8442, -122.2519, ['college ave']],
  ['fruitvale', 'Fruitvale', 'oakland', 37.7759, -122.2245, []],
  ['west-oakland', 'West Oakland', 'oakland', 37.8113, -122.2948, []],
  ['montclair', 'Montclair', 'oakland', 37.8394, -122.2133, ['redwood regional']],
  // San Jose
  ['downtown-san-jose', 'Downtown San Jose', 'san-jose', 37.3337, -121.8907, ['sofa district', 'san pedro square']],
  ['willow-glen', 'Willow Glen', 'san-jose', 37.3083, -121.8986, []],
  ['japantown-san-jose', 'Japantown (San Jose)', 'san-jose', 37.3489, -121.8946, []],
  ['santana-row', 'Santana Row', 'san-jose', 37.3209, -121.9479, []],
];

export const NEIGHBORHOODS = HOOD_ROWS.map(([slug, name, city, lat, lng, aliases]) => ({ slug, name, city, lat, lng, aliases }));

// BART stations (approximate). Used for the "Near BART" filter.
export const BART_STATIONS = [
  ['Embarcadero', 37.7929, -122.3969], ['Montgomery St', 37.7894, -122.4013], ['Powell St', 37.7844, -122.4079],
  ['Civic Center', 37.7795, -122.414], ['16th St Mission', 37.765, -122.4197], ['24th St Mission', 37.7522, -122.4186],
  ['Glen Park', 37.7331, -122.4339], ['Balboa Park', 37.7215, -122.4475], ['Daly City', 37.7063, -122.4692],
  ['Colma', 37.6846, -122.4661], ['South San Francisco', 37.6642, -122.444], ['San Bruno', 37.6379, -122.4163],
  ['SFO', 37.6159, -122.3924], ['Millbrae', 37.6002, -122.3866], ['West Oakland', 37.8048, -122.2951],
  ['12th St Oakland', 37.8037, -122.2717], ['19th St Oakland', 37.8085, -122.2687], ['MacArthur', 37.8291, -122.2671],
  ['Rockridge', 37.8447, -122.2512], ['Orinda', 37.8784, -122.1838], ['Lafayette', 37.8932, -122.1247],
  ['Walnut Creek', 37.9056, -122.0675], ['Pleasant Hill', 37.9284, -122.056], ['Concord', 37.9737, -122.029],
  ['North Concord', 38.0032, -122.0247], ['Pittsburg/Bay Point', 38.0189, -121.9452], ['Ashby', 37.8529, -122.27],
  ['Downtown Berkeley', 37.8701, -122.2681], ['North Berkeley', 37.8739, -122.2834], ['El Cerrito Plaza', 37.903, -122.2992],
  ['El Cerrito del Norte', 37.9256, -122.3172], ['Richmond', 37.9369, -122.3533], ['Lake Merritt', 37.7974, -122.2653],
  ['Fruitvale', 37.7748, -122.2242], ['Coliseum', 37.7536, -122.1969], ['San Leandro', 37.7219, -122.1609],
  ['Bay Fair', 37.6969, -122.1265], ['Hayward', 37.6699, -122.087], ['South Hayward', 37.6347, -122.0575],
  ['Union City', 37.5906, -122.0174], ['Fremont', 37.5574, -121.9764], ['Warm Springs', 37.5024, -121.9396],
  ['Milpitas', 37.4103, -121.8913], ['Berryessa', 37.3687, -121.8746], ['Castro Valley', 37.6908, -122.0757],
  ['West Dublin/Pleasanton', 37.6998, -121.9282], ['Dublin/Pleasanton', 37.7017, -121.8992],
].map(([name, lat, lng]) => ({ name, lat, lng }));

export const regionBySlug = Object.fromEntries(REGIONS.map((r) => [r.slug, r]));
export const cityBySlug = Object.fromEntries(CITIES.map((c) => [c.slug, c]));
export const hoodBySlug = Object.fromEntries(NEIGHBORHOODS.map((n) => [n.slug, n]));

export function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestBart(lat, lng, maxKm = 0.9) {
  if (lat == null || lng == null) return null;
  let best = null;
  for (const s of BART_STATIONS) {
    const d = haversineKm(lat, lng, s.lat, s.lng);
    if (d <= maxKm && (!best || d < best.km)) best = { name: s.name, km: Math.round(d * 100) / 100 };
  }
  return best;
}

const norm = (s) => ` ${String(s || '').toLowerCase().replace(/[^a-z0-9é]+/g, ' ').trim()} `;

// Match a city by name/alias appearing in free text (address, venue, title).
export function cityFromText(text) {
  const t = norm(text);
  // Longest names first so "South San Francisco" wins over "San Francisco".
  const candidates = [...CITIES].sort((a, b) => b.name.length - a.name.length);
  for (const c of candidates) {
    for (const n of [c.name, ...c.aliases]) {
      if (t.includes(norm(n))) return c;
    }
  }
  return null;
}

export function hoodFromText(text, citySlug) {
  const t = norm(text);
  for (const h of NEIGHBORHOODS) {
    if (citySlug && h.city !== citySlug) continue;
    for (const n of [h.name, ...h.aliases]) {
      if (norm(n).trim().length > 3 && t.includes(norm(n))) return h;
    }
  }
  return null;
}

export function nearestCity(lat, lng, maxKm = 30) {
  let best = null;
  for (const c of CITIES) {
    const d = haversineKm(lat, lng, c.lat, c.lng);
    if (d <= maxKm && (!best || d < best.d)) best = { c, d };
  }
  return best?.c || null;
}

export function nearestHood(lat, lng, citySlug, maxKm = 1.6) {
  let best = null;
  for (const h of NEIGHBORHOODS) {
    if (h.city !== citySlug) continue;
    const d = haversineKm(lat, lng, h.lat, h.lng);
    if (d <= maxKm && (!best || d < best.d)) best = { h, d };
  }
  return best?.h || null;
}

// Rough Bay Area bounding box, used to discard far-away events from broad sources.
export function inBayArea(lat, lng) {
  return lat >= 36.9 && lat <= 38.75 && lng >= -123.2 && lng <= -121.4;
}
