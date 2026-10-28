import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { getSplitVersionsWithShares } from '../lib/splits.js';
import { getSessionFromReq } from '../lib/session.js';

// ONE round-trip that feeds every page. The client caches this and computes
// totals, balances and the split-preview locally, so navigating between pages
// needs no further network calls.
export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const [people, expenses, repayments, splitVersions] = await Promise.all([
      // is_active / from_loan may not exist until db/v3.sql is run — fall back.
      resilientSelect(
        'people',
        'id, name, can_login, is_active',
        'id, name, can_login',
        { is_active: true },
        (q) => q.order('name')
      ),
      resilientSelect(
        'expenses',
        'id, name, amount, paid_by, settled, expense_date, note, from_loan, created_at',
        'id, name, amount, paid_by, settled, expense_date, note, created_at',
        { from_loan: false },
        (q) => q.order('expense_date', { ascending: false }).order('created_at', { ascending: false })
      ),
      supabaseAdmin
        .from('repayments')
        .select('id, expense_id, amount, repayment_date, repaid_by, funded_by, note')
        .order('repayment_date', { ascending: false }),
      getSplitVersionsWithShares(),
    ]);

    for (const r of [people, expenses, repayments]) {
      if (r.error) throw r.error;
    }

    // Flock + loan tables — tolerate absence (before their migration is run).
    const [batches, mortality, reminders, loans] = await Promise.all([
      safeSelect('batches', 'id, name, started_on, bird_count, is_active, created_at', 'created_at', false),
      safeSelect('mortality', 'id, batch_id, event_date, count, reason, prevention, note, created_at', 'event_date', false),
      safeSelect('reminders', 'id, due_date, title, kind, note, done, created_at', 'due_date', true),
      safeSelect('loans', 'id, amount, raised_on, source, note, created_at', 'raised_on', false),
    ]);

    return res.status(200).json({
      me: { name: session.name, isAdmin: !!session.isAdmin },
      people: people.data || [],
      expenses: expenses.data || [],
      repayments: repayments.data || [],
      splitVersions: splitVersions || [],
      batches,
      mortality,
      reminders,
      loans,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load data' });
  }
}

// Select fullCols; if that errors (e.g. a column doesn't exist yet), retry with
// baseCols and fill the missing fields with defaults.
async function resilientSelect(table, fullCols, baseCols, defaults, applyOrder) {
  let r = await applyOrder(supabaseAdmin.from(table).select(fullCols));
  if (r.error) {
    r = await applyOrder(supabaseAdmin.from(table).select(baseCols));
    if (r.error) return r;
    return { data: (r.data || []).map((row) => ({ ...defaults, ...row })), error: null };
  }
  return r;
}

async function safeSelect(table, columns, orderCol, ascending) {
  try {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(columns)
      .order(orderCol, { ascending });
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}
