import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { getSessionFromReq } from '../lib/session.js';

export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  switch (req.method) {
    case 'POST':
      return createExpense(req, res, session);
    case 'PATCH':
      return updateExpense(req, res, session);
    case 'DELETE':
      return deleteExpense(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function createExpense(req, res, session) {
  const { name, amount, paid_by, settled, expense_date, note, repayments } = req.body || {};

  const invalid = validate({ name, amount, paid_by, expense_date });
  if (invalid) return res.status(400).json({ error: invalid });

  const { data, error } = await supabaseAdmin
    .from('expenses')
    .insert({
      name: name.trim(),
      amount: Number(amount),
      paid_by,
      settled: !!settled,
      expense_date,
      note: note ? note.trim() : null,
      created_by: session.personId,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // When an expense is settled, optional per-founder settlement rows are
  // stored as repayments (personal, or funded by Vyuh Gravity).
  if (settled && Array.isArray(repayments) && repayments.length > 0) {
    const records = repayments
      .filter((r) => r && r.repaid_by && r.amount && r.repayment_date)
      .map((r) => ({
        expense_id: data.id,
        repaid_by: r.repaid_by,
        amount: Number(r.amount),
        repayment_date: r.repayment_date,
        funded_by: r.funded_by || null,
        note: r.note ? r.note.trim() : null,
      }));

    if (records.length > 0) {
      const { error: repaymentError } = await supabaseAdmin.from('repayments').insert(records);
      if (repaymentError) return res.status(500).json({ error: repaymentError.message });
    }
  }

  return res.status(201).json({ expense: data });
}

async function updateExpense(req, res, session) {
  const { id, name, amount, paid_by, settled, expense_date, note } = req.body || {};

  if (!id) return res.status(400).json({ error: 'Expense id is required.' });
  const invalid = validate({ name, amount, paid_by, expense_date });
  if (invalid) return res.status(400).json({ error: invalid });

  const { data, error } = await supabaseAdmin
    .from('expenses')
    .update({
      name: name.trim(),
      amount: Number(amount),
      paid_by,
      settled: !!settled,
      expense_date,
      note: note ? note.trim() : null,
      created_by: session.personId,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ expense: data });
}

async function deleteExpense(req, res) {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Expense id is required.' });

  const { error } = await supabaseAdmin.from('expenses').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}

function validate({ name, amount, paid_by, expense_date }) {
  if (!name || !amount || !paid_by || !expense_date) return 'Missing required fields.';
  if (Number(amount) <= 0) return 'Amount must be greater than zero.';
  return null;
}
