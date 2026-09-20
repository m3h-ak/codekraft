import { db } from 'hatchable';
export const access='user';
export const methods=['GET'];
export default async function(req,res){
 const key=req.query?.profileKey||'my-health-story';
 const {rows}=await db.query('SELECT id,cycle_start,cycle_end,flow,notes FROM menstrual_cycles WHERE profile_key=$1 ORDER BY cycle_start DESC',[key]);
 res.json({profileKey:key,cycles:rows});
}