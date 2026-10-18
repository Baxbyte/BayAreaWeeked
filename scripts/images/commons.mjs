// Wikimedia Commons helpers shared by the photo candidate finder and the photo builder.
export const UA = 'BayAreaWeekendBot/1.0 (https://github.com/Baxbyte/BayAreaWeeked; photo credits at /photo-credits/)';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();

// Never show these (checked against title, description AND Commons categories).
export const NSFW = /\b(nude|nudity|naked|nudist|naturist|topless|lingerie|bikini|bikinis|swimsuit|swimwear|underwear|glamour|pin-?up|sexy|erotic|fetish|bdsm|models? \(people\)|boudoir)\b/i;
// Usually not attractive as a lead image.
export const DULL = /\b(map|logo|diagram|seal|flag of|chart|floor plan|svg|icon|drawing|illustration|engraving|poster|postcard|lithograph|sketch|blueprint|habs|haer|construction|demolition|aerial|satellite|screenshot|document|letter|plaque|sign|signage|placard|label|text|dead|carcass|corpse|injured|accident|crash|fire|smoke|protest|riot|police|arrest|homeless|grave|cemetery|funeral)\b/i;
export const PEOPLE = /\b(crowd|crowds|people|visitors|tourists|festival|parade|fans|audience|families|family|children|kids|market|runners|dancers|dancing|performers|band|concert|shoppers|picnic|friends|spectators|participants|marchers|celebrat|cyclists|hikers|surfers|diners|couple)/i;

export async function getJSON(url, headers = {}) {
  for (let i = 0; i < 3; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: ctrl.signal });
      clearTimeout(t);
      if (res.status === 429) { await sleep(6000 * (i + 1)); continue; }
      if (!res.ok) return null;
      return await res.json();
    } catch { await sleep(2000); }
  }
  return null;
}

const api = (params) => `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`;

/** Turn Commons pages into photo records. `strict` applies the "dull" filter too. */
export function toPhotos(pages, { width = 1280, strict = true, must = [] } = {}) {
  const out = [];
  for (const p of Object.values(pages || {})) {
    const ii = p.imageinfo?.[0];
    if (!ii || ii.mime !== 'image/jpeg' || ii.width < 1200 || ii.width < ii.height * 1.2 || ii.width > ii.height * 2.4) continue;
    const m = ii.extmetadata || {};
    const license = strip(m.LicenseShortName?.value);
    if (!/^(CC BY|CC0|Public domain|PD)/i.test(license) || /NC|ND/.test(license)) continue;
    const title = p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '').replace(/_/g, ' ');
    const desc = strip(m.ImageDescription?.value).slice(0, 300);
    const cats = strip(m.Categories?.value).replace(/\|/g, ' ');
    if (NSFW.test(`${title} ${desc} ${cats}`)) continue;
    if (strict && DULL.test(`${title} ${desc}`)) continue;
    if (must.length && !must.every((w) => `${title} ${desc} ${cats}`.toLowerCase().includes(w.toLowerCase()))) continue;
    const lat = Number(strip(m.GPSLatitude?.value));
    const lng = Number(strip(m.GPSLongitude?.value));
    if (lat && lng && !(lat > 36.9 && lat < 38.8 && lng > -123.2 && lng < -121.4)) continue;
    const year = Number((strip(m.DateTimeOriginal?.value).match(/\b(19|20)\d\d\b/) || [])[0]);
    if (year && year < 2005) continue;
    out.push({
      pageid: p.pageid, id: `wm-${p.pageid}`, title, url: ii.thumburl || ii.url, width,
      score: (PEOPLE.test(`${title} ${desc} ${cats}`) ? 4 : 0) + (year >= 2015 ? 2 : year >= 2010 ? 1 : 0) + (ii.width >= 2400 ? 1 : 0),
      alt: desc && desc.length < 160 ? desc : title, credit: strip(m.Artist?.value).slice(0, 80) || 'Wikimedia Commons contributor',
      creditUrl: ii.descriptionurl, source: 'Wikimedia Commons', license, licenseUrl: strip(m.LicenseUrl?.value) || ii.descriptionurl,
    });
  }
  return out;
}

const ii = (width) => ({ prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: String(width) });

export async function fromCategory(cat, { depth = 1, width = 1280, strict = true } = {}) {
  const data = await getJSON(api({ action: 'query', generator: 'categorymembers', gcmtitle: `Category:${cat}`, gcmtype: 'file', gcmlimit: '100', ...ii(width) }));
  await sleep(250);
  let out = toPhotos(data?.query?.pages, { width, strict });
  if (out.length < 12 && depth > 0) {
    const subs = (await getJSON(api({ action: 'query', list: 'categorymembers', cmtitle: `Category:${cat}`, cmtype: 'subcat', cmlimit: '15' })))?.query?.categorymembers || [];
    for (const s of subs.filter((x) => !NSFW.test(x.title) && !DULL.test(x.title)).slice(0, 6)) {
      out = out.concat(await fromCategory(s.title.replace(/^Category:/, ''), { depth: depth - 1, width, strict }));
    }
  }
  return out;
}

export async function fromSearch(query, must, { width = 1280 } = {}) {
  const data = await getJSON(api({ action: 'query', generator: 'search', gsrsearch: `filetype:bitmap ${query}`, gsrnamespace: '6', gsrlimit: '50', ...ii(width) }));
  await sleep(250);
  return toPhotos(data?.query?.pages, { width, must });
}

/** Fetch specific files by page id (used for hand-picked photos). */
export async function byPageIds(ids, { width = 1280 } = {}) {
  const out = [];
  for (let i = 0; i < ids.length; i += 40) {
    const data = await getJSON(api({ action: 'query', pageids: ids.slice(i, i + 40).join('|'), ...ii(width) }));
    out.push(...toPhotos(data?.query?.pages, { width, strict: false }));
    await sleep(250);
  }
  return out;
}
