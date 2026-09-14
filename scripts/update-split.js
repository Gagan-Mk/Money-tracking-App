// Use this whenever the 3-way split ratio needs to change.
// It adds a NEW split version starting from a given date — every expense
// dated before that date keeps using whichever version was active back
// then, so past months are never recalculated.
//
// 1. Edit NEW_START_DATE and NEW_SPLIT below (use the founders' usernames
//    exactly as set in scripts/seed.js).
// 2. Run:  node scripts/update-split.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ---- EDIT THIS SECTION ----
const NEW_START_DATE = '2027-01-01';
const NEW_SPLIT = {
  gagan: 40,
  ankith: 30,
  yashas: 30,
};
// ---- END EDIT SECTION ----

async function main() {
  const totalPct = Object.values(NEW_SPLIT).reduce((a, b) => a + b, 0);
  if (Math.abs(totalPct - 100) > 0.01) {
    throw new Error(`NEW_SPLIT must add up to 100, got ${totalPct}`);
  }

  const { data: people, error: pErr } = await supabase
    .from('people')
    .select('id, username')
    .in('username', Object.keys(NEW_SPLIT));
  if (pErr) throw pErr;

  const { data: version, error: vErr } = await supabase
    .from('split_versions')
    .insert({ start_date: NEW_START_DATE })
    .select()
    .single();
  if (vErr) throw vErr;

  const shareRows = people.map((p) => ({
    version_id: version.id,
    person_id: p.id,
    percentage: NEW_SPLIT[p.username],
  }));
  const { error: sErr } = await supabase.from('split_shares').insert(shareRows);
  if (sErr) throw sErr;

  console.log(`New split active from ${NEW_START_DATE}. Expenses before this date are untouched.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
