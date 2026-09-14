import { requireSession, getData, deleteExpense, peopleMap, logout } from './api.js?v=4';
import { inr, fmtDay, fmtMonthYear, esc } from './format.js?v=4';
import { effectiveShares } from './balances.js?v=4';
import { initExpenseModal, openAddExpense, openEditExpense } from './add-expense.js?v=4';

const round2 = (n) => Math.round(n * 100) / 100;

const els = {
  paidBy: document.getElementById('f-paidby'),
  settled: document.getElementById('f-settled'),
  month: document.getElementById('f-month'),
  summary: document.getElementById('ledger-summary'),
  list: document.getElementById('ledger-list'),
};

// "YYYY-MM" key for an expense date (used by the multi-month filter + grouping).
function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function readFilters() {
  const p = new URLSearchParams(location.search);
  return {
    paid_by: p.get('paid_by') || '',
    settled: p.get('settled') || '',
    month: p.get('month') || '',
    months: (p.get('months') || '').split(',').filter(Boolean),
  };
}

function writeFilters(f) {
  const p = new URLSearchParams(location.search);
  ['paid_by', 'settled', 'month'].forEach((k) => (f[k] ? p.set(k, f[k]) : p.delete(k)));
  if (f.months && f.months.length) p.set('months', f.months.join(','));
  else p.delete('months');
  history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p.toString() : ''));
}

// Everything except the payer filter (payer is handled as a "true share"
// calculation in buildRows, not a plain row filter).
function applyBaseFilters(expenses, f) {
  const monthSet = new Set(f.months || []);
  return expenses.filter((e) => {
    if (f.settled === 'true' && !e.settled) return false;
    if (f.settled === 'false' && e.settled) return false;
    if (f.month) {
      const [y, m] = f.month.split('-').map(Number);
      const d = new Date(e.expense_date);
      if (d.getFullYear() !== y || d.getMonth() + 1 !== m) return false;
    }
    // Multi-month filter (empty = all months)
    if (monthSet.size && !monthSet.has(monthKey(e.expense_date))) return false;
    return true;
  });
}

// Turn filtered expenses into display rows. With no payer filter each row shows
// the full amount. Filtered by a person, each row shows that person's TRUE
// share of the expense (what they actually bore), including a share of an
// expense someone else paid but they repaid.
function buildRows(base, f, repByExp) {
  if (!f.paid_by) {
    return base.map((e) => ({ e, amount: Number(e.amount), full: Number(e.amount), isPayer: true }));
  }
  const rows = [];
  for (const e of base) {
    const shares = effectiveShares(e, repByExp[e.id] || []);
    const amt = shares[f.paid_by];
    if (amt && Math.abs(amt) > 0.005) {
      rows.push({ e, amount: round2(amt), full: Number(e.amount), isPayer: e.paid_by === f.paid_by });
    }
  }
  return rows;
}

function repaymentsByExpense(repayments) {
  const map = {};
  for (const r of repayments || []) (map[r.expense_id] = map[r.expense_id] || []).push(r);
  return map;
}

function render() {
  const data = window.__RV_DATA;
  const people = peopleMap(data);
  const repByExp = repaymentsByExpense(data.repayments);
  const f = readFilters();
  const base = applyBaseFilters(data.expenses, f);
  const rows = buildRows(base, f, repByExp);
  const total = rows.reduce((s, r) => s + r.amount, 0);

  const who = f.paid_by ? (people.get(f.paid_by)?.name || 'this person') + "'s share · " : '';
  els.summary.textContent = `${who}${rows.length} expense${rows.length === 1 ? '' : 's'} · ₹${inr(total)} total`;

  if (rows.length === 0) {
    els.list.innerHTML = `<div class="rv-card rv-muted">No expenses match these filters.</div>`;
    return;
  }

  const grouped = {};
  for (const r of rows) {
    const label = fmtMonthYear(r.e.expense_date);
    (grouped[label] = grouped[label] || []).push(r);
  }

  els.list.innerHTML = Object.entries(grouped)
    .map(([label, grows]) => {
      const monthSum = grows.reduce((s, r) => s + r.amount, 0);
      const items = grows.map((r) => rowHTML(r, people, repByExp[r.e.id] || [], f)).join('');
      return `<section class="rv-group">
        <div class="rv-group-head">
          <p class="rv-group-label mb-0">${esc(label)}</p>
          <span class="rv-group-total rv-num">₹${inr(monthSum)}</span>
        </div>
        <ul class="rv-card rv-list">${items}</ul>
      </section>`;
    })
    .join('');

  // Wire per-row actions
  els.list.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => {
      const e = data.expenses.find((x) => x.id === b.dataset.edit);
      if (e) openEditExpense(e, data);
    })
  );
  els.list.querySelectorAll('[data-delete]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!window.confirm('Delete this expense?')) return;
      b.disabled = true;
      try {
        await deleteExpense(b.dataset.delete);
        await reloadAndRender();
      } catch (err) {
        b.disabled = false;
        alert(err.message || 'Could not delete this expense.');
      }
    })
  );
}

