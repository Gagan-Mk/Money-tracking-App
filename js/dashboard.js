import { requireSession, getData, logout, batches as batchesApi, loans as loansApi } from './api.js?v=4';
import { monthTotal, contributions, contributionBreakdown } from './balances.js?v=4';
import { inr, fmtDay, esc } from './format.js?v=4';
import { initExpenseModal, openAddExpense } from './add-expense.js?v=4';
import { activeBatch, deathsFor, dueLabel, kindLabel, todayStr, loanRaised, loanUsed } from './farm.js?v=4';
import { openForm } from './modal.js?v=4';

const els = {
  monthLabel: document.getElementById('month-label'),
  monthTotal: document.getElementById('month-total'),
  allTime: document.getElementById('alltime-total'),
  balances: document.getElementById('balances'),
  recent: document.getElementById('recent'),
};

async function render() {
  const data = await getData();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  els.monthLabel.textContent = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  els.monthTotal.textContent = '₹' + inr(monthTotal(data.expenses, year, month));

  const allTime = (data.expenses || []).reduce((s, e) => s + Number(e.amount), 0);
  if (els.allTime) els.allTime.textContent = '₹' + inr(allTime);

  renderContributions(data);
  renderLoan(data);
  renderMortality(data);
  renderUpcoming(data);
  renderRecent(data);
}

function renderMortality(data) {
  const card = document.getElementById('mortality-card');
  if (!card) return;
  const batch = activeBatch(data.batches);

  if (!batch) {
    card.innerHTML = `
      <p class="rv-eyebrow mb-2">Mortality</p>
      <p class="rv-muted mb-3">No batch yet — start one to track mortality.</p>
      <a class="btn rv-btn-primary rv-btn-sm" href="flock.html">Start a batch →</a>`;
    return;
  }

  const deaths = deathsFor(batch.id, data.mortality);
  const count = batch.bird_count;
  const alive = count != null ? Math.max(0, count - deaths) : null;

  card.innerHTML = `
    <div class="rv-section-head mb-1">
      <p class="rv-eyebrow mb-0">Mortality</p>
      <a class="rv-link" href="flock.html">Flock →</a>
    </div>
    <div class="rv-batch-name">
      <span>${esc(batch.name)}</span>
      <button type="button" class="rv-icon-btn" id="edit-batch-name" title="Rename batch" aria-label="Rename batch">✎</button>
    </div>
    <p class="rv-total rv-total-sm mb-1">${deaths}<span class="rv-total-unit"> died</span></p>
    ${
      alive != null
        ? `<p class="rv-muted mb-0">${alive} alive · of ${count}</p>`
        : `<p class="rv-muted mb-0">till date · <a class="rv-link" href="flock.html">set a bird count</a></p>`
    }`;

  card.querySelector('#edit-batch-name')?.addEventListener('click', () => {
    openForm({
      title: 'Rename batch',
      fields: [{ name: 'name', label: 'Batch name', value: batch.name, required: true }],
      onSubmit: async (v) => {
        if (!v.name.trim()) throw new Error('Name is required.');
        await batchesApi.update({ id: batch.id, name: v.name.trim() });
        await render();
      },
    });
  });
}

function renderUpcoming(data) {
  const box = document.getElementById('upcoming');
  if (!box) return;
  const today = todayStr();
  const upcoming = (data.reminders || [])
    .filter((r) => !r.done && r.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5);

  if (upcoming.length === 0) {
    box.innerHTML = `<p class="rv-muted mb-0">Nothing scheduled. <a class="rv-link" href="reminders.html">Add one →</a></p>`;
    return;
  }

  box.innerHTML =
    `<ul class="rv-list-plain mb-0">` +
    upcoming
      .map(
        (r) => `
      <li class="rv-upcoming-row">
        <div>
          <p class="rv-row-title mb-0">${esc(r.title)}</p>
          <p class="rv-row-sub mb-0">${esc(fmtDay(r.due_date))} · ${esc(dueLabel(r.due_date))}</p>
        </div>
        <span class="rv-kind rv-kind-${esc(r.kind || 'reminder')}">${esc(kindLabel(r.kind))}</span>
      </li>`
      )
      .join('') +
    `</ul>`;
}

