// Polite HTTP client: identifies itself, honors robots.txt, retries, and spaces out requests per host.
export const USER_AGENT = process.env.SCRAPER_USER_AGENT ||
  'BayAreaWeekendBot/1.0 (+https://github.com/Baxbyte/BayAreaWeeked; event directory)';

const robotsCache = new Map();
const lastHit = new Map();
const MIN_GAP_MS = Number(process.env.SCRAPER_MIN_GAP_MS || 900);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rawFetch(url, { timeoutMs = 15000, headers = {}, method = 'GET', body } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method, body, signal: ctrl.signal, redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9', ...headers },
    });
    // Read the body under the same deadline so a slow-dribbling server can't hang the run.
    const text = await res.text();
    return { ok: res.ok, status: res.status, text: async () => text };
  } finally {
    clearTimeout(t);
  }
}

function parseRobots(txt) {
  const groups = [];
  let cur = null;
  for (const line of txt.split(/\r?\n/)) {
    const l = line.replace(/#.*/, '').trim();
    if (!l) continue;
    const idx = l.indexOf(':');
    if (idx < 0) continue;
    const k = l.slice(0, idx).trim().toLowerCase();
    const v = l.slice(idx + 1).trim();
    if (k === 'user-agent') {
      if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(v.toLowerCase());
    } else if ((k === 'disallow' || k === 'allow') && cur) {
      cur.rules.push({ allow: k === 'allow', path: v });
    }
  }
  const ua = USER_AGENT.toLowerCase();
  const mine = groups.find((g) => g.agents.some((a) => a !== '*' && ua.includes(a)));
  return (mine || groups.find((g) => g.agents.includes('*')))?.rules || [];
}

function ruleMatches(path, rulePath) {
  if (!rulePath) return false;
  const re = new RegExp('^' + rulePath.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
  return re.test(path);
}

export async function allowedByRobots(url) {
  if (process.env.SCRAPER_IGNORE_ROBOTS === '1') return true;
  const u = new URL(url);
  let rules = robotsCache.get(u.origin);
  if (!rules) {
    try {
      const res = await rawFetch(`${u.origin}/robots.txt`, { timeoutMs: 7000 });
      rules = res.ok ? parseRobots(await res.text()) : [];
    } catch {
      rules = [];
    }
    robotsCache.set(u.origin, rules);
  }
  const path = u.pathname + u.search;
  let best = null;
  for (const r of rules) {
    if (ruleMatches(path, r.path) && (!best || r.path.length > best.path.length)) best = r;
  }
  return !best || best.allow;
}

async function politeWait(url) {
  const host = new URL(url).host;
  const last = lastHit.get(host) || 0;
  const wait = last + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

export async function fetchText(url, opts = {}) {
  if (!opts.skipRobots && !(await allowedByRobots(url))) throw new Error(`robots.txt disallows ${url}`);
  let lastErr;
  for (let attempt = 0; attempt < (opts.retries ?? 1) + 1; attempt++) {
    await politeWait(url);
    try {
      const res = await rawFetch(url, opts);
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} for ${url}`);
        err.fatal = true;
        throw err;
      }
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (e.fatal) break;
      await sleep(1500 * (attempt + 1));
    }
  }
  throw lastErr;
}

export async function fetchJSON(url, opts = {}) {
  const txt = await fetchText(url, { ...opts, headers: { Accept: 'application/json', ...(opts.headers || {}) } });
  return JSON.parse(txt);
}