function rowHTML(r, people, reps, f) {
  const e = r.e;
  const payer = people.get(e.paid_by);
  const pill = e.settled
    ? `<span class="rv-pill rv-pill-settled">Settled</span>`
    : `<span class="rv-pill rv-pill-deferred">Deferred</span>`;

  let repHTML = '';
  if (e.settled && reps.length > 0) {
    repHTML =
      `<div class="rv-reps">` +
      reps
        .map((rp) => {
          const rpWho = people.get(rp.repaid_by);
          const via = rp.funded_by ? (people.get(rp.funded_by)?.name || 'Vyuh Gravity') : 'Personal';
          return `<p class="rv-rep">${esc(rpWho ? rpWho.name : '—')} repaid ₹${inr(rp.amount)} on ${fmtDay(rp.repayment_date)} · via ${esc(via)}</p>`;
        })
        .join('') +
      `</div>`;
  }

  // When filtered by a person, show their true share of this expense.
  let note = '';
  if (f.paid_by) {
    if (!r.isPayer) note = `their ₹${inr(r.amount)} share`;
    else if (Math.round(r.amount) !== Math.round(r.full)) note = `their ₹${inr(r.amount)} of ₹${inr(r.full)}`;
  }
  const noteHTML = note ? ` · <span class="rv-share-note">${esc(note)}</span>` : '';

  return `<li class="rv-row-block">
    <div class="rv-row-line">
      <p class="rv-row-title mb-0">${esc(e.name)}</p>
      <span class="rv-num">₹${inr(r.amount)}</span>
    </div>
    <div class="rv-row-line rv-row-line-sub">
      <p class="rv-row-sub mb-0">Paid by ${esc(payer ? payer.name : '—')}${e.note ? ' · ' + esc(e.note) : ''}${noteHTML}</p>
      ${pill}
    </div>
    ${repHTML}
    <div class="rv-row-actions">
      <button type="button" class="rv-chip" data-edit="${esc(e.id)}">Edit</button>
      <button type="button" class="rv-chip rv-chip-danger" data-delete="${esc(e.id)}">Delete</button>
    </div>
  </li>`;
}

function populateFilters(data) {
  const f = readFilters();
  els.paidBy.innerHTML =
    `<option value="">Anyone paid</option>` +
    (data.people || []).map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  els.paidBy.value = f.paid_by;
  els.settled.value = f.settled;
  els.month.value = f.month;

  const onChange = () => {
    const next = readFilters(); // keep the multi-month selection
    next.paid_by = els.paidBy.value;
    next.settled = els.settled.value;
    next.month = els.month.value;
    writeFilters(next);
    render();
  };
  els.paidBy.addEventListener('change', onChange);
  els.settled.addEventListener('change', onChange);
  els.month.addEventListener('change', onChange);
}

// Build the "Months" multi-select from the months present in the data.
function populateMonthsFilter(data) {
  const menu = document.getElementById('f-months-menu');
  const selected = new Set(readFilters().months); // empty = all
  const keys = [...new Set((data.expenses || []).map((e) => monthKey(e.expense_date)))].sort().reverse();

  menu.innerHTML = keys
    .map((k) => {
      const [y, m] = k.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      const checked = selected.size === 0 || selected.has(k) ? 'checked' : '';
      return `<label class="dropdown-item rv-month-item">
        <input type="checkbox" class="form-check-input" value="${esc(k)}" ${checked} />
        <span>${esc(label)}</span>
      </label>`;
    })
    .join('');

  menu.querySelectorAll('input[type="checkbox"]').forEach((cb) =>
    cb.addEventListener('change', onMonthsChange)
  );
  updateMonthsLabel();
}

function onMonthsChange() {
  const boxes = [...document.querySelectorAll('#f-months-menu input[type="checkbox"]')];
  const checked = boxes.filter((c) => c.checked).map((c) => c.value);
  const next = readFilters();
  // All checked == "all months" -> store empty so the URL stays clean.
  next.months = checked.length === boxes.length ? [] : checked;
  writeFilters(next);
  updateMonthsLabel();
  render();
}

function updateMonthsLabel() {
  const btn = document.getElementById('f-months-btn');
  const boxes = [...document.querySelectorAll('#f-months-menu input[type="checkbox"]')];
  const checked = boxes.filter((c) => c.checked);
  if (boxes.length === 0) btn.textContent = 'All months';
  else if (checked.length === 0) btn.textContent = 'No months';
  else if (checked.length === boxes.length) btn.textContent = 'All months';
  else if (checked.length === 1) {
    const [y, m] = checked[0].value.split('-').map(Number);
    btn.textContent = new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  } else btn.textContent = `${checked.length} months`;
}

async function reloadAndRender() {
  window.__RV_DATA = await getData(true); // force refresh after a mutation
  render();
}

function wireChrome() {
  document.getElementById('logout-btn')?.addEventListener('click', logout);
  document.querySelectorAll('[data-action="add"]').forEach((b) =>
    b.addEventListener('click', () => openAddExpense(window.__RV_DATA))
  );
}

(async function main() {
  await requireSession();
  wireChrome();
  initExpenseModal(reloadAndRender);
  try {
    window.__RV_DATA = await getData();
    populateFilters(window.__RV_DATA);
    populateMonthsFilter(window.__RV_DATA);
    render();
  } catch (err) {
    els.list.innerHTML = `<div class="rv-card rv-error-text">${esc(err.message)}</div>`;
  }
})();
