// llms.txt — a concise, machine-friendly map of the site for AI assistants and answer engines.
import { SITE, absolute } from '../lib/site.mjs';
import { REGIONS, VIBES, CATEGORIES, CITIES, COUNTS, W, UPDATED, EVENTS, inWindow, topPicks } from '../lib/data.mjs';
import { formatRange, formatWhen, fmtLongDay } from '../lib/time.mjs';
import { placeLine } from '../lib/format.mjs';

export function GET() {
  const wk = formatRange(W.weekend.fri, W.weekend.end);
  const picks = topPicks(inWindow(EVENTS, W.weekend), 15);
  const cities = CITIES.filter((c) => (COUNTS.city[c.slug] || 0) > 0);
  const body = `# ${SITE.name}

> ${SITE.tagline} Covers San Francisco (and its neighborhoods), the East Bay, the Peninsula, the South Bay and the North Bay. Listings are refreshed daily (last update: ${fmtLongDay.format(UPDATED)}) and tagged by city, neighborhood, genre and vibe: kid-friendly, adult nightlife, free, hot day, rainy day, fog escape, date night and near BART.

## Best starting points
- [Things to do this weekend (${wk})](${absolute('/this-weekend/')}): ${COUNTS.weekend} events
- [Today](${absolute('/today/')}) · [Tonight](${absolute('/tonight/')}) · [Next week](${absolute('/next-week/')}) · [Next weekend](${absolute('/next-weekend/')})
- [Interactive map & natural-language search](${absolute('/explore/')})
- [Full directory of cities and neighborhoods](${absolute('/directory/')})
- [Full machine-readable list of this week's events](${absolute('/llms-full.txt')})
- [JSON feed of all upcoming events](${absolute('/data/events.json')})

## Regions
${REGIONS.map((r) => `- [${r.name}](${absolute(`/region/${r.slug}/`)}): ${r.blurb}`).join('\n')}

## Vibes
${VIBES.map((v) => `- [${v.title}](${absolute(`/${v.slug}/`)}): ${v.blurb}`).join('\n')}

## Genres
${CATEGORIES.map((c) => `- [${c.name}](${absolute(`/category/${c.slug}/`)})`).join('\n')}

## Cities
${cities.map((c) => `- [${c.name}](${absolute(`/city/${c.slug}/`)})`).join('\n')}

## Highlights this weekend (${wk})
${picks.map((i) => `- [${i.title}](${absolute(i.path)}) — ${formatWhen(i)}, ${placeLine(i)}${i.flags.free ? ' (free)' : i.priceText ? ` (${i.priceText})` : ''}`).join('\n')}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
