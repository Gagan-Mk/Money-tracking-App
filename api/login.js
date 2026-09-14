import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from '../lib/auth.js';
import { serializeCookie } from '../lib/cookies.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  const { data: person, error } = await supabaseAdmin
    .from('people')
    .select('id, name, username, password_hash, can_login, is_admin')
    .eq('username', String(username).trim().toLowerCase())
    .eq('can_login', true)
    .single();

  if (error || !person) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const valid = await bcrypt.compare(password, person.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = await signSession({
    personId: person.id,
    name: person.name,
    isAdmin: !!person.is_admin,
  });

  res.setHeader(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE, token, {
      maxAge: SESSION_MAX_AGE,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
    })
  );

  return res.status(200).json({ ok: true, name: person.name, isAdmin: !!person.is_admin });
}
