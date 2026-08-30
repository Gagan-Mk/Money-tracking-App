import { cookies } from 'next/headers';
import { verifySession, SESSION_COOKIE } from './auth';

export async function getSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}
