import { SESSION_COOKIE } from '../lib/auth.js';
import { serializeCookie } from '../lib/cookies.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE, '', { maxAge: 0, path: '/' })
  );
  return res.status(200).json({ ok: true });
}
