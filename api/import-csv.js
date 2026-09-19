import { db } from 'hatchable';

export const access = 'public';
export const methods = ['POST'];

function parseCSV(text){const rows=[];let row=[],cell='',quote=false;for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];if(ch==='"'&&quote&&next==='"'){cell+='"';i++;continue}if(ch==='"'){quote=!quote;continue}if(ch===','&&!quote){row.push(cell.trim());cell='';continue}if((ch==='\\n'||ch==='\\r')&&!quote){if(ch==='\\r'&&next==='\\n')i++;row.push(cell.trim());cell='';if(row.some(Boolean))rows.push(row);row=[];continue}cell+=ch}if(cell||row.length){row.push(cell.trim());if(row.some(Boolean))rows.push(row)}return rows}
function num(v){const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:null}
function norm(x){return String(x??'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}
function detectMetric(h,fileName){
 const s=`${h} ${fileName}`.toLowerCase();
 const rules=[
  ['resting_hr',/resting.?heart.?rate|resting.?hr|rhr/],
  ['hrv',/heart.?rate.?variability|(^|_)hrv(_|$)|rmssd/],
  ['sleep',/sleep.*duration|minutes.?asleep|time.?asleep|sleep_hours|sleep_score/],
  ['steps',/steps?|step.?count/],
  ['activity',/active.?minutes|activity/],
  ['glucose',/glucose|sgv/],
  ['temperature',/computed.?temperature|wrist.?temperature|skin.?temperature|temperature/],
  ['stress',/stress.?score|stress/],
  ['respiratory_rate',/respiratory.?rate|breathing.?rate/],
  ['calories',/calories|energy/],
  ['heart_rate',/(^|_)heart.?rate(_|$)/],
  ['oxygen_variation',/oxygen.?variation|spo2/],
  ['vo2_max',/vo.?2.?max/],
  ['distance',/distance/]
 ];
 return rules.find(([,re])=>re.test(s))?.[0]||null;
}
function studyDay(row,headers){
 const i=headers.findIndex(h=>h==='day_in_study'||h.endsWith('_day_in_study'));
 const n=num(i>=0?row[i]:null); return n==null?null:Math.round(n);
}
function participant(row,headers){
 const i=headers.findIndex(h=>h==='id'||h==='participant_id'||h==='participant');
 return i>=0&&row[i]?String(row[i]).trim():null;
}
function eventDate(row,headers){
 const i=headers.findIndex(h=>/timestamp|datetime|date|time/.test(h));
 if(i>=0&&row[i]){const d=new Date(row[i]);if(!isNaN(d))return d.toISOString().slice(0,10)}
 const sd=studyDay(row,headers); if(sd!=null){const d=new Date(Date.UTC(2000,0,1)+sd*86400000);return d.toISOString().slice(0,10)}
 return null;
}
export default async function(req,res){
 const file=(req.files||[]).find(f=>f.field==='file');
 if(!file)return res.status(400).json({error:'Upload a CSV file.'});
 if(file.buffer.length>8*1024*1024)return res.status(413).json({error:'CSV too large. Maximum 8 MB per file.'});
 const text=file.buffer.toString('utf8'),rows=parseCSV(text);
 if(rows.length<2)return res.status(400).json({error:'CSV needs a header row and at least one data row.'});
 const headers=rows[0].map(norm), sourceTable=file.filename.replace(/\\.csv$/i,'');
 const pidIdx=headers.findIndex(h=>h==='id'||h==='participant_id'||h==='participant');
 const sdIdx=headers.findIndex(h=>h==='day_in_study'||h.endsWith('_day_in_study'));
 const mappings=headers.map((h,i)=>({column:rows[0][i],normalized:h,metric:detectMetric(h,file.filename),numeric:rows.slice(1,Math.min(rows.length,101)).filter(r=>num(r[i])!=null).length}));
 const profileBase=(req.body&&req.body.profileKey)||'mcphases';
 let inserted=0,participants=new Set(),metrics=new Set();
 for(const row of rows.slice(1)){
   const pid=participant(row,headers), date=eventDate(row,headers); if(!date)continue;
   const profileKey=pid?`${profileBase}_${pid}`:profileBase;
   if(pid)participants.add(pid);
   const sd=sdIdx>=0?num(row[sdIdx]):null;
   for(let i=0;i<headers.length;i++){
     const metric=detectMetric(headers[i],file.filename); if(!metric)continue;
     const value=num(row[i]); if(value==null)continue;
     const unit=metric==='resting_hr'?'bpm':metric==='hrv'?'ms':metric==='sleep'?'min':metric==='steps'?'steps':metric==='temperature'?'°C':metric==='glucose'?'mg/dL':null;
     await db.query('INSERT INTO health_events(profile_key,event_date,source_type,metric,value_numeric,unit,confidence,participant_id,study_day,source_table,raw_metric) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[profileKey,date,'mcPHASES CSV',metric,value,unit,0.98,pid,sd,sourceTable,rows[0][i]]);
     inserted++;metrics.add(metric);
   }
 }
 res.json({ok:true,sourceTable,rows:rows.length-1,eventsInserted:inserted,participants:[...participants],metrics:[...metrics],mappings});
}