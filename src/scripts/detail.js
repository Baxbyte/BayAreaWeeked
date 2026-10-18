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

  // Lazy-load the mini map only when it scrolls into view.
  const el = document.getElementById('mini-map');
  if (!el) return;
  const io = new IntersectionObserver(async (entries) => {
    if (!entries.some((x) => x.isIntersecting)) return;
    io.disconnect();
    const [{ default: L }] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
    const lat = +el.dataset.lat;
    const lng = +el.dataset.lng;
    const map = L.map(el, { scrollWheelZoom: false, zoomControl: false, attributionControl: true }).setView([lat, lng], 14);
    L.tileLayer(el.dataset.tiles, { attribution: el.dataset.attr, subdomains: 'abcd', maxZoom: 19 }).addTo(map);
    L.marker([lat, lng], { icon: L.divIcon({ className: '', html: `<div class="pin"><span>${el.dataset.emoji}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 30] }) }).addTo(map);
  }, { rootMargin: '200px' });
  io.observe(el);
}
