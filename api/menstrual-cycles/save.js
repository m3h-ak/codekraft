import { db } from 'hatchable';
export const access='public';
export const methods=['POST'];
export default async function(req,res){
 const b=req.body||{},key=b.profileKey||'my-health-story';
 if(!b.cycleStart)return res.status(400).json({error:'cycleStart required'});
 const {rows}=await db.query('INSERT INTO menstrual_cycles (profile_key,cycle_start,cycle_end,flow,notes) VALUES ($1,$2,$3,$4,$5) RETURNING id,cycle_start,cycle_end,flow,notes',[key,b.cycleStart,b.cycleEnd||null,b.flow||null,b.notes||null]);
 res.json({cycle:rows[0]});
}