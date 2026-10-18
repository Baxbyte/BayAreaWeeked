// Live forecast from Open-Meteo (free, no key) → weather-smart suggestions (hot / rainy / fog escape).
const URL_ = 'https://api.open-meteo.com/v1/forecast?latitude=37.7749,37.9101,37.3382&longitude=-122.4194,-122.0652,-121.8863'
  + '&daily=weather_code,temperature_2m_max,precipitation_probability_max&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles&forecast_days=10';

const ICON = (code, pop) => {
  if (pop >= 50 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return '🌧️';
  if (code >= 95) return '⛈️';
  if (code === 45 || code === 48) return '🌫️';
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  return '☁️';
};

let cache;
export function fetchForecast() {
  if (cache) return cache;
  cache = (async () => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('baw:wx') || 'null');
      if (saved && Date.now() - saved.at < 3 * 3600000) return saved.days;
    } catch { /* ignore */ }
    const res = await fetch(URL_);
    if (!res.ok) throw new Error('forecast unavailable');
    const [sf, inland, sj] = await res.json();
    const days = sf.daily.time.map((date, i) => ({
      date,
      code: sf.daily.weather_code[i],
      hi: Math.round(sf.daily.temperature_2m_max[i]),
      pop: sf.daily.precipitation_probability_max[i] ?? 0,
      inlandHi: Math.round(inland.daily.temperature_2m_max[i]),
      sjHi: Math.round(sj.daily.temperature_2m_max[i]),
      icon: ICON(sf.daily.weather_code[i], sf.daily.precipitation_probability_max[i] ?? 0),
    }));
    try { sessionStorage.setItem('baw:wx', JSON.stringify({ at: Date.now(), days })); } catch { /* ignore */ }
    return days;
  })();
  return cache;
}

export function moodFor(d) {
  if (!d) return null;
  if (d.pop >= 50) return { mood: 'rainy-day', icon: '🌧️', text: `${d.pop}% chance of rain` };
  if (Math.max(d.hi, d.inlandHi, d.sjHi) >= 86) return { mood: 'hot-day', icon: '🥵', text: `Up to ${Math.max(d.hi, d.inlandHi, d.sjHi)}°F inland` };
  if (d.code === 45 || d.code === 48 || (d.hi <= 64 && d.inlandHi - d.hi >= 10)) return { mood: 'fog-escape', icon: '🌫️', text: `Foggy SF (${d.hi}°) but ${d.inlandHi}° inland` };
  return null;
}

/** The most useful single suggestion for the next few days. */
export function suggestMood(days) {
  const next = days.slice(0, 4);
  for (const d of next) {
    const m = moodFor(d);
    if (m) {
      const day = new Date(`${d.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
      return { ...m, text: `${day}: ${m.text}.`, date: d.date };
    }
  }
  return null;
}
