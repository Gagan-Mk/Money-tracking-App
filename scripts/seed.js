// One-time setup script.
// 1. Edit the FOUNDERS list and INITIAL_SPLIT below.
// 2. Run:  node scripts/seed.js
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment
// (e.g. `export $(cat .env.local | xargs)` first, or use a tool like dotenv).

import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ---- EDIT THIS SECTION ----
const FOUNDERS = [
  { name: 'Gagan', username: 'gagan', password: 'RV@141003', is_admin: true },
  { name: 'Ankith', username: 'ankith', password: 'RV@141003', is_admin: false },
  { name: 'Yashas', username: 'yashas', password: 'RV@141003', is_admin: false },
];

// Must add up to 100.
const INITIAL_SPLIT_START_DATE = '2026-01-01';
const INITIAL_SPLIT = {
  gagan: 35,
  ankith: 35,
  yashas: 30,
};
// ---- END EDIT SECTION ----

async function main() {
  const founderIds = {};

  for (const f of FOUNDERS) {
    const password_hash = await bcrypt.hash(f.password, 10);
    const { data, error } = await supabase
      .from('people')
      .insert({
        name: f.name,
        username: f.username,
        password_hash,
        can_login: true,
        is_admin: f.is_admin,
      })
      .select()
      .single();
    if (error) throw error;
    founderIds[f.username] = data.id;
    console.log(`Created founder: ${f.name} (${f.username})`);
  }

  const { data: vg, error: vgErr } = await supabase
    .from('people')
    .insert({ name: 'Vyuh Gravity', can_login: false })
    .select()
    .single();
  if (vgErr) throw vgErr;
  console.log('Created payer: Vyuh Gravity');

  const totalPct = Object.values(INITIAL_SPLIT).reduce((a, b) => a + b, 0);
  if (Math.abs(totalPct - 100) > 0.01) {
    throw new Error(`INITIAL_SPLIT must add up to 100, got ${totalPct}`);
  }

  const { data: version, error: vErr } = await supabase
    .from('split_versions')
    .insert({ start_date: INITIAL_SPLIT_START_DATE })
    .select()
    .single();
  if (vErr) throw vErr;

  const shareRows = Object.entries(INITIAL_SPLIT).map(([username, percentage]) => ({
    version_id: version.id,
    person_id: founderIds[username],
    percentage,
  }));
  const { error: sErr } = await supabase.from('split_shares').insert(shareRows);
  if (sErr) throw sErr;

  console.log('Seed complete. Founders can now log in with the usernames/passwords above.');
  console.log('Change those passwords in FOUNDERS before running this in production!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
