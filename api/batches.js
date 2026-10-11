import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { getSessionFromReq } from '../lib/session.js';

export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const body = req.body || {};

  if (req.method === 'POST') {
    if (!body.name || !String(body.name).trim()) {
      return res.status(400).json({ error: 'Batch name is required.' });
    }
    const active = body.is_active !== false; // default active
    if (active) await deactivateAll();
    const { data, error } = await supabaseAdmin
      .from('batches')
      .insert({
        name: String(body.name).trim(),
        started_on: body.started_on || null,
        bird_count: body.bird_count === '' || body.bird_count == null ? null : Number(body.bird_count),
        is_active: active,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ batch: data });
  }

  if (req.method === 'PATCH') {
    if (!body.id) return res.status(400).json({ error: 'Batch id is required.' });
    const patch = {};
    if (body.name != null) patch.name = String(body.name).trim();
    if (body.started_on !== undefined) patch.started_on = body.started_on || null;
    if (body.bird_count !== undefined)
      patch.bird_count = body.bird_count === '' || body.bird_count == null ? null : Number(body.bird_count);
    if (body.is_active === true) {
      await deactivateAll();
      patch.is_active = true;
    } else if (body.is_active === false) {
      patch.is_active = false;
    }
    const { data, error } = await supabaseAdmin
      .from('batches')
      .update(patch)
      .eq('id', body.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ batch: data });
  }

  if (req.method === 'DELETE') {
    if (!body.id) return res.status(400).json({ error: 'Batch id is required.' });
    const { error } = await supabaseAdmin.from('batches').delete().eq('id', body.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function deactivateAll() {
  // Only one batch is active at a time.
  await supabaseAdmin.from('batches').update({ is_active: false }).eq('is_active', true);
}
