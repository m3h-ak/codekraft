import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];
export default async function(req,res){
 const status=req.query?.status||'pending';
 const {rows}=await db.query('SELECT id,profile_key,status,decision,note,ai_summary,created_at,updated_at FROM review_requests WHERE status=$1 ORDER BY created_at DESC',[status]);
 res.json({reviews:rows});
}