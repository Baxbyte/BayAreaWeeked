// JSON Feed 1.1 of newly added events.
import { EVENTS, DATA } from '../lib/data.mjs';
import { SITE, absolute } from '../lib/site.mjs';
import { formatWhen } from '../lib/time.mjs';
import { placeLine } from '../lib/format.mjs';

export function GET() {
  const items = [...EVENTS].sort((a, b) => (b.firstSeen || '').localeCompare(a.firstSeen || '')).slice(0, 150);
  const feed = {
    version: 'https://jsonfeed.org/version/1.1', title: `${SITE.name} — New Bay Area events`, home_page_url: absolute('/'), feed_url: absolute('/feed.json'),
    description: SITE.tagline, language: 'en-US',
    items: items.map((i) => ({
      id: absolute(i.path), url: absolute(i.path), title: `${i.title} — ${formatWhen(i)}`, summary: `${formatWhen(i)} · ${placeLine(i)}`,
      content_text: i.description || '', image: i.image || undefined, date_published: i.firstSeen || DATA.generatedAt, date_modified: i.updatedAt || undefined, tags: i.categories,
    })),
  };
  return new Response(JSON.stringify(feed), { headers: { 'Content-Type': 'application/feed+json; charset=utf-8' } });
}
