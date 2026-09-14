// Add / edit expense modal, shared by the dashboard and ledger pages.
// Ported from the old AddExpenseSheet + ExpenseRowActions React components.
// The settlement-split preview is computed locally from the cached split
// versions (no /api/split-preview round-trip).

import { createExpense, updateExpense } from './api.js?v=4';
import { shareForDate } from './balances.js?v=4';
import { todayISO, esc } from './format.js?v=4';

let modalEl = null;
let bsModal = null;
let onSavedCb = null;

// Live form state
let state = {
  mode: 'add', // 'add' | 'edit'
  editId: null,
  data: null, // cached { people, splitVersions, ... }
  paidBy: null,
  settled: false,
  rows: [], // settlement rows: { personId, amount, date, fundedBy: 'personal'|'vg' }
};

const MODAL_HTML = `
<div class="modal fade" id="rvExpenseModal" tabindex="-1" aria-hidden="true" aria-labelledby="rvExpenseTitle">
  <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
    <div class="modal-content rv-modal">
      <div class="modal-header">
        <h2 class="modal-title h5" id="rvExpenseTitle">Add expense</h2>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <form id="rvExpenseForm" novalidate>
          <div class="mb-3">
            <label class="form-label rv-label" for="ef-name">Expense name</label>
            <input id="ef-name" class="form-control" required placeholder="Packaging boxes" autocomplete="off">
          </div>
          <div class="mb-3">
            <label class="form-label rv-label" for="ef-amount">Amount (₹)</label>
            <input id="ef-amount" type="number" inputmode="decimal" min="0.01" step="0.01" class="form-control" required placeholder="0">
          </div>
          <div class="mb-3">
            <label class="form-label rv-label">Paid by</label>
            <div id="ef-payers" class="rv-payer-grid"></div>
          </div>
          <div class="mb-3">
            <label class="form-label rv-label" for="ef-date">Date</label>
            <input id="ef-date" type="date" class="form-control" required>
          </div>
          <div class="rv-settled-row mb-3">
            <div>
              <div class="rv-settled-title">Settled between us?</div>
              <div class="rv-settled-sub">On = already squared up. Off = counts toward dues.</div>
            </div>
            <div class="form-check form-switch m-0">
              <input id="ef-settled" class="form-check-input" type="checkbox" role="switch" aria-label="Settled between us">
            </div>
          </div>
          <div id="ef-split" class="rv-split mb-3" hidden></div>
          <div class="mb-3">
            <label class="form-label rv-label" for="ef-note">Note (optional)</label>
            <input id="ef-note" class="form-control" placeholder="For the fuel run" autocomplete="off">
          </div>
          <div id="ef-error" class="rv-error mb-3" hidden></div>
          <button type="submit" id="ef-submit" class="btn rv-btn-primary w-100">Save expense</button>
        </form>
      </div>
    </div>
  </div>
</div>`;

function ensureModal() {
  if (modalEl) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = MODAL_HTML.trim();
  modalEl = wrap.firstElementChild;
  document.body.appendChild(modalEl);
  bsModal = new window.bootstrap.Modal(modalEl);

  q('#rvExpenseForm').addEventListener('submit', onSubmit);
  q('#ef-settled').addEventListener('change', (e) => {
    state.settled = e.target.checked;
    if (state.mode === 'add') refreshSplit();
    else renderSplit(); // edit mode: no rows, just keep section hidden
  });
  ['#ef-amount', '#ef-date'].forEach((sel) =>
    q(sel).addEventListener('input', () => {
      if (state.mode === 'add' && state.settled) refreshSplit();
    })
  );
}

function q(sel) {
  return modalEl.querySelector(sel);
}

function otherFounders() {
  return (state.data.people || []).filter((p) => p.can_login && p.id !== state.paidBy);
}
function vgPerson() {
  return (state.data.people || []).find((p) => p.name === 'Vyuh Gravity') || null;
}

function renderPayers() {
  const grid = q('#ef-payers');
  grid.innerHTML = '';
  for (const p of state.data.people || []) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rv-payer' + (state.paidBy === p.id ? ' is-active' : '');
    btn.textContent = p.name;
    btn.addEventListener('click', () => {
      state.paidBy = p.id;
      renderPayers();
      if (state.mode === 'add' && state.settled) refreshSplit();
    });
    grid.appendChild(btn);
  }
}

// Rebuild settlement rows from the split active on the chosen date.
function refreshSplit() {
  const others = otherFounders();
  if (!state.settled || others.length === 0) {
    state.rows = [];
    renderSplit();
    return;
  }
  const amount = Number(q('#ef-amount').value);
  const date = q('#ef-date').value || todayISO();
  const preview =
    amount > 0 && date
      ? shareForDate(state.data.splitVersions || [], date, amount, state.paidBy)
      : [];
  const byPerson = new Map(preview.map((r) => [r.person_id, r]));

  state.rows = others.map((p) => ({
    personId: p.id,
    amount: byPerson.has(p.id) ? Number(byPerson.get(p.id).share_amount).toFixed(2) : '0.00',
    date,
    fundedBy: 'personal',
  }));
  renderSplit();
}

