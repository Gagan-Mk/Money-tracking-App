import { requireSession, getData, logout } from './api.js';
import { computeBalances, monthTotal } from './balances.js';
import { inr, inrAbs, fmtDay, esc } from './format.js';
import { initExpenseModal, openAddExpense } from './add-expense.js';

const els = {
  monthLabel: document.getElementById('month-label'),
  monthTotal: document.getElementById('month-total'),
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

  renderBalances(data);
  renderRecent(data);
}

function renderBalances(data) {
  const balances = computeBalances(
    data.expenses,
    data.people, // all payers (founders + Vyuh Gravity)
    data.splitVersions,
    data.repayments
  );

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
      return `<li class="rv-balance-row"><span>${esc(b.name)}</span>${val}</li>`;
    })
    .join('');

  els.balances.innerHTML = `<ul class="rv-list-plain mb-0">${rows}</ul>`;
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
