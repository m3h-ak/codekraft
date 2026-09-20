import { db } from 'hatchable';

export const access = 'user';
export const methods = ['GET'];

function median(xs){
  const a=xs.filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return null;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function avg(rows,metric){const xs=rows.filter(r=>r.metric===metric&&r.value_numeric!=null).map(r=>Number(r.value_numeric));return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null}
function dailyMedian(rows,metric,dateSet){
  const byDate=new Map();
  for(const r of rows){
    if(r.metric!==metric || r.value_numeric==null || !dateSet.has(r.event_date))continue;
    const a=byDate.get(r.event_date)||[];
    a.push(Number(r.value_numeric));
    byDate.set(r.event_date,a);
  }
  return [...byDate.values()].map(median).filter(Number.isFinite);
}
function pct(a,b){return a==null||b==null||a===0?null:Math.round((b-a)/Math.abs(a)*1000)/10}
function dayKey(r){return r.event_date}

export default async function(req,res){
  const key=req.query?.profileKey;
  if(!key){
    return res.json(await demo());
  }
  const {rows}=await db.query(
    `SELECT event_date,metric,value_numeric,unit,source_type,participant_id,study_day,source_table,raw_metric
       FROM health_events WHERE profile_key=$1 ORDER BY event_date ASC,id ASC`,[key]
  );
  if(!rows.length) return res.status(404).json({error:'No imported health data found for this participant.'});

  const dates=[...new Set(rows.map(dayKey))];
  const metrics=[...new Set(rows.map(r=>r.metric))].sort();
  const series=dates.map(date=>{
    const d=rows.filter(r=>r.event_date===date);
    const values=Object.fromEntries(metrics.map(metric=>[metric,avg(d,metric)]));
    return {
      date,
      studyDay:d.find(x=>x.study_day!=null)?.study_day??null,
      values,
      restingHR:values.resting_hr??null,
      hrv:values.hrv??null,
      sleep:values.sleep??null,
      activity:values.activity??null,
      glucose:values.glucose??null,
      temperature:values.temperature??null,
      stress:values.stress??null,
      steps:values.steps??null
    };
  });
  // Compare meaningful periods. For short test datasets (e.g. two weeks),
  // compare the first half with the second half rather than comparing one
  // first-day observation against the remaining days. For longer histories,
  // use the preceding 14 observed days as the baseline and the latest 14 as recent.
  const recentWindow=series.length<=28 ? Math.max(1,Math.floor(series.length/2)) : 14;
  const split=Math.max(1,series.length-recentWindow);
  const baseline=series.length<=28
    ? series.slice(0,split)
    : series.slice(Math.max(0,split-28),split);
  const recent=series.slice(split);
  const metricKeys=metrics;
  const changes={};
  const changeDetails={};
  const baselineDates=new Set(baseline.map(x=>x.date));
  const recentDates=new Set(recent.map(x=>x.date));
  for(const k of metricKeys){
    const base=dailyMedian(rows,k,baselineDates);
    const rec=dailyMedian(rows,k,recentDates);
    const baselineValue=median(base);
    const recentValue=median(rec);
    const changePct=pct(baselineValue,recentValue);
    const recent7=rec.slice(-7);
    const previous7=rec.slice(-14,-7);
    const recent7Value=median(recent7);
    const previous7Value=median(previous7);
    const trend7Pct=pct(previous7Value,recent7Value);
    changes[k]=changePct;
    changeDetails[k]={
      baseline:baselineValue==null?null:Math.round(baselineValue*100)/100,
      recent:recentValue==null?null:Math.round(recentValue*100)/100,
      changePct,
      recent7:recent7Value==null?null:Math.round(recent7Value*100)/100,
      previous7:previous7Value==null?null:Math.round(previous7Value*100)/100,
      trend7Pct,
      baselineDays:base.length,
      recentDays:rec.length
    };
  }
  const participant=rows[0].participant_id||key.replace(/^mcphases_/,'').replace(/^my-health-story_/,'');
  const sourceCounts={};
  for(const r of rows) sourceCounts[r.source_type]=(sourceCounts[r.source_type]||0)+1;
  const latestByMetric={};
  for(const r of rows) if(r.value_numeric!=null) latestByMetric[r.metric]={value:r.value_numeric,unit:r.unit,date:r.event_date};
  const signals=Object.entries(changes).filter(([,v])=>v!=null).map(([metric,change])=>({metric,change}));
  res.json({
    profile:{name:`mcPHASES participant ${participant}`,age:null,sex:null,concern:'Longitudinal multimodal health review'},
    participantId:participant, series, changes, changeDetails, signals, metrics,
    metadata:{eventCount:rows.length,metricCount:new Set(rows.map(r=>r.metric)).size,firstDate:dates[0],lastDate:dates.at(-1),sourceCounts,latestByMetric},
    symptoms:[],
    menstrual:{cycleDay:null,recentLengths:[],pattern:'See self-report / hormone signals'},
    labs:[],
    provenance:[...new Set(rows.map(r=>[r.metric,r.source_type]))]
  });
}

async function demo(){
  const days=84,start=new Date(Date.now()-(days-1)*86400000),series=[];
  for(let i=0;i<days;i++){const d=new Date(start.getTime()+i*86400000),c=i>=56;series.push({date:d.toISOString().slice(0,10),restingHR:Math.round(63+(c?4.8:0)),hrv:Math.round(58-(c?11:0)),sleep:+(7.45-(c?.8:0)).toFixed(1),activity:Math.round(8200-(c?2300:0)),glucose:Math.round(88+(c?4:0)),temperature:+(36.55+(c?.1:0)).toFixed(2),stress:c?4:2,steps:Math.round(8200-(c?2300:0))});}
  const baseline=series.slice(14,42),recent=series.slice(-14),keys=['restingHR','hrv','sleep','activity','glucose'];
  const changes=Object.fromEntries(keys.map(k=>[k,pct(avg(baseline,k),avg(recent,k))]));
  return {profile:{name:'Aarushi',age:24,sex:'Female',concern:'Fatigue + changing menstrual pattern'},series,changes,symptoms:[{name:'Fatigue',value:4,delta:2},{name:'Sleep quality',value:3,delta:-1},{name:'Stress',value:4,delta:2},{name:'Cramps',value:2,delta:0}],menstrual:{cycleDay:31,recentLengths:[29,31,36,34,38],pattern:'Increasing variability'},labs:[{name:'TSH',value:'4.8',unit:'mIU/L',previous:'2.9',range:'0.4–4.0',flag:'Above reference range'},{name:'Ferritin',value:'18',unit:'ng/mL',previous:'31',range:'15–150',flag:'Low-normal'},{name:'HbA1c',value:'5.4',unit:'%',previous:'5.2',range:'<5.7',flag:'Within reference range'}],provenance:[['Resting HR','Wearable-derived'],['Fatigue','Patient-reported'],['TSH','Lab-measured'],['Pattern interpretation','AI-inferred']]};
}