function renderContributions(data) {
  const all = contributions(data.expenses, data.people, data.repayments);
  const peopleById = new Map((data.people || []).map((p) => [p.id, p]));

  // Active members shown by name; ex-members (is_active = false) pooled as
  // "Ex spendings" — RV still owes that money, it's just not an active founder.
  const active = [];
  let exTotal = 0;
  for (const b of all) {
    if (b.contributed <= 0.5) continue;
    const p = peopleById.get(b.id);
    if (p && p.is_active === false) exTotal += b.contributed;
    else active.push(b);
  }
  active.sort((a, b) => b.contributed - a.contributed);

  if (active.length === 0 && exTotal <= 0.5) {
    els.balances.innerHTML = `<p class="rv-muted mb-0">No contributions yet.</p>`;
    return;
  }

  let html = active
    .map(
      (b) => `<li class="rv-balance-row rv-balance-click" data-person="${esc(b.id)}" role="button" tabindex="0" title="See the bills behind this">
        <span>${esc(b.name)}<span class="rv-chevron">›</span></span>
        <span class="rv-num rv-owed">₹${inr(b.contributed)}</span>
      </li>`
    )
    .join('');
  if (exTotal > 0.5) {
    html += `<li class="rv-balance-row rv-ex-row" title="Spending from past members, still owed">
        <span>Ex spendings</span>
        <span class="rv-num rv-owed">₹${inr(exTotal)}</span>
      </li>`;
  }
  els.balances.innerHTML = `<ul class="rv-list-plain mb-0">${html}</ul>`;

  els.balances.querySelectorAll('[data-person]').forEach((li) => {
    const open = () => openPersonDetail(li.dataset.person, data);
    li.addEventListener('click', open);
    li.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        open();
      }
    });
  });
}

function renderLoan(data) {
  const card = document.getElementById('loan-card');
  if (!card) return;
  const raised = loanRaised(data.loans);
  const used = loanUsed(data.expenses);
  const remaining = raised - used;

  if (raised <= 0 && used <= 0) {
    card.innerHTML = `
      <div class="rv-section-head mb-1"><p class="rv-eyebrow mb-0">Loan</p></div>
      <p class="rv-muted mb-3">No loan recorded yet.</p>
      <button class="btn rv-btn-primary rv-btn-sm" id="add-loan" type="button">+ Add loan</button>`;
    card.querySelector('#add-loan').onclick = () => openLoanForm(null);
    return;
  }

  card.innerHTML = `
    <div class="rv-section-head mb-1">
      <p class="rv-eyebrow mb-0">Loan</p>
      <button class="rv-linkbtn" id="add-loan" type="button">+ Add</button>
    </div>
    <p class="rv-total rv-total-sm mb-1">₹${inr(remaining)}<span class="rv-total-unit"> left</span></p>
    <p class="rv-muted mb-2">₹${inr(used)} used · of ₹${inr(raised)} raised</p>
    <button class="rv-linkbtn" id="loan-detail" type="button">Where it's used →</button>`;
  card.querySelector('#add-loan').onclick = () => openLoanForm(null);
  card.querySelector('#loan-detail').onclick = () => openLoanDetail(data);
}

function openLoanForm(loan) {
  openForm({
    title: loan ? 'Edit loan' : 'Add loan',
    submitLabel: loan ? 'Save' : 'Add loan',
    fields: [
      { name: 'amount', label: 'Loan amount (₹)', type: 'number', min: 1, value: loan?.amount ?? '', required: true, placeholder: 'e.g. 50000' },
      { name: 'raised_on', label: 'Date raised', type: 'date', value: loan?.raised_on || todayStr() },
      { name: 'source', label: 'Source (optional)', value: loan?.source || '', placeholder: 'e.g. Bank / family' },
    ],
    onSubmit: async (v) => {
      if (!v.amount || Number(v.amount) <= 0) throw new Error('Enter a loan amount.');
      const payload = { amount: v.amount, raised_on: v.raised_on, source: v.source };
      if (loan) await loansApi.update({ id: loan.id, ...payload });
      else await loansApi.create(payload);
      await render();
    },
  });
}

function openLoanDetail(data) {
  ensureDetailModal();
  const raised = loanRaised(data.loans);
  const used = loanUsed(data.expenses);
  const remaining = raised - used;

  const usedExpenses = (data.expenses || [])
    .filter((e) => e.from_loan)
    .sort((a, b) => b.expense_date.localeCompare(a.expense_date));
  const loanEntries = (data.loans || [])
    .slice()
    .sort((a, b) => String(b.raised_on || '').localeCompare(String(a.raised_on || '')));

  const usedHTML = usedExpenses
    .map((e) => detailLine(e.name, fmtDay(e.expense_date), '₹' + inr(e.amount)))
    .join('');
  const raisedHTML = loanEntries
    .map(
      (l) => `<li class="rv-row-block">
        <div class="rv-row-line">
          <p class="rv-row-title mb-0">${esc(l.source || 'Loan')}</p>
          <span class="rv-num">₹${inr(l.amount)}</span>
        </div>
        <p class="rv-row-sub mb-0 mt-1">${esc(fmtDay(l.raised_on))}</p>
        <div class="rv-row-actions">
          <button class="rv-chip" data-loan-edit="${esc(l.id)}" type="button">Edit</button>
          <button class="rv-chip rv-chip-danger" data-loan-del="${esc(l.id)}" type="button">Delete</button>
        </div>
      </li>`
    )
    .join('');

  detailEl.querySelector('#rvDetailTitle').textContent = 'Loan';
  detailEl.querySelector('#rvDetailBody').innerHTML = `
    <div class="rv-detail-net rv-owed">₹${inr(remaining)} left</div>
    <p class="rv-detail-formula">₹${inr(used)} used of ₹${inr(raised)} raised.</p>
    ${detailSection('Where it was used', usedHTML, 'No loan-funded bills yet.')}
    ${detailSection('Loans raised', raisedHTML, 'No loans recorded.')}
  `;

  detailEl.querySelectorAll('[data-loan-edit]').forEach((btn) => {
    btn.onclick = () => {
      detailModal.hide();
      openLoanForm(loanEntries.find((l) => l.id === btn.dataset.loanEdit));
    };
  });
  detailEl.querySelectorAll('[data-loan-del]').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('Delete this loan entry?')) return;
      await loansApi.remove(btn.dataset.loanDel);
      detailModal.hide();
      await render();
    };
  });

  detailModal.show();
}

