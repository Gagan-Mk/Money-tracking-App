import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'rv_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecretKey() {
  return new TextEncoder().encode(process.env.SESSION_SECRET);
}

export async function signSession(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
