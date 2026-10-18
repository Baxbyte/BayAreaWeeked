#!/usr/bin/env node
// Circuit breaker for scheduled workflows (test-mode safety limit).
// If this workflow has failed 3 times within any 24-hour span, it pauses until 24 hours after that 3rd failure.
// Writes `paused=true|false` to $GITHUB_OUTPUT. Bypass with the workflow_dispatch input `force: true`.
//   env: GITHUB_TOKEN, GITHUB_REPOSITORY, WORKFLOW_FILE, FORCE
import fs from 'node:fs';

const MAX_FAILURES = 3;
const WINDOW_MS = 24 * 3600 * 1000;
const PAUSE_MS = 24 * 3600 * 1000;

const out = (paused, why) => {
  console.log(`${paused ? '⏸️  PAUSED' : '▶️  OK to run'} — ${why}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `paused=${paused}\n`);
};

if (process.env.FORCE === 'true') {
  out(false, 'manual override (force=true)');
} else {
  const since = new Date(Date.now() - WINDOW_MS - PAUSE_MS).toISOString();
  const url = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/${process.env.WORKFLOW_FILE}/runs?status=failure&per_page=100&created=>${since}`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const runs = (await res.json()).workflow_runs || [];
    const times = runs.map((r) => Date.parse(r.updated_at || r.created_at)).sort((a, b) => a - b);
    let pausedUntil = 0;
    for (let i = 0; i + MAX_FAILURES - 1 < times.length; i++) {
      const third = times[i + MAX_FAILURES - 1];
      if (third - times[i] <= WINDOW_MS) pausedUntil = Math.max(pausedUntil, third + PAUSE_MS);
    }
    if (pausedUntil > Date.now()) out(true, `${MAX_FAILURES} failures within 24h; paused until ${new Date(pausedUntil).toISOString()} (run manually with force=true to override)`);
    else out(false, `not paused (${times.length} failure(s) in the last 48h, never 3 within 24h recently)`);
  } catch (e) {
    // If we can't check, play it safe and pause (test mode).
    out(true, `could not check failure history (${e.message}); pausing to be safe`);
  }
}
