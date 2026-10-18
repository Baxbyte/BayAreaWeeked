// Signup + sponsor bid forms. With an endpoint configured, they POST JSON; otherwise they fall back to email.
function picks(form, name) {
  return [...form.querySelectorAll(`[data-pick="${name}"][aria-pressed="true"]`)].map((b) => b.dataset.val);
}

async function send(endpoint, payload) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

function wirePicks(form) {
  form.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
    b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
  }));
}

function fallback(contact, subject, payload) {
  if (!contact) return false;
  const body = Object.entries(payload).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
  location.href = `mailto:${contact}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return true;
}

export function initSignup() {
  document.querySelectorAll('form[data-signup]').forEach((form) => {
    if (form.dataset.wired) return;
    form.dataset.wired = '1';
    wirePicks(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = form.querySelector('[data-msg]');
      const email = form.email.value.trim();
      if (form.company?.value) return; // bot trap
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.textContent = 'Please enter a valid email.'; return; }
      const payload = {
        type: 'newsletter_signup', email, regions: picks(form, 'regions'), interests: picks(form, 'interests'),
        frequency: form.frequency?.value || 'daily', kids: picks(form, 'interests').includes('kids'),
        source: location.pathname, createdAt: new Date().toISOString(),
      };
      try { localStorage.setItem('baw:signup', JSON.stringify(payload)); } catch { /* ignore */ }
      const endpoint = form.dataset.endpoint;
      try {
        if (endpoint) await send(endpoint, payload);
        else if (!fallback(form.dataset.contact, 'Daily email early access', payload)) throw new Error('no endpoint');
        msg.textContent = '🎉 You’re on the list! Your first personalized picks are coming soon.';
        form.reset();
      } catch {
        msg.textContent = 'Signups open very soon — thanks for your patience! (We saved your picks on this device.)';
      }
    });
  });
}

export function initSponsorForm() {
  const form = document.querySelector('form[data-sponsor]');
  if (!form) return;
  wirePicks(form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = form.querySelector('[data-msg]');
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.company_website) return;
    if (!data.email || !data.event_url) { msg.textContent = 'Please add your email and event link.'; return; }
    const payload = { type: 'sponsor_bid', ...data, slots: picks(form, 'slots'), createdAt: new Date().toISOString() };
    try {
      if (form.dataset.endpoint) await send(form.dataset.endpoint, payload);
      else if (!fallback(form.dataset.contact, `Sponsor bid: ${data.event_name || data.event_url}`, payload)) throw new Error('no endpoint');
      msg.textContent = '✅ Bid received! We’ll confirm your placement and invoice by email within one business day.';
      form.reset();
    } catch {
      msg.textContent = 'Couldn’t send right now — please try again shortly.';
    }
  });
}
