// Natural-language search parser: "free kid stuff in oakland saturday" → structured filters.
import { CITIES, NEIGHBORHOODS, REGIONS } from '../lib/geo.mjs';
import { CATEGORIES, VIBES } from '../lib/taxonomy.mjs';

const VIBE_WORDS = {
  'kid-friendly': ['kids', 'kid', 'kid friendly', 'kid-friendly', 'family', 'families', 'children', 'child', 'toddler', 'toddlers', 'baby', 'all ages'],
  nightlife: ['nightlife', 'club', 'clubs', 'clubbing', 'bar', 'bars', '21+', 'late night', 'party', 'parties', 'rave', 'dancing', 'dj', 'djs', 'drinks'],
  free: ['free', 'no cost', 'gratis', 'cheap'],
  'hot-day': ['hot day', 'hot days', 'hot', 'heat', 'heatwave', 'heat wave', 'sunny', 'warm', 'beat the heat', 'cool off'],
  'rainy-day': ['rainy day', 'rainy days', 'rain', 'rainy', 'raining', 'indoor', 'indoors', 'wet', 'storm', 'stormy', 'inside'],
  'fog-escape': ['fog', 'foggy', 'karl', 'sunshine', 'escape the fog'],
  'date-night': ['date', 'date night', 'romantic', 'couples', 'couple', 'anniversary'],
  'near-bart': ['bart', 'car free', 'car-free', 'transit', 'no car'],
};
const CAT_WORDS = {
  'live-music': ['music', 'concert', 'concerts', 'live music', 'jazz', 'band', 'bands', 'gig', 'gigs', 'symphony', 'opera', 'hip hop', 'rock', 'indie'],
  nightlife: ['techno', 'house music', 'edm', 'disco', 'karaoke', 'drag'],
  comedy: ['comedy', 'comedian', 'stand up', 'standup', 'improv', 'funny', 'laugh'],
  theater: ['theater', 'theatre', 'musical', 'play', 'ballet', 'dance show', 'broadway'],
  arts: ['art', 'arts', 'museum', 'museums', 'gallery', 'galleries', 'exhibit', 'exhibition'],
  film: ['film', 'films', 'movie', 'movies', 'cinema', 'screening'],
  'food-drink': ['food', 'eat', 'eats', 'drink', 'beer', 'wine', 'brunch', 'dinner', 'tasting', 'cocktails', 'coffee', 'tacos'],
  markets: ['market', 'markets', 'flea', 'shopping', 'craft fair', 'farmers market', 'vintage'],
  festivals: ['festival', 'festivals', 'fest', 'fair', 'fairs', 'parade', 'street fair', 'halloween', 'holiday'],
  outdoors: ['hike', 'hikes', 'hiking', 'outdoors', 'outdoor', 'nature', 'park', 'parks', 'beach', 'beaches', 'trail', 'kayak', 'bike'],
  sports: ['sports', 'game', 'games', 'warriors', 'giants', '49ers', 'niners', 'sharks', 'valkyries', 'run', 'race', '5k'],
  wellness: ['yoga', 'fitness', 'workout', 'meditation', 'wellness', 'spa', 'climbing', 'sound bath'],
  learning: ['class', 'classes', 'workshop', 'workshops', 'talk', 'talks', 'lecture', 'book', 'books', 'author', 'library'],
  tech: ['tech', 'startup', 'startups', 'ai', 'hackathon', 'networking', 'meetup', 'founders'],
  community: ['volunteer', 'volunteering', 'community', 'fundraiser', 'charity', 'cleanup'],
};
const REGION_WORDS = {
  'san-francisco': ['san francisco', 'sf', 'the city', 'frisco'],
  'east-bay': ['east bay', 'eastbay', 'tri valley', 'tri-valley', 'contra costa', 'alameda county'],
  peninsula: ['peninsula', 'the peninsula', 'san mateo county', 'coastside'],
  'south-bay': ['south bay', 'silicon valley', 'santa clara county'],
  'north-bay': ['north bay', 'marin', 'wine country', 'sonoma', 'napa valley', 'sonoma county', 'napa county'],
};
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WHEN_WORDS = [
  ['next weekend', 'next-weekend'], ['next week', 'next-week'], ['this weekend', 'weekend'], ['the weekend', 'weekend'], ['weekend', 'weekend'],
  ['tonight', 'tonight'], ['today', 'today'], ['tomorrow', 'tomorrow'], ['this week', 'week'], ['now', 'today'],
  ...DAYS.map((d) => [d, `day:${DAYS.indexOf(d)}`]), ...DAYS.map((d) => [d.slice(0, 3), `day:${DAYS.indexOf(d)}`]),
];
const FILLER = /\b(things?|stuff|to|do|in|at|the|a|an|for|with|and|or|on|near|around|what|whats|what's|is|are|there|any|some|events?|activities|ideas?|fun|best|good|places?|spots?|me|my|i|we|go|going|this|of|happening|show|shows|day|days|night|nights|ideas|stuff)\b/g;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const has = (text, phrase) => new RegExp(`(^|[^a-z0-9+])${esc(phrase)}(?=$|[^a-z0-9+])`).test(text);
const cut = (text, phrase) => text.replace(new RegExp(`(^|[^a-z0-9+])${esc(phrase)}(?=$|[^a-z0-9+])`, 'g'), ' ');

export function parseQuery(input) {
  let t = ` ${String(input || '').toLowerCase().replace(/[’']/g, '').replace(/[^\w+$#\- ]+/g, ' ')} `;
  const out = { vibes: [], cats: [], region: null, city: null, hood: null, when: null, maxPrice: null, nearMe: false, text: '' };

  if (/near me|nearby|close by|around me/.test(t)) { out.nearMe = true; t = t.replace(/near me|nearby|close by|around me/g, ' '); }
  const price = t.match(/(?:under|below|less than|<)\s*\$?(\d+)/);
  if (price) { out.maxPrice = +price[1]; t = t.replace(price[0], ' '); }

  // Places: neighborhoods first (most specific), then cities, then regions.
  const hoods = [...NEIGHBORHOODS].sort((a, b) => b.name.length - a.name.length);
  for (const h of hoods) {
    const names = [h.name.toLowerCase().replace(/[’']/g, ''), ...h.aliases.filter((a) => a.length > 4)];
    const hit = names.find((n) => has(t, n));
    if (hit) { out.hood = h.slug; out.city = h.city; t = cut(t, hit); break; }
  }
  if (!out.city) {
    const cities = [...CITIES].sort((a, b) => b.name.length - a.name.length);
    for (const c of cities) {
      const names = [c.name.toLowerCase(), ...c.aliases].filter((n) => n !== 'sf');
      const hit = names.find((n) => has(t, n));
      if (hit) { out.city = c.slug; t = cut(t, hit); break; }
    }
  }
  for (const [slug, words] of Object.entries(REGION_WORDS)) {
    const hit = words.find((w) => has(t, w));
    if (hit) { if (!out.city) out.region = slug; t = cut(t, hit); break; }
  }
  for (const [phrase, val] of WHEN_WORDS) {
    if (has(t, phrase)) { out.when = out.when || val; t = cut(t, phrase); }
  }
  for (const [slug, words] of Object.entries(VIBE_WORDS)) {
    const hits = words.filter((w) => has(t, w));
    if (hits.length) { out.vibes.push(slug); hits.sort((a, b) => b.length - a.length).forEach((h) => { t = cut(t, h); }); }
  }
  for (const [slug, words] of Object.entries(CAT_WORDS)) {
    const hits = words.filter((w) => has(t, w));
    if (hits.length) { if (!out.cats.includes(slug)) out.cats.push(slug); hits.sort((a, b) => b.length - a.length).forEach((h) => { t = cut(t, h); }); }
  }
  out.text = t.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  return out;
}

const regionName = Object.fromEntries(REGIONS.map((r) => [r.slug, r.name]));
const cityName = Object.fromEntries(CITIES.map((c) => [c.slug, c.name]));
const hoodName = Object.fromEntries(NEIGHBORHOODS.map((n) => [n.slug, n.name]));
const vibeLabel = Object.fromEntries(VIBES.map((v) => [v.slug, `${v.emoji} ${v.name}`]));
const catLabel = Object.fromEntries(CATEGORIES.map((c) => [c.slug, `${c.emoji} ${c.name}`]));
const whenLabel = (w) => (w?.startsWith('day:') ? `📅 ${DAYS[+w.slice(4)][0].toUpperCase()}${DAYS[+w.slice(4)].slice(1)}` : { today: '📅 Today', tonight: '🌙 Tonight', tomorrow: '📅 Tomorrow', weekend: '🎉 This weekend', 'next-week': '🗓️ Next week', 'next-weekend': '🗓️ Next weekend', week: '📅 This week' }[w]);

/** Human-readable chips describing what we understood. */
export function describe(p) {
  const chips = [];
  if (p.when) chips.push(whenLabel(p.when));
  if (p.hood) chips.push(`📍 ${hoodName[p.hood]}`);
  else if (p.city) chips.push(`📍 ${cityName[p.city]}`);
  else if (p.region) chips.push(`📍 ${regionName[p.region]}`);
  p.vibes.forEach((v) => chips.push(vibeLabel[v]));
  p.cats.forEach((c) => chips.push(catLabel[c]));
  if (p.maxPrice != null) chips.push(`💸 Under $${p.maxPrice}`);
  if (p.nearMe) chips.push('🧭 Near me');
  if (p.text) chips.push(`🔎 “${p.text}”`);
  return chips.filter(Boolean);
}

/** Convert parsed query into Explore page URL params. */
export function toParams(p) {
  const q = new URLSearchParams();
  if (p.text) q.set('q', p.text);
  if (p.when) q.set('when', p.when);
  if (p.region) q.set('region', p.region);
  if (p.city) q.set('city', p.city);
  if (p.hood) q.set('hood', p.hood);
  if (p.vibes.length) q.set('vibe', p.vibes.join(','));
  if (p.cats.length) q.set('cat', p.cats.join(','));
  if (p.maxPrice != null) q.set('max', String(p.maxPrice));
  if (p.nearMe) q.set('near', '1');
  return q;
}
