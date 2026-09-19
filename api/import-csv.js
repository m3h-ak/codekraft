import { db } from 'hatchable';

export const access = 'public';
export const methods = ['POST'];

function parseCSV(text){const rows=[];let row=[],cell='',quote=false;for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];if(ch==='"'&&quote&&next==='"'){cell+='"';i++;continue}if(ch==='"'){quote=!quote;continue}if(ch===','&&!quote){row.push(cell.trim());cell='';continue}if((ch==='\n'||ch==='\r')&&!quote){if(ch==='\r'&&next==='\n')i++;row.push(cell.trim());cell='';if(row.some(Boolean))rows.push(row);row=[];continue}cell+=ch}if(cell||row.length){row.push(cell.trim());if(row.some(Boolean))rows.push(row)}return rows}
function num(v){const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:null}
function norm(x){return String(x??'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}
function metricFor(h,file){const s=(h+' '+file).toLowerCase();const rules=[
['resting_hr',/resting.?heart.?rate|resting.?hr/],['hrv',/heart.?rate.?variability|(^|_)rmssd(_|$)|(^|_)hrv(_|$)/],
['sleep',/minutes.?asleep|sleep.*duration/],['steps',/(^|_)steps?(_|$)/],['activity',/active.?minutes/],['glucose',/glucose.?value|glucose/],
['temperature',/nightly.?temperature|computed.?temperature/],['stress',/stress.?score/],['respiratory_rate',/respiratory.?rate/],
['calories',/calories/],['heart_rate',/(^|_)heart.?rate(_|$)/],['oxygen_variation',/oxygen.?variation/],['vo2_max',/vo.?2.?max/],
['distance',/distance/],['lh',/(^|_)lh(_|$)/],['estrogen',/(^|_)estrogen(_|$)/],['pdg',/(^|_)pdg(_|$)/],
['flow_volume',/flow.?volume/],['fatigue',/fatigue/],['sleep_issue',/sleepissue|sleep.?issue/],['cramps',/cramps/],
['headaches',/headaches/],['sore_breasts',/sorebreasts|sore.?breasts/],['mood_swing',/moodswing|mood.?swing/],
['appetite',/appetite/],['exercise_level',/exerciselevel|exercise.?level/],['stress_reported',/(^|_)stress(_|$)/],
['food_cravings',/foodcravings|food.?cravings/],['indigestion',/indigestion/],['bloating',/bloating/]
];return rules.find(([,re])=>re.test(s))?.[0]||null}
function participant(row,h){const i=h.findIndex(x=>['id','participant_id','participant'].includes(x));return i>=0&&row[i]?String(row[i]).trim():null}
function studyDay(row,h){const i=h.findIndex(x=>x==='day_in_study'||x.endsWith('_day_in_study'));const n=num(i>=0?row[i]:null);return n==null?null:Math.round(n)}
function eventDate(row,h){const i=h.findIndex(x=>/timestamp|datetime|date/.test(x));if(i>=0&&row[i]){const d=new Date(row[i]);if(!isNaN(d))return d.toISOString().slice(0,10)}const sd=studyDay(row,h);if(sd!=null){const d=new Date(Date.UTC(2020,0,1)+sd*86400000);return d.toISOString().slice(0,10)}return null}
function unit(metric){return {resting_hr:'bpm',hrv:'ms',sleep:'min',steps:'steps',activity:'min',glucose:'mg/dL',temperature:'°C',lh:'',estrogen:'',pdg:'',stress:'score'}[metric]||null}

export default async function(req,res){
 const uploaded=req.files||[];
 const jsonFiles=(req.body&&Array.isArray(req.body.files))?req.body.files:[];
 const files=[...uploaded,...jsonFiles.map(f=>({filename:f.name||f.filename,buffer:Buffer.from(String(f.content||''),'utf8')}))];
 if(!files.length)return res.status(400).json({error:'Upload at least one CSV.'});
 let inserted=0;const results=[];const profileKeys=new Set();

 for(const file of files){
  if(file.buffer.length>8*1024*1024){results.push({file:file.filename,error:'Skipped: file exceeds 8 MB.'});continue}
  const rows=parseCSV(file.buffer.toString('utf8'));
  if(rows.length<2){results.push({file:file.filename,error:'Skipped: no data rows.'});continue}
  const headers=rows[0].map(norm),sourceTable=file.filename.replace(/\.csv$/i,'');
  const events=[],participants=new Set(),metrics=new Set();
  for(const row of rows.slice(1)){
   const pid=participant(row,headers),sd=studyDay(row,headers),date=eventDate(row,headers);if(!date)continue;
   const profileBase=(req.body&&req.body.profileKey)||'mcphases';
   const profileKey=pid?profileBase+'_'+pid:profileBase;profileKeys.add(profileKey);
   if(pid)participants.add(pid);
   for(let i=0;i<headers.length;i++){
    const metric=metricFor(headers[i],file.filename);if(!metric)continue;
    const value=num(row[i]);if(value===null)continue;
    events.push({profile_key:profileKey,event_date:date,source_type:'mcPHASES',metric,value_numeric:value,unit:unit(metric),confidence:0.98,participant_id:pid,study_day:sd,source_table:sourceTable,raw_metric:rows[0][i]});
    metrics.add(metric);
   }
  }
  let fileInserted=0;
  if(events.length){
   const payload=JSON.stringify(events);
   const q=await db.query(
    `INSERT INTO health_events(profile_key,event_date,source_type,metric,value_numeric,unit,confidence,participant_id,study_day,source_table,raw_metric)
     SELECT profile_key,event_date,source_type,metric,value_numeric,unit,confidence,participant_id,study_day,source_table,raw_metric
     FROM jsonb_to_recordset($1::jsonb) AS x(profile_key text,event_date date,source_type text,metric text,value_numeric double precision,unit text,confidence double precision,participant_id text,study_day integer,source_table text,raw_metric text)`,
    [payload]
   );
   fileInserted=events.length;inserted+=events.length;
  } else fileInserted=0;
  results.push({file:file.filename,eventsInserted:fileInserted,participants:[...participants],metrics:[...metrics]});
 }
 res.json({ok:true,eventsInserted:inserted,files:results,profileKey:[...profileKeys][0]||((req.body&&req.body.profileKey)||'mcphases'),profileKeys:[...profileKeys]});
}