function renderRecent(data) {
  const recent = (data.expenses || []).slice(0, 5);
  if (recent.length === 0) {
    els.recent.innerHTML = `<li class="rv-row rv-muted">No expenses logged yet.</li>`;
    return;
  }
  els.recent.innerHTML = recent
    .map(
      (e) => `
      <li class="rv-row">
        <div>
          <p class="rv-row-title mb-0">${esc(e.name)}</p>
          <p class="rv-row-sub mb-0">${fmtDay(e.expense_date)}${e.from_loan ? ' · loan' : e.settled ? '' : ' · deferred'}</p>
        </div>
        <span class="rv-num">₹${inr(e.amount)}</span>
      </li>`
    )
    .join('');
}

// ---- Person balance detail modal ----
let detailEl = null;
let detailModal = null;

function ensureDetailModal() {
  if (detailEl) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
  <div class="modal fade" id="rvDetailModal" tabindex="-1" aria-hidden="true" aria-labelledby="rvDetailTitle">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content rv-modal">
        <div class="modal-header">
          <h2 class="modal-title h5" id="rvDetailTitle">Balance</h2>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body" id="rvDetailBody"></div>
      </div>
    </div>
  </div>`.trim();
  detailEl = wrap.firstElementChild;
  document.body.appendChild(detailEl);
  detailModal = new window.bootstrap.Modal(detailEl);
}

function detailSection(title, itemsHTML, emptyMsg) {
  const body = itemsHTML
    ? `<ul class="rv-card rv-list">${itemsHTML}</ul>`
    : `<p class="rv-muted mb-0">${esc(emptyMsg)}</p>`;
  return `<p class="rv-eyebrow mt-3 mb-2">${esc(title)}</p>${body}`;
}

function detailLine(title, sub, amount) {
  return `<li class="rv-row">
    <div><p class="rv-row-title mb-0">${esc(title)}</p><p class="rv-row-sub mb-0">${esc(sub)}</p></div>
    <span class="rv-num">${esc(amount)}</span>
  </li>`;
}

function openPersonDetail(personId, data) {
  ensureDetailModal();
  const person = (data.people || []).find((p) => p.id === personId);
  const b = contributionBreakdown(personId, data.expenses, data.repayments);

  const itemsHTML = b.items
    .map((it) => {
      let sub = fmtDay(it.date) + (it.settled ? ' · settled' : ' · deferred');
      if (!it.isPayer) sub += ' · their share';
      return detailLine(it.name, sub, '₹' + inr(it.amount));
    })
    .join('');

  detailEl.querySelector('#rvDetailTitle').textContent = person ? person.name : 'Contribution';
  detailEl.querySelector('#rvDetailBody').innerHTML = `
    <div class="rv-detail-net rv-owed">RV owes ₹${inr(b.total)}</div>
    <p class="rv-detail-formula">${esc(person ? person.name : 'This person')}'s total put into RV — repaid first from profit.</p>
    ${detailSection('Bills they paid into', itemsHTML, 'No contributions yet.')}
  `;

  detailModal.show();
}

function wireChrome() {
  document.getElementById('logout-btn')?.addEventListener('click', logout);
  document.querySelectorAll('[data-action="add"]').forEach((b) =>
    b.addEventListener('click', async () => {
      const data = await getData();
      openAddExpense(data);
    })
  );
}

(async function main() {
  await requireSession();
  wireChrome();
  initExpenseModal(render); // re-render after a save
  try {
    await render();
  } catch (err) {
    els.recent.innerHTML = `<li class="rv-row rv-error-text">${esc(err.message)}</li>`;
  }
})();
