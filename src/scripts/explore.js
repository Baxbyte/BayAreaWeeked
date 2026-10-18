import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import L from 'leaflet';
import MiniSearch from 'minisearch';
import { REGIONS, CITIES } from '../lib/geo.mjs';
import { categoryBySlug } from '../lib/taxonomy.mjs';
import { applyFilters, cardHTML, escHtml, loadIndex, placeOf, sortItems } from './render.js';
import { describe, parseQuery } from './smart.js';
import { formatWhen } from '../lib/time.mjs';
import { fetchForecast, suggestMood } from './weather.js';
import boundaries from '../data/boundaries.json';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const PAGE = 30;

export async function initExplore() {
  const root = $('[data-explore]');
  if (!root) return;
  window.L = L;
  await import('leaflet.markercluster');

  const st = { q: '', when: 'any', region: '', city: '', hood: '', cats: [], vibes: [], moods: [], maxPrice: null, includeActivities: true, sort: 'date', origin: null };
  let shown = PAGE;
  let items = [];
  let mini;
  let results = [];

  // ---------- URL <-> state ----------
  const params = new URLSearchParams(location.search);
  const parsedFromQ = params.get('q') ? parseQuery(params.get('q')) : null;
  st.q = parsedFromQ ? parsedFromQ.text : '';
  st.when = params.get('when') || parsedFromQ?.when || 'any';
  st.region = params.get('region') || parsedFromQ?.region || '';
  st.city = params.get('city') || parsedFromQ?.city || '';
  st.hood = params.get('hood') || parsedFromQ?.hood || '';
  st.cats = (params.get('cat') || '').split(',').filter(Boolean).concat(parsedFromQ?.cats || []);
  const allVibes = (params.get('vibe') || '').split(',').filter(Boolean).concat(parsedFromQ?.vibes || []);
  const MOODS = ['hot-day', 'rainy-day', 'fog-escape', 'date-night'];
  st.vibes = [...new Set(allVibes.filter((v) => !MOODS.includes(v)))];
  st.moods = [...new Set(allVibes.filter((v) => MOODS.includes(v)))];
  if (params.get('max') != null) st.maxPrice = +params.get('max');
  if (parsedFromQ?.maxPrice != null) st.maxPrice = parsedFromQ.maxPrice;
  if (params.get('near') === '1' || parsedFromQ?.nearMe) st.sort = 'near';
  if (params.get('q')) $('#sq').value = params.get('q');

  function syncURL() {
    const q = new URLSearchParams();
    if (st.q) q.set('q', st.q);
    if (st.when !== 'any') q.set('when', st.when);
    if (st.region) q.set('region', st.region);
    if (st.city) q.set('city', st.city);
    if (st.hood) q.set('hood', st.hood);
    if (st.cats.length) q.set('cat', st.cats.join(','));
    const v = [...st.vibes, ...st.moods];
    if (v.length) q.set('vibe', v.join(','));
    if (st.maxPrice != null) q.set('max', String(st.maxPrice));
    history.replaceState(null, '', `${location.pathname}${q.toString() ? `?${q}` : ''}`);
  }

  // ---------- Controls ----------
  function paintControls() {
    $$('[data-when]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.when === st.when)));
    $('[data-date]').value = /^\d{4}-/.test(st.when) ? st.when : '';
    $$('[data-region]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.region === st.region)));
    $$('[data-city] option').forEach((o) => { o.hidden = !!(st.region && o.value && o.dataset.region !== st.region); });
    $('[data-city]').value = st.city;
    $$('[data-hood] option').forEach((o) => { o.hidden = !!(o.value && st.city && o.dataset.city !== st.city); });
    $('[data-hood]').value = st.hood;
    $$('[data-vibe]').forEach((c) => { c.checked = st.vibes.includes(c.dataset.vibe); });
    $$('[data-mood]').forEach((b) => b.setAttribute('aria-pressed', String(st.moods.includes(b.dataset.mood))));
    $$('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', String(st.cats.includes(b.dataset.cat))));
    $('[data-max]').value = st.maxPrice == null ? '' : String(st.maxPrice);
    $('[data-acts]').checked = st.includeActivities;
    $('[data-sort]').value = st.sort;
  }
  const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const changed = () => { shown = PAGE; paintControls(); update(); };

  $$('[data-when]').forEach((b) => b.addEventListener('click', () => { st.when = b.dataset.when; changed(); }));
  $('[data-date]').addEventListener('change', (e) => { st.when = e.target.value || 'any'; changed(); });
  $$('[data-region]').forEach((b) => b.addEventListener('click', () => { st.region = b.dataset.region; st.city = ''; st.hood = ''; changed(); flyToRegion(); }));
  $('[data-city]').addEventListener('change', (e) => {
    st.city = e.target.value; st.hood = '';
    const c = CITIES.find((x) => x.slug === st.city);
    if (c) st.region = c.region;
    changed(); flyToCity(c);
  });
  $('[data-hood]').addEventListener('change', (e) => {
    st.hood = e.target.value;
    const opt = e.target.selectedOptions[0];
    if (st.hood && opt?.dataset.city) { st.city = opt.dataset.city; st.region = CITIES.find((c) => c.slug === st.city)?.region || st.region; }
    changed();
  });
  $$('[data-vibe]').forEach((c) => c.addEventListener('change', () => { st.vibes = toggle(st.vibes, c.dataset.vibe); changed(); }));
  $$('[data-mood]').forEach((b) => b.addEventListener('click', () => { st.moods = toggle(st.moods, b.dataset.mood); changed(); }));
  $$('[data-cat]').forEach((b) => b.addEventListener('click', () => { st.cats = toggle(st.cats, b.dataset.cat); changed(); }));
  $('[data-max]').addEventListener('change', (e) => { st.maxPrice = e.target.value === '' ? null : +e.target.value; changed(); });
  $('[data-acts]').addEventListener('change', (e) => { st.includeActivities = e.target.checked; changed(); });
  $('[data-sort]').addEventListener('change', async (e) => { st.sort = e.target.value; if (st.sort === 'near') await locate(); changed(); });
  $('[data-reset]').addEventListener('click', () => {
    Object.assign(st, { q: '', when: 'any', region: '', city: '', hood: '', cats: [], vibes: [], moods: [], maxPrice: null, includeActivities: true, sort: 'date' });
    $('#sq').value = ''; $('[data-parsed]').innerHTML = ''; changed(); map.setView([37.75, -122.25], 9);
  });
  $('[data-more]').addEventListener('click', () => { shown += PAGE; renderList(); });
  $$('[data-view-btn]').forEach((b) => b.addEventListener('click', () => {
    root.dataset.view = b.dataset.viewBtn;
    $$('[data-view-btn]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    setTimeout(() => map.invalidateSize(), 50);
  }));
  $('[data-toggle-filters]').addEventListener('click', () => {
    const f = $('.filters');
    f.dataset.collapsed = f.dataset.collapsed === 'true' ? 'false' : 'true';
  });
  if (matchMedia('(max-width: 1023px)').matches) $('.filters').dataset.collapsed = 'true';

  // Smart search: parse as you type, apply on submit/debounce.
  let tmr;
  const smartInput = $('#sq');
  const applySmart = () => {
    const p = parseQuery(smartInput.value);
    $('[data-parsed]').innerHTML = describe(p).map((c) => `<span class="tag">${escHtml(c)}</span>`).join('');
    st.q = p.text;
    if (p.when) st.when = p.when;
    if (p.hood) { st.hood = p.hood; st.city = p.city; st.region = CITIES.find((c) => c.slug === p.city)?.region || ''; }
    else if (p.city) { st.city = p.city; st.hood = ''; st.region = CITIES.find((c) => c.slug === p.city)?.region || ''; }
    else if (p.region) { st.region = p.region; st.city = ''; st.hood = ''; }
    p.vibes.forEach((v) => { if (MOODS.includes(v)) { if (!st.moods.includes(v)) st.moods.push(v); } else if (!st.vibes.includes(v)) st.vibes.push(v); });
    p.cats.forEach((c) => { if (!st.cats.includes(c)) st.cats.push(c); });
    if (p.maxPrice != null) st.maxPrice = p.maxPrice;
    if (p.nearMe) { st.sort = 'near'; locate().then(changed); }
    changed();
  };
  smartInput.addEventListener('input', () => {
    clearTimeout(tmr);
    tmr = setTimeout(() => {
      const p = parseQuery(smartInput.value);
      $('[data-parsed]').innerHTML = describe(p).map((c) => `<span class="tag">${escHtml(c)}</span>`).join('');
      st.q = p.text; shown = PAGE; update();
    }, 180);
  });
  $('[data-smart]').addEventListener('submit', (e) => { e.preventDefault(); applySmart(); });

  async function locate() {
    if (st.origin) return;
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }));
      st.origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      L.circleMarker([st.origin.lat, st.origin.lng], { radius: 8, color: '#2f80ed', fillOpacity: 0.9 }).addTo(map).bindTooltip('You are here');
    } catch {
      st.sort = 'date';
    }
  }

  // ---------- Map ----------
  const map = L.map('map', { zoomControl: true, scrollWheelZoom: true, zoomSnap: 0.25 }).setView([37.75, -122.25], 9);
  L.tileLayer(root.dataset.tiles, { attribution: root.dataset.attr, subdomains: 'abcd', maxZoom: 19 }).addTo(map);
  // Real region (county) boundaries — click to filter by region.
  const regionStyle = (slug) => ({ color: '#ef4b25', weight: st.region === slug ? 3 : 1.2, opacity: st.region === slug ? 0.9 : 0.5, fillColor: '#ef4b25', fillOpacity: st.region === slug ? 0.08 : 0.03, dashArray: st.region === slug ? null : '5 5' });
  const regionLayer = L.geoJSON(boundaries.regions, {
    style: (f) => regionStyle(f.properties.region),
    onEachFeature: (f, layer) => {
      const r = REGIONS.find((x) => x.slug === f.properties.region);
      layer.bindTooltip(`${r.emoji} ${r.name} — tap to filter`, { sticky: true });
      layer.on('click', () => { st.region = st.region === r.slug ? '' : r.slug; st.city = ''; st.hood = ''; changed(); flyToRegion(); });
      layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.12 }));
      layer.on('mouseout', () => layer.setStyle(regionStyle(r.slug)));
    },
  }).addTo(map);
  // Real neighborhood boundaries (SF, Oakland, San Jose) — appear when zoomed in; click to filter.
  const hoodStyle = (slug) => ({ color: '#131a2e', weight: st.hood && st.hood === slug ? 2.5 : 0.8, opacity: 0.55, fillColor: '#12a594', fillOpacity: st.hood && st.hood === slug ? 0.18 : 0.02 });
  const hoodLayer = L.geoJSON(boundaries.hoods, {
    style: (f) => hoodStyle(f.properties.slug),
    onEachFeature: (f, layer) => {
      layer.bindTooltip(f.properties.name, { sticky: true, className: 'hood-label' });
      layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.14 }));
      layer.on('mouseout', () => layer.setStyle(hoodStyle(f.properties.slug)));
      layer.on('click', () => {
        if (!f.properties.slug) return;
        const city = CITIES.find((c) => c.slug === f.properties.city);
        st.hood = st.hood === f.properties.slug ? '' : f.properties.slug;
        st.city = city.slug; st.region = city.region;
        changed();
      });
    },
  });
  const clusters = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 46, spiderfyOnMaxZoom: true });
  map.addLayer(clusters);
  const syncLayers = () => {
    const z = map.getZoom();
    if (z >= 12) { if (map.hasLayer(regionLayer)) map.removeLayer(regionLayer); if (!map.hasLayer(hoodLayer)) hoodLayer.addTo(map); hoodLayer.bringToBack(); }
    else { if (map.hasLayer(hoodLayer)) map.removeLayer(hoodLayer); if (!map.hasLayer(regionLayer)) regionLayer.addTo(map); regionLayer.bringToBack(); }
  };
  map.on('zoomend', syncLayers);

  function flyToRegion() {
    const r = REGIONS.find((x) => x.slug === st.region);
    regionLayer.eachLayer((l) => l.setStyle(regionStyle(l.feature.properties.region)));
    if (r) {
      const b = L.featureGroup(regionLayer.getLayers().filter((l) => l.feature.properties.region === r.slug)).getBounds();
      map.flyToBounds(b, { padding: [20, 20], duration: 0.8, maxZoom: r.slug === 'san-francisco' ? 12.5 : 11 });
    } else map.flyTo([37.75, -122.25], 9, { duration: 0.8 });
  }
  function flyToCity(c) { if (c) map.flyTo([c.lat, c.lng], c.slug === 'san-francisco' ? 12.5 : 13, { duration: 0.8 }); }

  function renderMap(list) {
    clusters.clearLayers();
    const markers = list.filter((i) => i.la != null).slice(0, 1500).map((i) => {
      const cat = categoryBySlug[i.cat[0]] || categoryBySlug.community;
      const cls = i.sp ? 'pin gold' : i.ty === 'a' ? 'pin activity' : 'pin';
      const m = L.marker([i.la, i.lo], { icon: L.divIcon({ className: '', html: `<div class="${cls}"><span>${cat.emoji}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] }), zIndexOffset: i.sp ? 1000 : 0 });
      const when = i.s ? formatWhen({ start: i.s, end: i.e, allDay: !!i.ad }) : (i.sc || 'Open regularly');
      m.bindPopup(`<div class="popup">${i.img ? `<img src="${escHtml(i.img)}" alt="" referrerpolicy="no-referrer" style="width:220px;height:120px;object-fit:cover;border-radius:10px;margin-bottom:6px;display:block" onerror="this.remove()">` : ''}${i.sp ? '<span class="tag sponsored">★ Sponsored</span><br>' : ''}<a href="${escHtml(i.u)}">${escHtml(i.t)}</a><br><small>${escHtml(when)}</small><br><small>${escHtml(placeOf(i))}</small>${i.deal ? `<br><b>🎟️ ${escHtml(i.deal)}</b>` : ''}</div>`);
      return m;
    });
    clusters.addLayers(markers);
  }

  // ---------- Results ----------
  function renderList() {
    const grid = $('[data-grid]');
    grid.innerHTML = results.slice(0, shown).map(cardHTML).join('') || `<div class="empty" style="grid-column:1/-1">No matches 😅 — try removing a filter, widening the date, or <button class="btn btn-ghost btn-sm" type="button" data-reset-inline>reset everything</button>.</div>`;
    $('[data-reset-inline]')?.addEventListener('click', () => $('[data-reset]').click());
    $('[data-more]').hidden = results.length <= shown;
    document.dispatchEvent(new Event('cards:rendered'));
  }

  function update() {
    syncURL();
    hoodLayer.eachLayer((l) => l.setStyle(hoodStyle(l.feature.properties.slug)));
    const textIds = st.q && mini ? new Set(mini.search(st.q, { prefix: true, fuzzy: 0.2, combineWith: 'AND' }).map((r) => r.id)) : null;
    const filtered = applyFilters(items, { ...st, vibes: [...st.vibes, ...st.moods], textIds });
    results = sortItems(filtered, st.sort, st.origin);
    const ev = results.filter((i) => i.ty === 'e').length;
    $('[data-count]').textContent = `${results.length} result${results.length === 1 ? '' : 's'}`;
    $('[data-summary]').textContent = `· ${ev} events · ${results.length - ev} always-open spots`;
    renderList();
    renderMap(results);
  }

  // ---------- Spin the Bay ----------
  const dlg = $('[data-spin-dialog]');
  function spin() {
    const pool = results.length ? results : items;
    if (!pool.length) return;
    if (!dlg.open) dlg.showModal();
    const slot = $('[data-slot]');
    slot.classList.add('rolling');
    let n = 0;
    const iv = setInterval(() => {
      slot.textContent = pool[Math.floor(Math.random() * pool.length)].t;
      if (++n > 16) {
        clearInterval(iv);
        slot.classList.remove('rolling');
        const pick = pool[Math.floor(Math.random() * pool.length)];
        slot.textContent = `${(categoryBySlug[pick.cat[0]] || categoryBySlug.community).emoji} ${pick.t}`;
        $('[data-slot-meta]').textContent = `${pick.s ? formatWhen({ start: pick.s, end: pick.e, allDay: !!pick.ad }) : pick.sc || 'Open regularly'} · ${placeOf(pick)}`;
        $('[data-slot-link]').href = pick.u;
      }
    }, 70);
  }
  $('[data-spin]').addEventListener('click', spin);
  $('[data-spin-again]').addEventListener('click', spin);
  $('[data-spin-close]').addEventListener('click', () => dlg.close());

  // ---------- Weather-aware hint ----------
  fetchForecast().then((days) => {
    const s = suggestMood(days);
    if (s) $('[data-wx-hint]').innerHTML = `${s.icon} ${escHtml(s.text)} <button class="chip" type="button" style="height:26px;font-size:.78rem" data-wx-apply="${s.mood}">Apply</button>`;
    $('[data-wx-apply]')?.addEventListener('click', (e) => { const m = e.target.dataset.wxApply; if (!st.moods.includes(m)) st.moods.push(m); changed(); });
  }).catch(() => {});

  // ---------- Boot ----------
  paintControls();
  if (parsedFromQ) $('[data-parsed]').innerHTML = describe(parsedFromQ).map((c) => `<span class="tag">${escHtml(c)}</span>`).join('');
  items = await loadIndex();
  const cityName = Object.fromEntries(CITIES.map((c) => [c.slug, c.name]));
  mini = new MiniSearch({ fields: ['t', 'v', 'd', 'tg', 'place'], storeFields: ['id'], searchOptions: { boost: { t: 3, v: 1.5, place: 1.5 } } });
  mini.addAll(items.map((i) => ({ id: i.id, t: i.t, v: i.v || '', d: i.d, tg: i.tg, place: `${cityName[i.c] || ''}` })));
  if (st.sort === 'near') await locate();
  update();
  if (params.get('spin') === '1') setTimeout(spin, 300);
  if (st.city) flyToCity(CITIES.find((c) => c.slug === st.city)); else if (st.region) flyToRegion();
}
