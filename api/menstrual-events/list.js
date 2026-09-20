import { db } from 'hatchable';
export const access='user';
export const methods=['GET'];
export default async function(req,res){
 const key=req.query?.profileKey||'my-health-story';
 const {rows}=await db.query('SELECT id,event_date,event_type,value_numeric,value_text,unit,notes FROM menstrual_events WHERE profile_key=$1 ORDER BY event_date DESC,id DESC LIMIT 200',[key]);
 res.json({profileKey:key,events:rows});
}