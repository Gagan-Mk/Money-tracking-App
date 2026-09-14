import { requireSession, getData, logout } from './api.js?v=4';
import { computeBalances, monthTotal, balanceBreakdown } from './balances.js?v=4';
import { inr, inrAbs, fmtDay, esc } from './format.js?v=4';
import { initExpenseModal, openAddExpense } from './add-expense.js?v=4';

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

  renderBalances(data);
  renderRecent(data);
}

function renderBalances(data) {
  const balances = computeBalances(data.expenses, data.people, data.splitVersions, data.repayments);

  const allSquare = balances.every((b) => Math.abs(b.net) <= 0.5);
  if (allSquare) {
    els.balances.innerHTML = `<p class="rv-muted mb-0">Everyone's square — no deferred dues right now.</p>`;
    return;
  }

  const rows = balances
    .slice()
    .sort((a, b) => b.net - a.net)
    .map((b) => {
      let val = '<span class="rv-num rv-flat">—</span>';
      if (b.net > 0.5) val = `<span class="rv-num rv-owed">₹${inrAbs(b.net)}</span>`;
      else if (b.net < -0.5) val = `<span class="rv-num rv-owes">owes RV ₹${inrAbs(b.net)}</span>`;
      return `<li class="rv-balance-row rv-balance-click" data-person="${esc(b.id)}" role="button" tabindex="0" title="See the transactions behind this">
        <span>${esc(b.name)}<span class="rv-chevron">›</span></span>${val}
      </li>`;
    })
    .join('');

  els.balances.innerHTML = `<ul class="rv-list-plain mb-0">${rows}</ul>`;

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
  const b = balanceBreakdown(personId, data.expenses, data.splitVersions, data.repayments);

  const netLine =
    b.net > 0.5
      ? `<span class="rv-owed">RV owes ₹${inrAbs(b.net)}</span>`
      : b.net < -0.5
      ? `<span class="rv-owes">Owes RV ₹${inrAbs(b.net)}</span>`
      : `<span class="rv-flat">Square</span>`;

  const paidHTML =
    b.paidItems.map((it) => detailLine(it.name, fmtDay(it.date), '₹' + inr(it.amount))).join('') +
    b.fundedItems.map((it) => detailLine('Repayment funded', fmtDay(it.date), '₹' + inr(it.amount))).join('');

  const shareHTML = b.shareItems
    .map((it) => detailLine(it.name, `${fmtDay(it.date)} · ${it.pct}% of ₹${inr(it.amount)}`, '₹' + inr(it.share)))
    .join('');

  detailEl.querySelector('#rvDetailTitle').textContent = person ? person.name : 'Balance';
  detailEl.querySelector('#rvDetailBody').innerHTML = `
    <div class="rv-detail-net">${netLine}</div>
    <p class="rv-detail-formula">Paid ₹${inr(b.paid)} − their share ₹${inr(b.owedShare)} = net ₹${inr(b.net)}</p>
    ${detailSection(
      `Paid — deferred expenses${b.fundedItems.length ? ' + funded repayments' : ''}`,
      paidHTML,
      'No deferred expenses paid.'
    )}
    ${detailSection(
      'Their share of deferred expenses',
      shareHTML,
      'No split share (e.g. Vyuh Gravity) — RV just owes back whatever it paid.'
    )}
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
