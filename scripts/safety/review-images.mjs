// Content review for organizers' event images, on top of the G/PG safety check: is it a real photo or artwork that
// fits the event, or a logo / text-only flyer / off-topic graphic? Decisions live in data/image-review.json
// ({ ok, by: 'manual' | 'ai', kind }) and only images with ok: true are ever shown.
// With OPENROUTER_API_KEY set, new images are reviewed by a vision model; without it they stay hidden
// (the listing shows a real venue or genre photo instead).
import fs from 'node:fs';

const FILE = new URL('../../data/image-review.json', import.meta.url);
const MODEL = process.env.OPENROUTER_VISION_MODEL || 'google/gemini-3.5-flash-lite';
const SHOW = new Set(['photo', 'artwork', 'headshot']);

export function loadReview() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; }
}

async function ask(item, url, key) {
  const prompt = `You review images for a family-friendly Bay Area events directory.
Event: "${item.title}" (category: ${(item.categories || []).join(', ')}; venue: ${item.venue?.name || 'unknown'}).
Classify the image and answer only JSON: {"kind": "photo" | "artwork" | "headshot" | "text" | "logo", "fits": true|false, "family_friendly": true|false}
- photo: a real photograph (people, performers, a place, food, an activity), even with a little text on it
- artwork: an illustration or poster that is mostly imagery, not words
- headshot: a portrait of the speaker or performer
- text: a flyer or graphic that is mostly words, dates, prices or QR codes
- logo: a logo, wordmark, brand, icon or placeholder image
fits: false if the image clearly has nothing to do with this event. family_friendly: false if it shows or names alcohol-centric partying, drugs, sexual themes, gore or profanity.`;
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, temperature: 0, response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url } }] }] }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const text = (await res.json()).choices?.[0]?.message?.content || '';
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}

/** Reviews approved-safe images that have no decision yet. Mutates nothing on items; returns the review map. */
export async function reviewImages(items, keyOf, { max = Number(process.env.IMAGE_REVIEW_MAX || 300) } = {}) {
  const db = loadReview();
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return db;
  const todo = [...new Map(items.filter((i) => i.image && i.imageSafe && !db[keyOf(i.image)]).map((i) => [keyOf(i.image), i])).values()].slice(0, max);
  let done = 0, hidden = 0;
  for (let n = 0; n < todo.length; n += 6) {
    await Promise.all(todo.slice(n, n + 6).map(async (i) => {
      try {
        const r = await ask(i, i.image, key);
        const ok = SHOW.has(r.kind) && r.fits !== false && r.family_friendly !== false;
        db[keyOf(i.image)] = { ok, by: 'ai', kind: r.kind, at: new Date().toISOString().slice(0, 10) };
        done++;
        if (!ok) hidden++;
      } catch { /* try again next run */ }
    }));
  }
  fs.writeFileSync(FILE, JSON.stringify(db));
  console.log(`image review: ${done} newly reviewed by AI, ${hidden} hidden (logos, text-only flyers, off-topic or not family-friendly)`);
  return db;
}
