// Upgrades the homepage map to a live Leaflet street map with real region boundaries.
export function initRegionMap() {
  const root = document.querySelector('[data-realmap]');
  if (!root) return;
  const data = JSON.parse(root.dataset.realmap);
  const io = new IntersectionObserver(async (entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    const [{ default: L }, { default: boundaries }] = await Promise.all([import('leaflet'), import('../data/boundaries.json'), import('leaflet/dist/leaflet.css')]);
    const el = root.querySelector('.realmap-live');
    const map = L.map(el, { scrollWheelZoom: false, zoomSnap: 0.25, attributionControl: true }).fitBounds([[37.0, -122.95], [38.55, -121.6]]);
    L.tileLayer(data.tiles, { attribution: data.attr, subdomains: 'abcd', maxZoom: 18 }).addTo(map);
    const byRegion = Object.fromEntries(data.regions.map((r) => [r.slug, r]));
    const layers = {};
    const style = (slug, hover) => ({ color: '#131a2e', weight: hover ? 2.5 : 1, opacity: hover ? 0.9 : 0.45, fillColor: byRegion[slug].fill, fillOpacity: hover ? 0.55 : 0.3 });
    L.geoJSON(boundaries.regions, {
      style: (f) => style(f.properties.region, false),
      onEachFeature: (f, layer) => {
        const slug = f.properties.region;
        (layers[slug] ||= []).push(layer);
        const r = byRegion[slug];
        layer.bindTooltip(`<b>${r.emoji} ${r.name}</b><br>${r.count} things to do · ${f.properties.county} County`, { sticky: true });
        layer.on('mouseover', () => layers[slug].forEach((l) => l.setStyle(style(slug, true))));
        layer.on('mouseout', () => layers[slug].forEach((l) => l.setStyle(style(slug, false))));
        layer.on('click', () => { location.href = r.href; });
      },
    }).addTo(map);
    for (const r of data.regions) {
      L.marker([r.label[1], r.label[0]], { icon: L.divIcon({ className: 'region-tag', html: `<a href="${r.href}">${r.emoji} ${r.name} <b>${r.count}</b></a>`, iconSize: null }) }).addTo(map);
    }
    for (const c of data.cities) {
      L.circleMarker([c.lat, c.lng], { radius: 5, color: '#fff', weight: 2, fillColor: '#ef4b25', fillOpacity: 1 })
        .bindTooltip(`${c.name} · ${c.count}`, { direction: 'top' }).on('click', () => { location.href = c.href; }).addTo(map);
    }
    map.once('click', () => map.scrollWheelZoom.enable());
    root.classList.add('is-live');
  }, { rootMargin: '300px' });
  io.observe(root);
}
