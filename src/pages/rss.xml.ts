// RSS feed of newly added events — helps feed readers, aggregators and search engines discover new pages fast.
import { EVENTS, DATA } from '../lib/data.mjs';
import { SITE, absolute } from '../lib/site.mjs';
import { formatWhen } from '../lib/time.mjs';
import { placeLine } from '../lib/format.mjs';

const x = (s) => String(s ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

export function GET() {
  const items = [...EVENTS].sort((a, b) => (b.firstSeen || '').localeCompare(a.firstSeen || '')).slice(0, 150);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>${x(SITE.name)} — New Bay Area events</title>
<link>${absolute('/')}</link>
<atom:link href="${absolute('/rss.xml')}" rel="self" type="application/rss+xml" />
<atom:link rel="hub" href="https://pubsubhubbub.appspot.com/" />
<description>${x(SITE.tagline)}</description>
<language>en-us</language>
<lastBuildDate>${new Date(DATA.generatedAt || Date.now()).toUTCString()}</lastBuildDate>
<ttl>360</ttl>
${items.map((i) => `<item>
<title>${x(i.title)} — ${x(formatWhen(i))}</title>
<link>${absolute(i.path)}</link>
<guid isPermaLink="true">${absolute(i.path)}</guid>
<pubDate>${new Date(i.firstSeen || DATA.generatedAt || Date.now()).toUTCString()}</pubDate>
<description>${x(`${formatWhen(i)} · ${placeLine(i)}. ${i.description || ''}`.slice(0, 400))}</description>
${i.categories.map((c) => `<category>${x(c)}</category>`).join('')}
${i.image ? `<media:content url="${x(i.image)}" medium="image" />` : ''}
</item>`).join('\n')}
</channel>
</rss>`;
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
