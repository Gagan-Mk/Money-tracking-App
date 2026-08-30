import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from '../../../lib/auth';

export async function POST(request) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required.' }, { status: 400 });
  }

  const { data: person, error } = await supabaseAdmin
    .from('people')
    .select('id, name, username, password_hash, can_login, is_admin')
    .eq('username', username.trim().toLowerCase())
    .eq('can_login', true)
    .single();

  if (error || !person) {
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, person.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  const token = await signSession({
    personId: person.id,
    name: person.name,
    isAdmin: !!person.is_admin,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
