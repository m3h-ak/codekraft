import { db } from 'hatchable';

export const access = 'user';
export const methods = ['GET'];

function median(xs){const a=xs.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function mad(xs,m){const ds=xs.filter(Number.isFinite).map(x=>Math.abs(x-m));return median(ds)||0}
function direction(metric,delta){const inverse=['hrv','sleep','activity','steps'];const up=delta>0;return inverse.includes(metric)?(up?'down':'up'):(up?'up':'down')}
export default async function(req,res){
 const key=req.query?.profileKey;
 if(!key)return res.status(400).json({error:'profileKey required'});
 const {rows}=await db.query('SELECT event_date,metric,value_numeric,unit,source_type FROM health_events WHERE profile_key=$1 AND value_numeric IS NOT NULL ORDER BY event_date ASC,id ASC',[key]);
 if(!rows.length)return res.status(404).json({error:'No health events found.'});
 const dates=[...new Set(rows.map(r=>r.event_date))];
 const recentDates=dates.slice(-14);
 const baselineDates=dates.slice(Math.max(0,dates.length-42),Math.max(0,dates.length-14));
 const metrics=[...new Set(rows.map(r=>r.metric))];
 const findings=[];
 for(const metric of metrics){
   const byDate=new Map();
   for(const r of rows.filter(r=>r.metric===metric)){
     const arr=byDate.get(r.event_date)||[];
     arr.push(Number(r.value_numeric));
     byDate.set(r.event_date,arr);
   }
   const daily=new Map([...byDate].map(([d,vs])=>[d,median(vs)]));
   const base=baselineDates.map(d=>daily.get(d)).filter(Number.isFinite);
   const recentVals=recentDates.map(d=>daily.get(d)).filter(Number.isFinite);
   if(base.length<5||recentVals.length<2)continue;
   const med=median(base), scale=mad(base,med)||Math.max(Math.abs(med)*0.02,0.01);
   const recentMed=median(recentVals), delta=(recentMed-med)/Math.abs(med||1)*100;
   const threshold=Math.max(2.5*scale,Math.abs(med||1)*0.05);
   const dev=Math.abs(recentMed-med)>threshold;
   let persistent=0;
   for(const d of recentDates){
     const v=daily.get(d);
     if(Number.isFinite(v)&&Math.abs(v-med)>threshold)persistent++;
   }
   if(dev)findings.push({metric,baseline:med,recent:recentMed,changePct:Math.round(delta*10)/10,direction:direction(metric,delta),persistentDays:persistent,daysObserved:recentVals.length,unit:rows.find(r=>r.metric===metric)?.unit||null,source:rows.find(r=>r.metric===metric)?.source_type||null});
 }
 const significant=findings.filter(f=>f.persistentDays>=3).sort((a,b)=>b.persistentDays-a.persistentDays);
 const cutoff=recentDates[0];
 const pairs=[];
 for(let i=0;i<significant.length;i++)for(let j=i+1;j<significant.length;j++){
   const a=significant[i],b=significant[j];
   const ar=new Set(rows.filter(r=>r.metric===a.metric&&r.event_date>=cutoff).map(r=>r.event_date));
   const br=new Set(rows.filter(r=>r.metric===b.metric&&r.event_date>=cutoff).map(r=>r.event_date));
   const overlap=[...ar].filter(d=>br.has(d));
   if(overlap.length>=3)pairs.push({metrics:[a.metric,b.metric],overlapDays:overlap.length});
 }
 res.json({profileKey:key,window:{baselineDays:baselineDates.length,recentDays:recentDates.length},findings:significant,pairs,persistenceRule:'Signal must remain outside its personal baseline threshold for at least 3 observed days.',calculation:'Daily median per metric; recent 14 observed days compared with the preceding 28 observed days.'});
}