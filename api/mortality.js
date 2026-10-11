import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { getSessionFromReq } from '../lib/session.js';

export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const body = req.body || {};

  if (req.method === 'POST') {
    if (!body.event_date || !body.count || Number(body.count) <= 0) {
      return res.status(400).json({ error: 'Date and a count greater than zero are required.' });
    }
    const { data, error } = await supabaseAdmin
      .from('mortality')
      .insert({
        batch_id: body.batch_id || null,
        event_date: body.event_date,
        count: Number(body.count),
        reason: body.reason ? String(body.reason).trim() : null,
        prevention: body.prevention ? String(body.prevention).trim() : null,
        note: body.note ? String(body.note).trim() : null,
        created_by: session.personId,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ mortality: data });
  }

  if (req.method === 'PATCH') {
    if (!body.id) return res.status(400).json({ error: 'Mortality id is required.' });
    if (!body.event_date || !body.count || Number(body.count) <= 0) {
      return res.status(400).json({ error: 'Date and a count greater than zero are required.' });
    }
    const { data, error } = await supabaseAdmin
      .from('mortality')
      .update({
        batch_id: body.batch_id || null,
        event_date: body.event_date,
        count: Number(body.count),
        reason: body.reason ? String(body.reason).trim() : null,
        prevention: body.prevention ? String(body.prevention).trim() : null,
        note: body.note ? String(body.note).trim() : null,
      })
      .eq('id', body.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ mortality: data });
  }

  if (req.method === 'DELETE') {
    if (!body.id) return res.status(400).json({ error: 'Mortality id is required.' });
    const { error } = await supabaseAdmin.from('mortality').delete().eq('id', body.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
