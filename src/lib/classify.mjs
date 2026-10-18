// Rule-based classifier: turns raw text + venue + time into categories and vibe flags.
import { CATEGORIES } from './taxonomy.mjs';
import { nearestBart } from './geo.mjs';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (words) => new RegExp(`(^|[^a-z0-9])(${words.map(esc).join('|')})(?=$|[^a-z0-9])`, 'i');

const CAT_RES = CATEGORIES.map((c) => [c.slug, wordRe(c.words.map((w) => w.trim()))]);

const KIDS_RE = wordRe(['kids', 'kid-friendly', 'kid friendly', 'family', 'families', 'family-friendly', 'children', 'child', 'toddler', 'toddlers',
  'storytime', 'story time', 'puppet', 'petting zoo', 'all ages', 'all-ages', 'teens', 'baby', 'babies', 'preschool', 'youth', 'junior', 'trick-or-treat',
  'trick or treat', 'easter egg', 'santa', 'face painting', 'bounce house', 'carousel', 'lego', 'science fair', 'family day']);
const ADULT_RE = /(^|[^0-9])(21\s*\+|21 and over|21 & over|21 and up|ages 21|21\+ only|18\s*\+|18 and over|ages 18)/i;
const NIGHT_RE = wordRe(['nightclub', 'club night', 'dj', 'djs', 'rave', 'techno', 'house music', 'deep house', 'dance party', 'afterparty', 'after party',
  'after-party', 'late night', 'late-night', 'bar crawl', 'pub crawl', 'burlesque', 'cocktail', 'cocktails', 'happy hour', 'speakeasy', 'lounge', 'karaoke',
  'drag show', 'nightlife', 'after dark', 'disco', 'dance floor', 'bottle service', 'drum and bass', 'dnb', 'dubstep', 'edm']);
const BAR_VENUE_RE = wordRe(['bar', 'club', 'lounge', 'tavern', 'saloon', 'pub', 'nightclub', 'brewery', 'taproom', 'cocktail', 'speakeasy']);
const FREE_TITLE_RE = /(^|[^a-z-])free([^a-z-]|$)|no cover|\$0(?![.\d])/i;
const FREE_DESC_RE = /free admission|free entry|admission is free|free (and|&) open to (the|all)|free event|free to attend|no cover|free for all ages|always free|entry is free|free with rsvp|free, all ages/i;

const OUTDOOR_RE = wordRe(['park', 'beach', 'trail', 'trailhead', 'garden', 'gardens', 'plaza', 'street fair', 'block party', 'field', 'pier', 'lake',
  'farm', 'vineyard', 'open space', 'preserve', 'zoo', 'parade', 'farmers market', 'outdoor', 'outdoors', 'hike', 'hiking', 'picnic', 'kayak', 'paddle',
  'bike ride', 'bike', 'cycling', 'stargazing', 'tide pool', 'redwoods', 'redwood', 'meadow', 'waterfront', 'marina', 'amphitheater', 'amphitheatre',
  'under the stars', 'rooftop', 'courtyard', 'regional shoreline', 'state park', 'campground', 'golf course', 'stadium', 'ballpark', 'crissy field', 'lawn']);
const INDOOR_RE = wordRe(['theater', 'theatre', 'hall', 'museum', 'gallery', 'library', 'club', 'bar', 'lounge', 'cinema', 'studio', 'auditorium', 'cafe',
  'café', 'restaurant', 'arena', 'ballroom', 'church', 'cathedral', 'bookstore', 'books', 'aquarium', 'planetarium', 'bowling', 'arcade', 'escape room',
  'climbing gym', 'gym', 'indoor', 'conference', 'convention center', 'hotel', 'center', 'centre', 'warehouse', 'workshop', 'class', 'screening',
  'exploratorium', 'symphony', 'opera house', 'chapel', 'speakeasy', 'kitchen', 'tasting room', 'ice rink', 'skating rink', 'spa', 'chase center', 'sap center']);
const WATER_RE = wordRe(['beach', 'pool', 'swim', 'swimming', 'kayak', 'kayaking', 'paddle', 'paddleboard', 'sup', 'splash', 'water park', 'waterpark',
  'ice cream', 'gelato', 'boat', 'boating', 'sail', 'sailing', 'cruise', 'river', 'lake', 'ice skating', 'ice rink', 'surf', 'surfing', 'snow cone', 'shave ice',
  'fountain', 'sprinkler', 'tide pool', 'tidepool', 'creek', 'ocean', 'bay cruise', 'ferry', 'aquarium', 'shade', 'redwood', 'redwoods', 'forest']);
const COOL_COAST_CITIES = new Set(['pacifica', 'half-moon-bay', 'stinson-beach', 'point-reyes-station', 'daly-city', 'sausalito']);
const COOL_COAST_HOODS = new Set(['outer-sunset', 'outer-richmond', 'presidio', 'golden-gate-park', 'marina', 'fishermans-wharf', 'embarcadero', 'treasure-island']);
const AC_CATS = new Set(['film', 'arts', 'theater', 'comedy', 'learning']);

const SUNNY_CITIES = new Set(['walnut-creek', 'concord', 'pleasanton', 'livermore', 'danville', 'san-ramon', 'lafayette', 'orinda', 'moraga', 'dublin',
  'pleasant-hill', 'martinez', 'antioch', 'pittsburg', 'brentwood', 'sonoma', 'napa', 'healdsburg', 'santa-rosa', 'petaluma', 'yountville', 'st-helena',
  'calistoga', 'san-jose', 'santa-clara', 'sunnyvale', 'cupertino', 'campbell', 'los-gatos', 'saratoga', 'milpitas', 'morgan-hill', 'gilroy', 'mountain-view',
  'los-altos', 'palo-alto', 'menlo-park', 'redwood-city', 'san-carlos', 'oakland', 'berkeley', 'fremont', 'hayward', 'castro-valley', 'livermore']);
