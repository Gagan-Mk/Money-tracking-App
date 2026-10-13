import { requireSession, getData, logout, batches as batchesApi } from './api.js?v=4';
import { monthTotal, contributions, contributionBreakdown } from './balances.js?v=4';
import { inr, fmtDay, esc } from './format.js?v=4';
import { initExpenseModal, openAddExpense } from './add-expense.js?v=4';
import { activeBatch, deathsFor, dueLabel, kindLabel, todayStr } from './farm.js?v=4';
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
  const rows = contributions(data.expenses, data.people, data.repayments)
    .filter((b) => b.contributed > 0.5)
    .sort((a, b) => b.contributed - a.contributed);

  if (rows.length === 0) {
    els.balances.innerHTML = `<p class="rv-muted mb-0">No contributions yet.</p>`;
    return;
  }

  els.balances.innerHTML =
    `<ul class="rv-list-plain mb-0">` +
    rows
      .map(
        (b) => `<li class="rv-balance-row rv-balance-click" data-person="${esc(b.id)}" role="button" tabindex="0" title="See the bills behind this">
          <span>${esc(b.name)}<span class="rv-chevron">›</span></span>
          <span class="rv-num rv-owed">₹${inr(b.contributed)}</span>
        </li>`
      )
      .join('') +
    `</ul>`;

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
          <p class="rv-row-sub mb-0">${fmtDay(e.expense_date)}${e.settled ? '' : ' · deferred'}</p>
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
