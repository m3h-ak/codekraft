import { db, auth } from 'hatchable';
export const access='public';
export const methods=['GET','POST'];

export default async function(req,res){
  const user=await auth.getUser(req);
  if(!user) return res.json({signedIn:false});
  const source=req.body?.sourceProfileKey||req.query?.sourceProfileKey||null;
  let {rows}=await db.query('SELECT user_id,email,profile_key FROM account_profiles WHERE user_id=$1',[user.id]);
  if(!rows.length){
    let profileKey='user-'+String(user.id).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80);
    if(source==='my-health-story'){
      const {rows:claimed}=await db.query('SELECT user_id FROM account_profiles WHERE profile_key=$1',[source]);
      if(!claimed.length) profileKey=source;
    }
    const r=await db.query('INSERT INTO account_profiles(user_id,email,profile_key) VALUES($1,$2,$3) RETURNING user_id,email,profile_key',[user.id,user.email||null,profileKey]);
    rows=r.rows;
  }else{
    await db.query('UPDATE account_profiles SET email=$2,last_seen_at=now() WHERE user_id=$1',[user.id,user.email||null]);
  }
  if(req.method==='POST'&&req.body?.profile){
    await db.query('UPDATE account_profiles SET profile_json=$2,last_seen_at=now() WHERE user_id=$1',[user.id,JSON.stringify(req.body.profile)]);
  }
  const latest=await db.query('SELECT profile_key,profile_json FROM account_profiles WHERE user_id=$1',[user.id]);
  res.json({signedIn:true,user:{id:user.id,email:user.email,name:user.name,image:user.image},profileKey:latest.rows[0].profile_key,profile:latest.rows[0].profile_json?JSON.parse(latest.rows[0].profile_json):null});
}