import { db } from 'hatchable';

export const access = 'public';
export const methods = ['POST'];

export default async function(req, res) {
  const body = req.body || {};
  const profileKey = String(body.profileKey || 'demo-aarushi').slice(0,120);
  const note = String(body.note || '').slice(0,1000);
  const result = await db.query(
    "INSERT INTO review_requests (profile_key, note) VALUES ($1, $2) RETURNING id, status, created_at",
    [profileKey, note]
  );
  res.json({ok:true, request:result.rows[0]});
}