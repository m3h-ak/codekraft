import { db } from 'hatchable';
export const access='admin';
export const methods=['POST'];
export default async function(req,res){
 const b=req.body||{};
 if(!b.reviewId||!['approved','rejected'].includes(b.decision))return res.status(400).json({error:'reviewId and decision required'});
 const {rows}=await db.query('UPDATE review_requests SET status=$1,decision=$2,note=$3,clinician_id=$4,updated_at=now() WHERE id=$5 RETURNING id,profile_key,status,decision,note,ai_summary',[b.decision,b.decision,b.note||null,req.member?.id||req.member?.handle||'admin',b.reviewId]);
 if(!rows.length)return res.status(404).json({error:'review not found'});
 res.json({review:rows[0]});
}