function renderSplit() {
  const box = q('#ef-split');
  // Settlement rows only apply when adding a settled expense.
  if (state.mode !== 'add' || !state.settled || state.rows.length === 0) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;
  box.innerHTML = `<div class="rv-split-head">Settlement split</div>`;

  for (const row of state.rows) {
    const founder = (state.data.people || []).find((p) => p.id === row.personId);
    const el = document.createElement('div');
    el.className = 'rv-split-row';
    el.innerHTML = `
      <div class="rv-split-row-top">
        <span class="rv-split-name">${esc(founder ? founder.name : 'Founder')}</span>
        <div class="rv-seg" role="group" aria-label="Funding source">
          <button type="button" class="rv-seg-btn ${row.fundedBy === 'personal' ? 'is-active' : ''}" data-fund="personal">Personal</button>
          <button type="button" class="rv-seg-btn ${row.fundedBy === 'vg' ? 'is-active' : ''}" data-fund="vg">Vyuh Gravity</button>
        </div>
      </div>
      <div class="rv-split-inputs">
        <label class="rv-mini">
          <span>Share amount</span>
          <input type="number" inputmode="decimal" min="0.01" step="0.01" class="form-control form-control-sm" data-field="amount" value="${esc(row.amount)}">
        </label>
        <label class="rv-mini">
          <span>Date</span>
          <input type="date" class="form-control form-control-sm" data-field="date" value="${esc(row.date)}">
        </label>
      </div>`;

    el.querySelectorAll('.rv-seg-btn').forEach((b) =>
      b.addEventListener('click', () => {
        row.fundedBy = b.dataset.fund;
        renderSplit();
      })
    );
    el.querySelector('[data-field="amount"]').addEventListener('input', (e) => {
      row.amount = e.target.value;
    });
    el.querySelector('[data-field="date"]').addEventListener('input', (e) => {
      row.date = e.target.value;
    });
    box.appendChild(el);
  }
}

function showError(msg) {
  const el = q('#ef-error');
  if (!msg) {
    el.hidden = true;
    el.textContent = '';
  } else {
    el.hidden = false;
    el.textContent = msg;
  }
}

async function onSubmit(e) {
  e.preventDefault();
  showError('');

  const payload = {
    name: q('#ef-name').value,
    amount: q('#ef-amount').value,
    paid_by: state.paidBy,
    settled: state.settled,
    expense_date: q('#ef-date').value,
    note: q('#ef-note').value,
  };

  if (!payload.name.trim() || !payload.amount || !payload.paid_by || !payload.expense_date) {
    showError('Please fill in name, amount, payer and date.');
    return;
  }
  if (Number(payload.amount) <= 0) {
    showError('Amount must be greater than zero.');
    return;
  }

  if (state.mode === 'add' && state.settled) {
    const bad = state.rows.some((r) => !r.personId || Number(r.amount) <= 0 || !r.date);
    if (bad) {
      showError('Each settlement row needs a valid share amount and date.');
      return;
    }
    const vg = vgPerson();
    payload.repayments = state.rows.map((r) => ({
      repaid_by: r.personId,
      amount: r.amount,
      repayment_date: r.date || payload.expense_date,
      funded_by: r.fundedBy === 'vg' ? (vg ? vg.id : null) : null,
      note: null,
    }));
  }

  const submit = q('#ef-submit');
  submit.disabled = true;
  submit.textContent = 'Saving…';
  try {
    if (state.mode === 'edit') {
      await updateExpense({ id: state.editId, ...payload });
    } else {
      await createExpense(payload);
    }
    bsModal.hide();
    if (onSavedCb) await onSavedCb();
  } catch (err) {
    showError(err.message || 'Could not save that expense. Try again.');
  } finally {
    submit.disabled = false;
    submit.textContent = 'Save expense';
  }
}

export function initExpenseModal(onSaved) {
  ensureModal();
  onSavedCb = onSaved;
}

export function openAddExpense(data) {
  ensureModal();
  state = {
    mode: 'add',
    editId: null,
    data,
    paidBy: (data.people && data.people[0] && data.people[0].id) || null,
    settled: false,
    rows: [],
  };
  q('#rvExpenseTitle').textContent = 'Add expense';
  q('#ef-name').value = '';
  q('#ef-amount').value = '';
  q('#ef-date').value = todayISO();
  q('#ef-note').value = '';
  q('#ef-settled').checked = false;
  showError('');
  renderPayers();
  renderSplit();
  bsModal.show();
}

export function openEditExpense(expense, data) {
  ensureModal();
  state = {
    mode: 'edit',
    editId: expense.id,
    data,
    paidBy: expense.paid_by,
    settled: !!expense.settled,
    rows: [],
  };
  q('#rvExpenseTitle').textContent = 'Edit expense';
  q('#ef-name').value = expense.name || '';
  q('#ef-amount').value = String(expense.amount ?? '');
  q('#ef-date').value = expense.expense_date;
  q('#ef-note').value = expense.note || '';
  q('#ef-settled').checked = !!expense.settled;
  showError('');
  renderPayers();
  renderSplit();
  bsModal.show();
}
