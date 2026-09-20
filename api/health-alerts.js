import { db, auth } from 'hatchable';
export const access='public';
export const methods=['GET','POST'];
export default async function(req,res){
  const user=await auth.getUser(req);
  if(!user)return res.status(401).json({error:'Sign in required.'});
  const key=req.body?.profileKey||req.query?.profileKey;
  if(!key)return res.status(400).json({error:'profileKey required'});
  if(req.method==='POST'&&req.body?.action==='dismiss'){
    await db.query('UPDATE health_alerts SET dismissed_at=now() WHERE id=$1 AND profile_key=$2',[req.body.id,key]);
  }
  const {rows:alerts}=await db.query('SELECT id,severity,title,message,metrics_json,created_at FROM health_alerts WHERE profile_key=$1 AND dismissed_at IS NULL ORDER BY created_at DESC LIMIT 10',[key]);
  res.json({alerts});
}