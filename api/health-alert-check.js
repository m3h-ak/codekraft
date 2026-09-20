import { db, auth } from 'hatchable';
export const access='public';
export const methods=['POST'];
export default async function(req,res){
  const user=await auth.getUser(req);
  if(!user)return res.status(401).json({error:'Sign in required.'});
  const key=req.body?.profileKey;
  if(!key)return res.status(400).json({error:'profileKey required'});
  const {rows}=await db.query('SELECT metric,value_numeric FROM health_events WHERE profile_key=$1 AND value_numeric IS NOT NULL ORDER BY event_date DESC,id DESC LIMIT 3000',[key]);
  const by={};
  for(const r of rows){(by[r.metric]??=[]).push(Number(r.value_numeric));}
  const candidates=[];
  for(const [metric,vals] of Object.entries(by)){
    if(vals.length<14)continue;
    const recent=vals.slice(0,7),prior=vals.slice(7,14);
    const a=recent.reduce((x,y)=>x+y,0)/recent.length,b=prior.reduce((x,y)=>x+y,0)/prior.length;
    if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(b)<1e-9)continue;
    const pct=((a-b)/Math.abs(b))*100;
    if(Math.abs(pct)>=20)candidates.push({metric,pct});
  }
  const unique=candidates.slice(0,6);
  if(unique.length>=2){
    const metrics=unique.map(x=>x.metric);
    const title='Several health signals have changed together';
    const message='PulseStory noticed substantial recent changes across '+metrics.join(', ')+'. This does not identify a cause, but the pattern is persistent enough that it may be worth arranging a clinic visit and sharing your longitudinal brief with a clinician.';
    const {rows:existing}=await db.query('SELECT id FROM health_alerts WHERE profile_key=$1 AND created_at>now()-interval \'7 days\' AND dismissed_at IS NULL',[key]);
    if(!existing.length){
      const r=await db.query('INSERT INTO health_alerts(profile_key,severity,title,message,metrics_json) VALUES($1,$2,$3,$4,$5) RETURNING id,created_at',[key,'review',title,message,JSON.stringify(unique)]);
      return res.json({created:true,alert:{id:r.rows[0].id,severity:'review',title,message,metrics:unique}});
    }
  }
  res.json({created:false,signals:unique});
}