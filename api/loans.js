import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { getSessionFromReq } from '../lib/session.js';

export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const body = req.body || {};

  if (req.method === 'POST') {
    if (!body.amount || Number(body.amount) <= 0) {
      return res.status(400).json({ error: 'A loan amount greater than zero is required.' });
    }
    const { data, error } = await supabaseAdmin
      .from('loans')
      .insert({
        amount: Number(body.amount),
        raised_on: body.raised_on || new Date().toISOString().slice(0, 10),
        source: body.source ? String(body.source).trim() : null,
        note: body.note ? String(body.note).trim() : null,
        created_by: session.personId,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ loan: data });
  }

  if (req.method === 'PATCH') {
    if (!body.id) return res.status(400).json({ error: 'Loan id is required.' });
    const patch = {};
    if (body.amount !== undefined) {
      if (!body.amount || Number(body.amount) <= 0) {
        return res.status(400).json({ error: 'A loan amount greater than zero is required.' });
      }
      patch.amount = Number(body.amount);
    }
    if (body.raised_on !== undefined) patch.raised_on = body.raised_on || null;
    if (body.source !== undefined) patch.source = body.source ? String(body.source).trim() : null;
    if (body.note !== undefined) patch.note = body.note ? String(body.note).trim() : null;
    const { data, error } = await supabaseAdmin
      .from('loans')
      .update(patch)
      .eq('id', body.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ loan: data });
  }

  if (req.method === 'DELETE') {
    if (!body.id) return res.status(400).json({ error: 'Loan id is required.' });
    const { error } = await supabaseAdmin.from('loans').delete().eq('id', body.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
