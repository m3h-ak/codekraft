import { db } from 'hatchable';

export const access = 'public';
export const methods = ['GET','POST'];

export default async function(req,res){
  if(req.method==='GET'){
    const key=req.query?.profileKey||'demo-aarushi';
    const r=await db.query('SELECT event_date,source_type,metric,value_numeric,unit,confidence FROM health_events WHERE profile_key=$1 ORDER BY event_date ASC,id ASC LIMIT 5000',[key]);
    return res.json({events:r.rows});
  }
  const b=req.body||{};
  if(!b.profileKey||!b.eventDate||!b.sourceType||!b.metric) return res.status(400).json({error:'profileKey, eventDate, sourceType and metric required'});
  const r=await db.query('INSERT INTO health_events(profile_key,event_date,source_type,metric,value_numeric,value_text,unit,confidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[b.profileKey,b.eventDate,b.sourceType,b.metric,b.valueNumeric??null,b.valueText??null,b.unit??null,b.confidence??1]);
  res.status(201).json({event:r.rows[0]});
}