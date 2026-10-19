import { downloadIcs } from './ics.js';
import { toast } from './saves.js';

export function initDetail() {
  document.querySelectorAll('[data-ics]').forEach((b) => b.addEventListener('click', () => {
    const e = JSON.parse(b.dataset.ics);
    downloadIcs([e], `${e.t.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.ics`);
  }));
  document.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', async () => {
    const url = b.dataset.share;
    try {
      if (navigator.share) await navigator.share({ title: b.dataset.title, url });
      else { await navigator.clipboard.writeText(url); toast('🔗 Link copied'); }
    } catch { /* cancelled */ }
  }));
}
