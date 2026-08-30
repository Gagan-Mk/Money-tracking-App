import { supabaseAdmin } from '../lib/supabaseAdmin';
import { getSplitVersionsWithShares } from '../lib/splits';
import { computeBalances, monthTotal } from '../lib/balances';
import BalancesCard from '../components/BalancesCard';
import AddExpenseSheet from '../components/AddExpenseSheet';
import BottomNav from '../components/BottomNav';

export const dynamic = 'force-dynamic';

function formatINR(n) {
  return Math.round(n).toLocaleString('en-IN');
}

export default async function DashboardPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [{ data: people }, { data: expenses }, splitVersions] = await Promise.all([
    supabaseAdmin.from('people').select('id, name, can_login').order('name'),
    supabaseAdmin
      .from('expenses')
      .select('id, name, amount, paid_by, settled, expense_date')
      .order('expense_date', { ascending: false }),
    getSplitVersionsWithShares(),
  ]);

  const founders = (people || []).filter((p) => p.can_login);
  const allPayers = people || [];
  // computeBalances only assigns a split share to people who appear in
  // split_shares (the 3 founders) — non-login payers like Vyuh Gravity
  // still show up here with owedShare 0, so "RV owes VG" is just what it paid.
  const balances = computeBalances(expenses || [], allPayers, splitVersions);
  const thisMonthTotal = monthTotal(expenses || [], year, month);
  const recent = (expenses || []).slice(0, 5);

  const monthLabel = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-28 pt-8">
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-husk">Ruchi Vana</p>
        <h1 className="font-display text-2xl font-semibold text-parchment">Dashboard</h1>
      </header>

      <section className="mb-5 rounded-2xl border border-bark bg-canopy p-5">
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-husk">{monthLabel}</p>
        <p className="mt-1 font-display text-4xl font-semibold text-parchment">
          ₹{formatINR(thisMonthTotal)}
        </p>
        <p className="mt-1 text-sm text-husk">spent this month, all expenses</p>
      </section>

      <section className="mb-5">
        <BalancesCard balances={balances} />
      </section>

      <section>
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.15em] text-husk">
          Recent
        </p>
        <ul className="divide-y divide-bark rounded-2xl border border-bark bg-canopy">
          {recent.length === 0 && (
            <li className="p-5 text-sm text-husk">No expenses logged yet.</li>
          )}
          {recent.map((e) => (
            <li key={e.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm text-parchment">{e.name}</p>
                <p className="text-xs text-husk">
                  {new Date(e.expense_date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                  {!e.settled && ' · deferred'}
                </p>
              </div>
              <span className="ledger-num font-mono text-sm text-parchment">
                ₹{formatINR(e.amount)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <AddExpenseSheet people={allPayers} />
      <BottomNav />
    </main>
  );
}
