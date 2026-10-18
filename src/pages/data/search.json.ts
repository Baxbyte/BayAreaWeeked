// Compact index used by the Explore map, smart search, Spin the Bay and My Plan.
import { EVENTS, ACTIVITIES, DATA } from '../../lib/data.mjs';
import { toIndexRecord } from '../../lib/format.mjs';
import { link } from '../../lib/site.mjs';

export function GET() {
  const items = [...EVENTS, ...ACTIVITIES].map((i) => toIndexRecord(i, link));
  return new Response(JSON.stringify({ generatedAt: DATA.generatedAt, items }), { headers: { 'Content-Type': 'application/json' } });
}
