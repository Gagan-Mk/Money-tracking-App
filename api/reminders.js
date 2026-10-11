import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { getSessionFromReq } from '../lib/session.js';

export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const body = req.body || {};

  if (req.method === 'POST') {
    if (!body.due_date || !body.title || !String(body.title).trim()) {
      return res.status(400).json({ error: 'Date and title are required.' });
    }
    const { data, error } = await supabaseAdmin
      .from('reminders')
      .insert({
        due_date: body.due_date,
        title: String(body.title).trim(),
        kind: body.kind || null,
        note: body.note ? String(body.note).trim() : null,
        done: !!body.done,
        created_by: session.personId,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ reminder: data });
  }

  if (req.method === 'PATCH') {
    if (!body.id) return res.status(400).json({ error: 'Reminder id is required.' });
    const patch = {};
    if (body.due_date != null) patch.due_date = body.due_date;
    if (body.title != null) patch.title = String(body.title).trim();
    if (body.kind !== undefined) patch.kind = body.kind || null;
    if (body.note !== undefined) patch.note = body.note ? String(body.note).trim() : null;
    if (body.done !== undefined) patch.done = !!body.done;
    const { data, error } = await supabaseAdmin
      .from('reminders')
      .update(patch)
      .eq('id', body.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ reminder: data });
  }

  if (req.method === 'DELETE') {
    if (!body.id) return res.status(400).json({ error: 'Reminder id is required.' });
    const { error } = await supabaseAdmin.from('reminders').delete().eq('id', body.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
