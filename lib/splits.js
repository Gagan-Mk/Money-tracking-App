import { supabaseAdmin } from './supabaseAdmin';

// Fetches every split_version with its per-person shares attached,
// shaped for lib/balances.js: { id, start_date, shares: [{person_id, percentage}] }
export async function getSplitVersionsWithShares() {
  const { data: versions, error: vErr } = await supabaseAdmin
    .from('split_versions')
    .select('id, start_date')
    .order('start_date', { ascending: true });
  if (vErr) throw vErr;

  const { data: shares, error: sErr } = await supabaseAdmin
    .from('split_shares')
    .select('version_id, person_id, percentage');
  if (sErr) throw sErr;

  return versions.map((v) => ({
    ...v,
    shares: shares.filter((s) => s.version_id === v.id),
  }));
}
