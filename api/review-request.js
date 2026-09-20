import { db } from 'hatchable';
export const access='user';
export const methods=['GET','POST'];
export default async function(req,res){
 const key=req.query?.profileKey||req.body?.profileKey||'my-health-story';
 if(req.method==='GET'){
  const {rows}=await db.query('SELECT id,status,decision,note,created_at,updated_at FROM review_requests WHERE profile_key=$1 ORDER BY created_at DESC LIMIT 1',[key]);
  return res.json({review:rows[0]||null});
 }
 res.json({ok:true,message:'Use the clinical review action to submit the longitudinal evidence for clinician confirmation.'});
}