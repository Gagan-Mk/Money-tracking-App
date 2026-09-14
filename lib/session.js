import { verifySession, SESSION_COOKIE } from './auth.js';

// Reads and verifies the signed session cookie from a Vercel/Node request.
// Returns the JWT payload ({ personId, name, isAdmin }) or null.
export async function getSessionFromReq(req) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  return verifySession(token);
}

function readCookie(req, name) {
  // Vercel parses cookies onto req.cookies; fall back to the raw Cookie header.
  if (req.cookies && typeof req.cookies[name] === 'string') return req.cookies[name];
  const header = req.headers?.cookie || '';
  const match = header.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}
