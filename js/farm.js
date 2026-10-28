// Flock + reminder helpers (batch selection, mortality totals, due dates).

export function activeBatch(batches) {
  return (batches || []).find((b) => b.is_active) || (batches || [])[0] || null;
}

export function deathsFor(batchId, mortality) {
  return (mortality || [])
    .filter((m) => m.batch_id === batchId)
    .reduce((s, m) => s + Number(m.count), 0);
}

export function totalDeaths(mortality) {
  return (mortality || []).reduce((s, m) => s + Number(m.count), 0);
}

export function todayStr() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function daysUntil(dateStr) {
  const today = new Date(todayStr());
  const d = new Date(dateStr);
  return Math.round((d - today) / 86400000);
}

export function dueLabel(dateStr) {
  const n = daysUntil(dateStr);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n < 0) return `${-n} days ago`;
  return `in ${n} days`;
}

export const REMINDER_KINDS = [
  { value: 'vaccine', label: 'Vaccine' },
  { value: 'task', label: 'Task' },
  { value: 'pending', label: 'Pending work' },
  { value: 'reminder', label: 'Reminder' },
];

export function kindLabel(kind) {
  return (REMINDER_KINDS.find((k) => k.value === kind) || {}).label || 'Reminder';
}

// ---- Loan ----
export function loanRaised(loans) {
  return (loans || []).reduce((s, l) => s + Number(l.amount), 0);
}
export function loanUsed(expenses) {
  return (expenses || []).filter((e) => e.from_loan).reduce((s, e) => s + Number(e.amount), 0);
}
