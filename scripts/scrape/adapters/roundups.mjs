// News & blog roundups ("things to do this weekend") → structured events, using an LLM via OpenRouter.
// Optional: set OPENROUTER_API_KEY. We extract facts only (name, date, place, price, link) and write our own short blurbs.
import * as cheerio from 'cheerio';
import { fetchText } from '../http.mjs';
import { parseFeed } from './rss.mjs';
import { toPTISO } from '../../../src/lib/time.mjs';

const ROUNDUP_RE = /(things to do|this weekend|weekend guide|best bets|events? (this|next) week|what to do|weekend events|calendar|happening|picks|where to go)/i;

function articleText(html) {
  const $ = cheerio.load(html);
  $('script,style,nav,header,footer,aside,form,noscript,iframe').remove();
  const root = $('article').first().length ? $('article').first() : $('main').first().length ? $('main').first() : $('body');
  const lines = [];
  root.find('h1,h2,h3,h4,p,li').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    const a = $(el).find('a[href^="http"]').first().attr('href');
    if (t.length > 2) lines.push(a ? `${t} [link: ${a}]` : t);
  });
  return lines.join('\n').slice(0, 14000);
}

async function extract(article, meta, model) {
  const prompt = `You extract Bay Area (California) events from a news/blog roundup article or an events calendar page.
Article title: ${meta.title}
Published: ${meta.published}
Today (Pacific): ${meta.today}

Return ONLY JSON: {"events":[{"title":"","date":"YYYY-MM-DD","end_date":"YYYY-MM-DD or null","time":"HH:MM 24h or null","venue":"","address":"","city":"","price":"e.g. Free, $25, $10-$40 or null","url":"event link from the article or null","summary":"one neutral sentence in your own words, max 30 words","kid_friendly":true|false,"adults_only":true|false}]}
Rules: only events with a specific date on or after today within the next 21 days; skip vague or ongoing items without dates; never invent details that are not in the text; city must be a Bay Area city.

ARTICLE:
${article}`;
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'Bay Area Weekend' },
    body: JSON.stringify({ model, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
  const data = await res.json();
  const txt = data.choices?.[0]?.message?.content || '{}';
  const json = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
  return json.events || [];
}

export async function run(src, ctx) {
  if (!process.env.OPENROUTER_API_KEY) return ctx.skip('OPENROUTER_API_KEY not set');
  const model = process.env.OPENROUTER_MODEL || src.model || 'anthropic/claude-haiku-5.5';
  const out = [];
  let budget = src.maxArticles || 12;
  // Venue / organization calendar pages that don't publish structured data: read the page directly.
  for (const page of src.pages || []) {
    if (budget-- <= 0) break;
    try {
      const text = articleText(await fetchText(page.url));
      const events = await extract(text, { title: `${page.name} events calendar`, published: 'current', today: toPTISO(ctx.now).slice(0, 10) }, model);
      for (const e of events) {
        if (!e.title || !e.date) continue;
        out.push({
          sourceId: `${src.id}-${page.id}`, sourceName: page.name, sourceHome: page.url,
          externalId: `${e.title}:${e.date}`, title: e.title, description: e.summary || '', url: e.url ? new URL(e.url, page.url).toString() : page.url,
          start: e.time ? `${e.date}T${e.time}` : e.date, end: e.end_date || null,
          venueName: e.venue || null, address: [e.address, e.city].filter(Boolean).join(', '), city: e.city || null,
          priceText: e.price || null, tags: [],
          forceFlags: { ...(e.kid_friendly ? { kids: true } : {}), ...(e.adults_only ? { adult: true, kids: false } : {}) },
        });
      }
    } catch (e) {
      ctx.warn(`${src.id}/${page.id}: ${e.message}`);
    }
  }
  for (const feed of src.feeds || []) {
    let items;
    try {
      items = parseFeed(await fetchText(feed.url));
    } catch (e) {
      ctx.warn(`${src.id}/${feed.name}: ${e.message}`);
      continue;
    }
    const fresh = items.filter((it) => ROUNDUP_RE.test(it.title) && (!it.pubDate || Date.now() - Date.parse(it.pubDate) < 9 * 86400000));
    for (const it of fresh.slice(0, feed.max || 3)) {
      if (budget-- <= 0) break;
      try {
        const text = articleText(await fetchText(it.link));
        const events = await extract(text, { title: it.title, published: it.pubDate, today: toPTISO(ctx.now).slice(0, 10) }, model);
        for (const e of events) {
          if (!e.title || !e.date) continue;
          out.push({
            sourceId: `${src.id}-${feed.id}`, sourceName: feed.name, sourceHome: it.link,
            externalId: `${e.title}:${e.date}`,
            title: e.title, description: e.summary || '',
            url: e.url || it.link,
            start: e.time ? `${e.date}T${e.time}` : e.date, end: e.end_date || null,
            venueName: e.venue || null, address: [e.address, e.city].filter(Boolean).join(', '), city: e.city || null,
            priceText: e.price || null,
            tags: [],
            forceFlags: { ...(e.kid_friendly ? { kids: true } : {}), ...(e.adults_only ? { adult: true, kids: false } : {}) },
          });
        }
      } catch (e) {
        ctx.warn(`${src.id}/${feed.name}: ${e.message}`);
      }
    }
  }
  return out;
}
