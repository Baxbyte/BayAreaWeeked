// Build and download .ics calendar files in the browser.
const stamp = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

export function icsFor(events) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bay Area Weekend//EN', 'CALSCALE:GREGORIAN'];
  for (const e of events) {
    if (!e.s) continue;
    const start = new Date(e.s);
    const end = e.e ? new Date(e.e) : new Date(start.getTime() + 2 * 3600000);
    lines.push('BEGIN:VEVENT', `UID:${stamp(start)}-${Math.abs(hashCode(e.t))}@bayareaweekend`, `DTSTAMP:${stamp(new Date())}`);
    if (e.ad) {
      const d = e.s.slice(0, 10).replace(/-/g, '');
      lines.push(`DTSTART;VALUE=DATE:${d}`);
    } else {
      lines.push(`DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`);
    }
    lines.push(`SUMMARY:${esc(e.t)}`, `LOCATION:${esc(e.loc)}`, `URL:${e.u}`, `DESCRIPTION:${esc(e.u)}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function downloadIcs(events, filename = 'bay-area-weekend.ics') {
  const blob = new Blob([icsFor(events)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
