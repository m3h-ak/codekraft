import { db } from 'hatchable';
export const access='user';
export const methods=['POST'];
export default async function(req,res){
 const b=req.body||{},key=b.profileKey||'my-health-story';
 if(!b.eventDate||!b.eventType)return res.status(400).json({error:'eventDate and eventType required'});
 const {rows}=await db.query('INSERT INTO menstrual_events (profile_key,event_date,event_type,value_numeric,value_text,unit,notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,event_date,event_type,value_numeric,value_text,unit,notes',[key,b.eventDate,b.eventType,b.valueNumeric===''||b.valueNumeric==null?null:Number(b.valueNumeric),b.valueText||null,b.unit||null,b.notes||null]);
 res.json({event:rows[0]});
}