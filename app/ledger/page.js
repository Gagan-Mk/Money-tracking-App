import { supabaseAdmin } from '../../lib/supabaseAdmin';
import BottomNav from '../../components/BottomNav';
import ExpenseRowActions from '../../components/ExpenseRowActions';
import LedgerFilters from './LedgerFilters';

export const dynamic = 'force-dynamic';

function formatINR(n) {
  return Math.round(n).toLocaleString('en-IN');
}

export default async function LedgerPage({ searchParams }) {
  const { data: people } = await supabaseAdmin.from('people').select('id, name').order('name');

  let query = supabaseAdmin
    .from('expenses')
    .select('id, name, amount, paid_by, settled, expense_date, note, payer:paid_by(name)')
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (searchParams?.paid_by) query = query.eq('paid_by', searchParams.paid_by);
  if (searchParams?.settled === 'true') query = query.eq('settled', true);
  if (searchParams?.settled === 'false') query = query.eq('settled', false);
  if (searchParams?.month) {
    const [y, m] = searchParams.month.split('-').map(Number);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`;
    query = query.gte('expense_date', start).lte('expense_date', end);
  }

  const { data: expenses } = await query;

  const grouped = groupByMonth(expenses || []);
  const total = (expenses || []).reduce((s, e) => s + Number(e.amount), 0);

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-28 pt-8">
      <header className="mb-5">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-husk">Ruchi Vana</p>
        <h1 className="font-display text-2xl font-semibold text-parchment">Ledger</h1>
      </header>

      <LedgerFilters people={people || []} />

      <p className="mb-4 mt-4 text-sm text-husk">
        {expenses?.length || 0} expenses · ₹{formatINR(total)} total
      </p>

      {Object.keys(grouped).length === 0 && (
        <p className="rounded-2xl border border-bark bg-canopy p-5 text-sm text-husk">
          No expenses match these filters.
        </p>
      )}

      {Object.entries(grouped).map(([monthLabel, rows]) => (
        <section key={monthLabel} className="mb-6">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.15em] text-husk">
            {monthLabel}
          </p>
          <ul className="divide-y divide-bark rounded-2xl border border-bark bg-canopy">
            {rows.map((e) => (
              <li key={e.id} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-parchment">{e.name}</p>
                  <span className="ledger-num font-mono text-sm text-parchment">
                    ₹{formatINR(e.amount)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-husk">
                    Paid by {e.payer?.name || '—'}
                    {e.note ? ` · ${e.note}` : ''}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide ${
                      e.settled ? 'bg-leaf/20 text-leaf' : 'bg-rust/20 text-rust'
                    }`}
                  >
                    {e.settled ? 'Settled' : 'Deferred'}
                  </span>
                </div>
                <ExpenseRowActions expense={e} people={people || []} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <BottomNav />
    </main>
  );
}

function groupByMonth(expenses) {
  const groups = {};
  for (const e of expenses) {
    const d = new Date(e.expense_date);
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(e);
  }
  return groups;
}
