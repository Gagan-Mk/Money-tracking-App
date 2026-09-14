import { getSessionFromReq } from '../lib/session.js';

export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  return res.status(200).json({ name: session.name, isAdmin: !!session.isAdmin });
}
