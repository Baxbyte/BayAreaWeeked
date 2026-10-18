// Site-wide settings. Override with environment variables at build time (see .env.example).
const env = (k, d) => (typeof process !== 'undefined' && process.env[k]) || d;

export const SITE_URL = env('SITE_URL', 'https://baxbyte.github.io/BayAreaWeeked').replace(/\/$/, '');
export const BASE_PATH = new URL(SITE_URL).pathname.replace(/\/$/, ''); // '' or '/BayAreaWeeked'

export const SITE = {
  name: env('SITE_NAME', 'Bay Area Weekend'),
  shortName: env('SITE_SHORT_NAME', 'BayWknd'),
  tagline: 'The fun, fresh guide to what’s happening across the San Francisco Bay Area — updated every day.',
  url: SITE_URL,
  locale: 'en_US',
  twitter: env('SITE_TWITTER', ''),
  contactEmail: env('PUBLIC_CONTACT_EMAIL', ''),
  // V2 email + sponsor forms post JSON here (e.g. Formspree, Buttondown, a Google Apps Script, or your own API).
  signupEndpoint: env('PUBLIC_SIGNUP_ENDPOINT', ''),
  sponsorEndpoint: env('PUBLIC_SPONSOR_ENDPOINT', env('PUBLIC_SIGNUP_ENDPOINT', '')),
  indexNowKey: env('INDEXNOW_KEY', 'b7a1f0c2d9e84f6aa3c5e1d2f4b6a8c0'),
  googleVerification: env('GOOGLE_SITE_VERIFICATION', ''),
  bingVerification: env('BING_SITE_VERIFICATION', ''),
  analyticsScript: env('PUBLIC_ANALYTICS_SNIPPET_URL', ''),
  tiles: env('PUBLIC_MAP_TILES', 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'),
  tilesAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

/** Internal link that respects the deploy base path. Always ends with "/" for pages. */
export function link(path = '/') {
  if (/^https?:/.test(path)) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  const withSlash = /\.[a-z0-9]+$/i.test(p) || p.includes('?') || p.includes('#') || p.endsWith('/') ? p : `${p}/`;
  return `${BASE_PATH}${withSlash}`;
}

export const absolute = (path) => `${SITE_URL}${link(path).slice(BASE_PATH.length)}`;
