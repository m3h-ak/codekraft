import { db, ai } from 'hatchable';

export const access = 'public';
export const methods = ['GET'];

const inverse = new Set(['hrv','sleep','activity','steps']);
const label = {
  resting_hr:'resting heart rate', hrv:'HRV', sleep:'sleep', activity:'activity',
  steps:'steps', stress:'stress', temperature:'temperature', glucose:'glucose',
  lh:'LH', estrogen:'estrogen', pdg:'PdG'
};

function median(a){const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2}
function mad(a,m){return median(a.map(v=>Math.abs(v-m)))||0}
function pearson(a,b){if(a.length<4)return null;const ma=a.reduce((s,x)=>s+x,0)/a.length,mb=b.reduce((s,x)=>s+x,0)/b.length;let n=0,da=0,db=0;for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;n+=x*y;da+=x*x;db+=y*y}return da&&db?n/Math.sqrt(da*db):null}
function fmt(x){return Math.round(x*10)/10}

export default async function(req,res){
 const key=req.query?.profileKey;
 if(!key)return res.status(400).json({error:'profileKey required'});
 const {rows}=await db.query('SELECT event_date,metric,value_numeric,unit,source_type FROM health_events WHERE profile_key=$1 AND value_numeric IS NOT NULL ORDER BY event_date ASC,id ASC',[key]);
 if(!rows.length)return res.status(404).json({error:'No numeric health events found.'});

 const dates=[...new Set(rows.map(r=>r.event_date))];
 const recentN=Math.min(14,Math.max(7,Math.floor(dates.length/4)));
 const recentDates=dates.slice(-recentN);
 const baseDates=dates.slice(Math.max(0,dates.length-recentN-28),Math.max(0,dates.length-recentN));
 const metrics=[...new Set(rows.map(r=>r.metric))];
 const findings=[];

 for(const metric of metrics){
   const all=rows.filter(r=>r.metric===metric);
   const base=all.filter(r=>baseDates.includes(r.event_date)).map(r=>Number(r.value_numeric));
   const recent=all.filter(r=>recentDates.includes(r.event_date)).map(r=>Number(r.value_numeric));
   if(base.length<5||recent.length<3)continue;
   const bm=median(base), rm=median(recent), scale=mad(base,bm)||Math.max(Math.abs(bm)*.02,.01);
   const delta=(rm-bm)/(Math.abs(bm)||1)*100;
   const threshold=Math.max(2.5*scale,Math.abs(bm)*.05);
   const persistent=recent.filter(v=>Math.abs(v-bm)>threshold).length;
   if(Math.abs(rm-bm)>threshold && persistent>=Math.max(3,Math.ceil(recent.length*.35))){
     findings.push({
       metric, label:label[metric]||metric, baseline:fmt(bm), recent:fmt(rm),
       changePct:fmt(delta), direction:inverse.has(metric)?(delta>0?'worse':'better'):(delta>0?'higher':'lower'),
       persistentDays:persistent, unit:all[0]?.unit||null
     });
   }
 }

 const pairs=[];
 const sig=findings.map(f=>f.metric);
 for(let i=0;i<sig.length;i++)for(let j=i+1;j<sig.length;j++){
   const a=sig[i],b=sig[j],mapA=new Map(),mapB=new Map();
   for(const r of rows.filter(x=>x.metric===a&&recentDates.includes(x.event_date)))mapA.set(r.event_date,Number(r.value_numeric));
   for(const r of rows.filter(x=>x.metric===b&&recentDates.includes(x.event_date)))mapB.set(r.event_date,Number(r.value_numeric));
   const ds=[...mapA.keys()].filter(d=>mapB.has(d));
   if(ds.length>=4){
     const r=pearson(ds.map(d=>mapA.get(d)),ds.map(d=>mapB.get(d)));
     if(r!=null&&Math.abs(r)>=.45)pairs.push({a,labelA:label[a]||a,b,labelB:label[b]||b,r:fmt(r),sampleSize:ds.length});
   }
 }

 const questions=[];
 const names=new Set(findings.map(f=>f.metric));
 if(names.has('activity'))questions.push('Did your activity decrease intentionally, or did exercise start feeling harder?');
 if(names.has('sleep'))questions.push('Did the change in sleep begin before or after the other symptoms?');
 if(names.has('stress'))questions.push('Was there a major change in work, study, relationships, illness, or routine around the time stress increased?');
 if(names.has('resting_hr'))questions.push('Did you notice palpitations, illness, dehydration, or a change in training when resting heart rate increased?');
 if(names.has('temperature'))questions.push('Were there changes in illness, medication, environment, or measurement conditions during the temperature shift?');
 if(!questions.length)questions.push('Is there any important change in symptoms, medication, routine, or life circumstances that is not represented in the data?');

 let synthesis=null;
 try{
   const compact=JSON.stringify({window:{baseline:baseDates[0],recent:recentDates[0],end:dates.at(-1)},findings,pairs}).slice(0,9000);
   const r=await ai.generateText({
     model:'gpt-mini',
     purpose:'pulsestory-story-engine',
     system:'You are PulseStory longitudinal reasoning. Summarize measured changes and co-occurring signals. Never diagnose. Never prescribe. Never claim causation from correlation. Explicitly separate observed data from interpretation and uncertainty. Suggest clinician review only when the pattern is persistent or multi-signal.',
     prompt:'Return 3 short sections: What changed; What changed together; What remains unknown. Evidence: '+compact,
     maxTokens:700
   });
   synthesis=r.text;
 }catch(e){synthesis=null}

 res.json({
   profileKey:key,
   window:{baselineStart:baseDates[0]||null,recentStart:recentDates[0]||null,end:dates.at(-1),recentDays:recentDates.length},
   findings:findings.sort((a,b)=>b.persistentDays-a.persistentDays),
   relationships:pairs,
   questions:questions.slice(0,5),
   synthesis,
   method:{
     baseline:'Up to 28 preceding observed days',
     deviation:'Median + robust MAD threshold',
     persistence:'At least 3 observed days and 35% of the recent window',
     relationship:'Pearson correlation on overlapping recent observations; correlation is not causation'
   }
 });
}