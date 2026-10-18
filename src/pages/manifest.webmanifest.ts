import { SITE, link } from '../lib/site.mjs';
export function GET() {
  return new Response(JSON.stringify({
    name: SITE.name, short_name: SITE.shortName, start_url: link('/'), display: 'standalone', background_color: '#fbf7f0', theme_color: '#ef4b25',
    icons: [{ src: link('/favicon.svg'), sizes: 'any', type: 'image/svg+xml' }, { src: link('/apple-touch-icon.png'), sizes: '180x180', type: 'image/png' }],
  }), { headers: { 'Content-Type': 'application/manifest+json' } });
}
