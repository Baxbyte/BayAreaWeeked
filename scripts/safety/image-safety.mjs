// Family-friendly image gate (G/PG only). Every photo the site can show passes through here:
// hand-picked photos, Pexels photos and organizers' event images. It FAILS CLOSED: anything flagged,
// unreadable or unverifiable is treated as unsafe and never shown.
//
// Uses the open-source NSFWJS classifier (runs locally; nothing is uploaded anywhere).
// The whole image AND a center crop are both checked; either one tripping a threshold rejects it.
import * as tf from '@tensorflow/tfjs';
import * as nsfwjs from 'nsfwjs';
import sharp from 'sharp';

// Deliberately strict. False positives just mean a different (safe) photo is used.
export const LIMITS = { Porn: 0.08, Hentai: 0.08, Sexy: 0.3 };

let modelPromise;
const silence = () => { const w = console.warn; console.warn = () => {}; return () => { console.warn = w; }; };
function model() {
  if (!modelPromise) {
    const restore = silence();
    modelPromise = (async () => {
      // Use TensorFlow's native engine when installed (CI installs it; ~20x faster), else plain JS.
      try { await import('@tensorflow/tfjs-node'); } catch { /* pure-JS fallback */ }
      return nsfwjs.load('MobileNetV2');
    })().finally(restore);
  }
  return modelPromise;
}

async function classify(buf, fit) {
  const { data, info } = await sharp(buf).rotate().resize(224, 224, { fit, background: '#000' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const img = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3]);
  try {
    return Object.fromEntries((await (await model()).classify(img, 5)).map((p) => [p.className, p.probability]));
  } finally {
    img.dispose();
  }
}

/** @returns {Promise<{safe:boolean, scores?:object, reason?:string}>} */
export async function checkImage(input) {
  try {
    const buf = typeof input === 'string' ? await sharp(input).toBuffer() : input;
    const views = [await classify(buf, 'contain'), await classify(buf, 'cover')];
    for (const s of views) {
      for (const [cls, max] of Object.entries(LIMITS)) {
        if ((s[cls] || 0) >= max) return { safe: false, scores: s, reason: `${cls} ${(s[cls] * 100).toFixed(0)}%` };
      }
    }
    return { safe: true, scores: views[0] };
  } catch (e) {
    return { safe: false, reason: `unreadable: ${e.message}` };
  }
}

/** Download a remote image (max 6 MB) and check it. */
export async function checkRemoteImage(url, { timeoutMs = 12000, userAgent } = {}) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal, headers: userAgent ? { 'User-Agent': userAgent } : {} });
    const ab = res.ok ? await res.arrayBuffer() : null;
    clearTimeout(t);
    if (!ab) return { safe: false, reason: `HTTP ${res.status}` };
    if (ab.byteLength > 6e6) return { safe: false, reason: 'too large to verify' };
    if (!(res.headers.get('content-type') || '').startsWith('image/')) return { safe: false, reason: 'not an image' };
    return await checkImage(Buffer.from(ab));
  } catch (e) {
    return { safe: false, reason: `unverifiable: ${e.name}` };
  }
}
