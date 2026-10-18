// "Save to my plan" hearts, stored per-browser in localStorage.
const KEY = 'baw:saved:v1';

export function getSaved() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function setSaved(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch { /* private mode */ }
  document.dispatchEvent(new CustomEvent('saves:changed', { detail: list }));
}

export function toast(msg) {
  const el = document.querySelector('[data-toast]');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function paint() {
  const saved = getSaved();
  const ids = new Set(saved.map((s) => s.id));
  document.querySelectorAll('[data-save]').forEach((b) => {
    const d = JSON.parse(b.getAttribute('data-save'));
    b.setAttribute('aria-pressed', String(ids.has(d.id)));
    b.setAttribute('aria-label', ids.has(d.id) ? `Remove ${d.t} from my plan` : `Save ${d.t} to my plan`);
  });
  document.querySelectorAll('[data-saved-count]').forEach((el) => { el.textContent = saved.length ? String(saved.length) : ''; });
}

export function initSaves() {
  paint();
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-save]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    const d = JSON.parse(b.getAttribute('data-save'));
    const saved = getSaved();
    const i = saved.findIndex((s) => s.id === d.id);
    if (i >= 0) {
      saved.splice(i, 1);
      toast('Removed from your plan');
    } else {
      saved.push({ ...d, addedAt: Date.now() });
      toast('❤️ Saved to your weekend plan');
    }
    setSaved(saved);
  });
  document.addEventListener('saves:changed', paint);
  document.addEventListener('cards:rendered', paint);
}
