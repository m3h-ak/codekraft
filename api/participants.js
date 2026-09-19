import { db } from 'hatchable';

export const access = 'public';
export const methods = ['GET'];

export default async function(req,res){
  const { rows } = await db.query(
    `SELECT profile_key,
            COALESCE(MAX(participant_id), profile_key) AS participant_id,
            MIN(event_date) AS first_date,
            MAX(event_date) AS last_date,
            COUNT(*)::int AS event_count,
            COUNT(DISTINCT metric)::int AS metric_count
       FROM health_events
      GROUP BY profile_key
      ORDER BY profile_key`
  );
  res.json({participants:rows});
}