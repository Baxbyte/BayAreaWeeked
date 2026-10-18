// Complete plain-text list of the next 8 days of events, grouped by region — ideal for AI answer engines.
import { SITE, absolute } from '../lib/site.mjs';
import { REGIONS, EVENTS, ACTIVITIES, W, UPDATED, inWindow, filterItems, categoryBySlug } from '../lib/data.mjs';
import { formatWhen, fmtLongDay, addPTDays } from '../lib/time.mjs';
import { placeLine } from '../lib/format.mjs';

const flags = (i) => [i.flags.free && 'free', i.flags.kids && 'kid-friendly', i.flags.adult ? '21+' : i.flags.nightlife && 'nightlife', i.flags.rainy && 'indoor/rainy-day', i.flags.hot && 'hot-day', i.flags.bart && `near ${i.flags.bart} BART`].filter(Boolean).join(', ');

export function GET() {
  const win = { start: W.today.start, end: addPTDays(W.today.start, 8) };
  const upcoming = inWindow(EVENTS, win);
  const body = `# ${SITE.name} — every event in the next 8 days
Updated ${fmtLongDay.format(UPDATED)}. ${upcoming.length} events. Source pages: ${absolute('/')}

${REGIONS.map((r) => {
    const list = filterItems(upcoming, { region: r.slug });
    const acts = filterItems(ACTIVITIES, { region: r.slug });
    return `## ${r.name}
${list.map((i) => `- ${i.title} | ${formatWhen(i)} | ${placeLine(i)} | ${i.priceText || ''} | ${i.categories.map((c) => categoryBySlug[c].name).join('/')} | ${flags(i)} | ${absolute(i.path)}`).join('\n') || '- (no dated events listed yet)'}

### Always-open favorites in ${r.name}
${acts.map((i) => `- ${i.title} | ${placeLine(i)} | ${i.priceText || ''} | ${flags(i)} | ${absolute(i.path)}`).join('\n')}
`;
  }).join('\n')}`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
