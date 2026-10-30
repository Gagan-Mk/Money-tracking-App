import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'rv_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

// Sessions issued before this unix time are rejected. Bump it to force every
// signed-in device to re-authenticate (e.g. after a password / access change).
// Set 2026-10-30 when Ankith's access was revoked and the password rotated.
const SESSION_CUTOFF = 1793384182;

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
    // Reject sessions issued before the cutoff (revoked en masse).
    if (!payload.iat || payload.iat < SESSION_CUTOFF) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
