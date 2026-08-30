import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { getSession } from '../../../lib/session';

export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month'); // 'YYYY-MM'
  const paidBy = searchParams.get('paid_by');
  const settled = searchParams.get('settled'); // 'true' | 'false'

  let query = supabaseAdmin
    .from('expenses')
    .select('id, name, amount, paid_by, settled, expense_date, note, created_at, payer:paid_by(name)')
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (month) {
    const [y, m] = month.split('-').map(Number);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate = new Date(y, m, 0).getDate(); // last day of month
    const end = `${y}-${String(m).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`;
    query = query.gte('expense_date', start).lte('expense_date', end);
  }
  if (paidBy) query = query.eq('paid_by', paidBy);
  if (settled === 'true' || settled === 'false') query = query.eq('settled', settled === 'true');

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ expenses: data });
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, amount, paid_by, settled, expense_date, note } = body;

  if (!name || !amount || !paid_by || !expense_date) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }
  if (Number(amount) <= 0) {
    return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 });
  }

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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ expense: data }, { status: 201 });
}
