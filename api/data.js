import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { getSplitVersionsWithShares } from '../lib/splits.js';
import { getSessionFromReq } from '../lib/session.js';

// ONE round-trip that feeds both the dashboard and the ledger. The client
// caches this and computes month totals, balances and the split-preview
// locally, so navigating between pages needs no further network calls.
export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const [people, expenses, repayments, splitVersions] = await Promise.all([
      supabaseAdmin.from('people').select('id, name, can_login').order('name'),
      supabaseAdmin
        .from('expenses')
        .select('id, name, amount, paid_by, settled, expense_date, note, created_at')
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('repayments')
        .select('id, expense_id, amount, repayment_date, repaid_by, funded_by, note')
        .order('repayment_date', { ascending: false }),
      getSplitVersionsWithShares(),
    ]);

    for (const r of [people, expenses, repayments]) {
      if (r.error) throw r.error;
    }

    return res.status(200).json({
      me: { name: session.name, isAdmin: !!session.isAdmin },
      people: people.data || [],
      expenses: expenses.data || [],
      repayments: repayments.data || [],
      splitVersions: splitVersions || [],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load data' });
  }
}
