import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');

// This client uses the SERVICE ROLE key and must only ever be imported
// from server-side code (API routes, server components) — never from
// anything that ships to the browser.
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  }
);