const SUNNY_HOODS = new Set(['mission-district', 'potrero-hill', 'dogpatch', 'bernal-heights', 'noe-valley', 'castro', 'mission-bay']);

const DATE_RE = wordRe(['date night', 'couples', 'romantic', 'sunset', 'wine tasting', 'candlelight', 'candle light', 'jazz', 'speakeasy', 'tasting menu',
  'dinner', 'cocktail', 'cocktails', 'rooftop', 'dance lesson', 'salsa', 'swing dance', 'stargazing', 'aperitivo', 'champagne']);

/** Hour of day (0-23) in America/Los_Angeles for an ISO date string. */
export function ptHour(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(+d)) return null;
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23' }).format(d));
}

/**
 * @param {object} e normalized item with title, description, venue, priceMin, priceText, start, allDay, sourceTags, geo slugs
 * @returns {{categories:string[], flags:object}}
 */
export function classify(e) {
  const title = e.title || '';
  const desc = (e.description || '').slice(0, 1500);
  const venueText = [e.venue?.name, e.venue?.address].filter(Boolean).join(' ');
  const srcTags = (e.sourceTags || []).join(' ');
  const all = `${title} ${srcTags} ${venueText} ${desc}`;
  const head = `${title} ${srcTags} ${venueText}`;

  // Categories: weight title/tags/venue higher than description.
  const scores = {};
  for (const [slug, re] of CAT_RES) {
    let s = 0;
    if (re.test(head)) s += 2;
    if (re.test(desc)) s += 1;
    if (s) scores[slug] = s;
  }
  for (const c of e.forceCategories || []) scores[c] = 10;
  let categories = Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([s]) => s);
  // Avoid the generic "learning" and "community" tags dominating when stronger signals exist.
  if (categories.length > 1) categories = categories.filter((c, i) => i === 0 || scores[c] >= 2 || !['learning', 'community', 'tech'].includes(c));
  categories = categories.slice(0, 3);
  if (!categories.length) categories = ['community'];

  const hour = e.allDay ? null : ptHour(e.start);
  const adult = ADULT_RE.test(all) || e.forceFlags?.adult === true;
  const nightWords = NIGHT_RE.test(head) || (NIGHT_RE.test(desc) && hour != null && hour >= 19);
  const lateMusic = hour != null && (hour >= 21 || hour < 3) && (categories.includes('live-music') || categories.includes('nightlife'));
  const barVenue = BAR_VENUE_RE.test(e.venue?.name || '') && hour != null && hour >= 18;
  let nightlife = adult || nightWords || lateMusic || barVenue || categories[0] === 'nightlife';
  if (e.forceFlags?.nightlife != null) nightlife = e.forceFlags.nightlife;

  let kids = !adult && !nightWords && (KIDS_RE.test(head) || KIDS_RE.test(desc) || categories.includes('family'));
  if (kids && hour != null && hour >= 20) kids = false;
  if (e.forceFlags?.kids != null) kids = e.forceFlags.kids;
  if (kids && !categories.includes('family')) categories = [...categories.slice(0, 2), 'family'];

  const free = e.priceMin === 0 || /^\s*free/i.test(e.priceText || '') || FREE_TITLE_RE.test(title) || FREE_DESC_RE.test(desc) || e.forceFlags?.free === true;

  const outdoorScore = (OUTDOOR_RE.test(head) ? 2 : 0) + (OUTDOOR_RE.test(desc) ? 1 : 0) + (categories.includes('outdoors') ? 2 : 0);
  const indoorScore = (INDOOR_RE.test(head) ? 2 : 0) + (INDOOR_RE.test(desc) ? 1 : 0) +
    (categories.some((c) => ['film', 'comedy', 'theater', 'learning'].includes(c)) ? 1 : 0);
  let setting = indoorScore > outdoorScore ? 'indoor' : outdoorScore > indoorScore ? 'outdoor' : 'mixed';
  if (e.forceFlags?.setting) setting = e.forceFlags.setting;

  const coolCoast = COOL_COAST_CITIES.has(e.city) || COOL_COAST_HOODS.has(e.neighborhood);
  let hot = WATER_RE.test(head) || (coolCoast && setting !== 'indoor') || (setting === 'indoor' && categories.some((c) => AC_CATS.has(c)) && !nightlife);
  if (e.forceFlags?.hot != null) hot = e.forceFlags.hot;

  let rainy = setting === 'indoor';
  if (e.forceFlags?.rainy != null) rainy = e.forceFlags.rainy;

  const sunny = SUNNY_CITIES.has(e.city) || SUNNY_HOODS.has(e.neighborhood);
  let fog = sunny && setting !== 'indoor';
  if (e.forceFlags?.fog != null) fog = e.forceFlags.fog;

  let date = !kids && (DATE_RE.test(head) || ((hour == null || hour >= 17) &&
    categories.some((c) => ['comedy', 'theater', 'live-music', 'food-drink', 'film'].includes(c)) && !categories.includes('family')));
  if (e.forceFlags?.date != null) date = e.forceFlags.date;

  const bart = nearestBart(e.venue?.lat, e.venue?.lng);

  return {
    categories,
    flags: { kids, nightlife, adult, free, setting, hot, rainy, fog, date, bart: bart ? bart.name : null },
  };
}
