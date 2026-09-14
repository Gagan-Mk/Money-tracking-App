// Formatting + date helpers shared across pages.

// Indian-grouped integer rupees, e.g. 125000 -> "1,25,000".
export function inr(n) {
  return Math.round(Number(n) || 0).toLocaleString('en-IN');
}

// Absolute value variant, for balances where the sign is shown separately.
export function inrAbs(n) {
  return Math.abs(Math.round(Number(n) || 0)).toLocaleString('en-IN');
}

export function todayISO() {
  const d = new Date();
  // Local date (not UTC) so "today" matches the user's calendar day.
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

// "13 Sep"
export function fmtDay(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// "September 2026"
export function fmtMonthYear(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

// Escape untrusted strings before inserting into innerHTML.
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
