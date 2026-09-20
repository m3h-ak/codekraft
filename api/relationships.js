import { db } from 'hatchable';

export const access = 'public';
export const methods = ['GET'];

function pearson(a,b){
  const n=a.length;if(n<3)return null;
  const ma=a.reduce((s,x)=>s+x,0)/n, mb=b.reduce((s,x)=>s+x,0)/n;
  let num=0,da=0,dbb=0;
  for(let i=0;i<n;i++){const x=a[i]-ma,y=b[i]-mb;num+=x*y;da+=x*x;dbb+=y*y}
  return da&&dbb?num/Math.sqrt(da*dbb):0;
}
function median(xs){const a=xs.slice().sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function corrFor(a,b,lag){
  const x=[],y=[];
  for(let i=0;i<a.length;i++){const j=i+lag;if(j>=0&&j<b.length&&Number.isFinite(a[i])&&Number.isFinite(b[j])){x.push(a[i]);y.push(b[j])}}
  return {r:pearson(x,y),n:x.length};
}
function label(r){
  const ar=Math.abs(r);return ar>=0.7?'strong':ar>=0.45?'moderate':ar>=0.3?'weak':'very weak';
}
export default async function(req,res){
 const key=req.query?.profileKey;if(!key)return res.status(400).json({error:'profileKey required'});
 const days=Number(req.query?.days||90), maxLag=Math.min(7,Math.max(0,Number(req.query?.maxLag||3)));
 const {rows}=await db.query('SELECT event_date,metric,value_numeric,unit FROM health_events WHERE profile_key=$1 AND value_numeric IS NOT NULL AND event_date >= CURRENT_DATE - $2::int ORDER BY event_date ASC,id ASC',[key,days]);
 const byMetric=new Map();
 for(const r of rows){if(!byMetric.has(r.metric))byMetric.set(r.metric,new Map());byMetric.get(r.metric).set(String(r.event_date),Number(r.value_numeric))}
 const dates=[...new Set(rows.map(r=>String(r.event_date)))].sort();
 const metrics=[...byMetric.keys()].filter(m=>byMetric.get(m).size>=5);
 const relationships=[];
 for(let i=0;i<metrics.length;i++)for(let j=i+1;j<metrics.length;j++){
   const a=metrics[i],b=metrics[j], am=byMetric.get(a),bm=byMetric.get(b);
   let best=null;
   for(let lag=-maxLag;lag<=maxLag;lag++){
     const xs=[],ys=[];
     for(const d of dates){
       const di=dates.indexOf(d), bj=di+lag;if(bj<0||bj>=dates.length)continue;
       const v1=am.get(d),v2=bm.get(dates[bj]);if(Number.isFinite(v1)&&Number.isFinite(v2)){xs.push(v1);ys.push(v2)}
     }
     const r=pearson(xs,ys);if(r!=null&&(!best||Math.abs(r)>Math.abs(best.r)))best={r,lag,n:xs.length};
   }
   if(best&&best.n>=5&&Math.abs(best.r)>=0.3){
     const aDates=[...am.keys()],bDates=[...bm.keys()],overlap=aDates.filter(d=>bm.has(d));
     relationships.push({a,b,r:Math.round(best.r*100)/100,lagDays:best.lag,sampleSize:best.n,strength:label(best.r),overlapDays:overlap.length});
   }
 }
 relationships.sort((x,y)=>Math.abs(y.r)-Math.abs(x.r));
 const top=relationships.slice(0,30);
 const fatigue=top.filter(x=>x.a==='fatigue'||x.b==='fatigue').slice(0,10);
 res.json({profileKey:key,windowDays:days,maxLagDays:maxLag,metrics,relationships:top,fatigueRelationships:fatigue,interpretationRule:'These are statistical associations and temporal patterns, not proof of causation or a medical diagnosis.'});
}