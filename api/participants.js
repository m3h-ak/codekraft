import { db } from 'hatchable';

export const access = 'user';
export const methods = ['GET'];

export default async function(req,res){
  const base=req.query?.profileKey||'my-health-story';
  const {rows}=await db.query(
    `SELECT profile_key, participant_id, COUNT(*)::int AS event_count,
            MIN(event_date) AS first_date, MAX(event_date) AS last_date
       FROM health_events
      WHERE profile_key=$1 OR profile_key LIKE $2
      GROUP BY profile_key, participant_id
      ORDER BY participant_id NULLS LAST, profile_key`,
    [base, base+'_%']
  );
  res.json({profileKey:base,participants:rows.map(r=>({
    profileKey:r.profile_key,
    participantId:r.participant_id||r.profile_key.replace(base+'_',''),
    eventCount:r.event_count,
    firstDate:r.first_date,
    lastDate:r.last_date
  }))});
}