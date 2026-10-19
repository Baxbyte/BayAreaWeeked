// Street-map background for every interactive map.
// Google Maps (official Map Tiles API) when PUBLIC_GOOGLE_MAPS_API_KEY is set; otherwise free OpenStreetMap tiles,
// switching to Esri's street map automatically if those fail to load. No provider needs a key except Google.
const FREE = [
  { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19 },
  { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19 },
];

async function googleSession(key) {
  const cacheKey = `gmt-session:${key.slice(-6)}`;
  try {
    const c = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
    if (c && c.expiry * 1000 > Date.now() + 60000) return c.session;
  } catch { /* storage unavailable */ }
  const res = await fetch(`https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mapType: 'roadmap', language: 'en-US', region: 'US' }),
  });
  if (!res.ok) throw new Error(`Google Map Tiles ${res.status}`);
  const s = await res.json();
  try { sessionStorage.setItem(cacheKey, JSON.stringify({ session: s.session, expiry: Number(s.expiry) })); } catch { /* ignore */ }
  return s.session;
}

function addFree(L, map, list) {
  let i = 0;
  let layer;
  const use = () => {
    const p = list[i];
    let loaded = 0;
    let failed = 0;
    if (layer) map.removeLayer(layer);
    layer = L.tileLayer(p.url, { attribution: p.attribution, maxZoom: p.maxZoom, crossOrigin: true }).addTo(map);
    layer.on('tileload', () => { loaded++; });
    layer.on('tileerror', () => {
      // Several failures before anything loads → this provider is down or blocked; try the next one.
      if (++failed >= 4 && loaded === 0 && i < list.length - 1) { i++; use(); }
    });
  };
  use();
}

/** @param cfg {{ gkey?: string, tiles?: string }} */
export async function addBaseMap(L, map, cfg = {}) {
  const list = cfg.tiles ? [{ url: cfg.tiles, attribution: '', maxZoom: 19 }, ...FREE] : FREE;
  if (!cfg.gkey) return addFree(L, map, list);
  try {
    const session = await googleSession(cfg.gkey);
    const q = `session=${session}&key=${encodeURIComponent(cfg.gkey)}`;
    L.tileLayer(`https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?${q}`, { maxZoom: 21, attribution: 'Google' }).addTo(map);
    // Google requires showing its logo and the live copyright line for the visible area.
    map.attributionControl.setPrefix('<img src="https://maps.gstatic.com/mapfiles/api-3/images/google_white5.png" alt="Google" height="14" style="vertical-align:middle">');
    const credit = async () => {
      const b = map.getBounds();
      try {
        const v = await (await fetch(`https://tile.googleapis.com/tile/v1/viewport?${q}&zoom=${Math.round(map.getZoom())}&north=${b.getNorth()}&south=${b.getSouth()}&east=${b.getEast()}&west=${b.getWest()}`)).json();
        map.attributionControl.removeAttribution(map._gCredit || '');
        map._gCredit = v.copyright ? `Map data ${v.copyright}` : 'Map data ©Google';
        map.attributionControl.addAttribution(map._gCredit);
      } catch { /* keep the previous line */ }
    };
    map.on('moveend', credit);
    credit();
  } catch {
    addFree(L, map, list);
  }
}
