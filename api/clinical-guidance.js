import { db } from 'hatchable';
export const access='user';
export const methods=['GET'];
export default async function(req,res){
 const key=req.query?.profileKey||'my-health-story';
 const {rows}=await db.query('SELECT id,status,decision,note,ai_summary,created_at,updated_at FROM review_requests WHERE profile_key=$1 ORDER BY created_at DESC LIMIT 1',[key]);
 const r=rows[0];
 if(!r)return res.json({status:'none'});
 if(r.status!=='approved')return res.json({status:r.status,reviewId:r.id,message:'Your review is waiting for clinician confirmation. No AI medical guidance is shown yet.'});
 res.json({status:'approved',reviewId:r.id,summary:r.ai_summary,clinicianNote:r.note});
}