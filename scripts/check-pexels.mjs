#!/usr/bin/env node
// Build-time check that the Pexels key works. Logs only the result, never the key. Never fails the build.
const key = process.env.PEXELS_API_KEY || process.env.PEXELS_KEY || process.env.Pexels_API || process.env.PEXELS_API || '';
if (!key) {
  console.log('pexels-check: no Pexels key in this environment');
} else {
  try {
    const res = await fetch('https://api.pexels.com/v1/search?query=san%20francisco&per_page=1', { headers: { Authorization: key }, signal: AbortSignal.timeout(10000) });
    const n = res.ok ? (await res.json()).total_results : 0;
    console.log(res.ok ? `pexels-check: key works (${n} San Francisco photos available)` : `pexels-check: key rejected (HTTP ${res.status})`);
  } catch (e) {
    console.log(`pexels-check: could not reach Pexels (${e.name})`);
  }
}
