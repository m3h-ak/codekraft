import { db, ai } from 'hatchable';

export const access = 'user';
export const methods = ['POST'];

function parseJson(text){
  const raw=String(text||'').trim().replace(/^\`\`\`json\s*/i,'').replace(/^\`\`\`\s*/,'').replace(/\s*\`\`\`$/,'').trim();
  try{return JSON.parse(raw)}catch{}
  const start=raw.indexOf('{'),end=raw.lastIndexOf('}');
  if(start>=0&&end>start){try{return JSON.parse(raw.slice(start,end+1))}catch{}}
  return null;
}
function fallback(evidence){
  const changes=evidence.changes||{},qs=[];
  if(changes.sleep!=null&&Math.abs(Number(changes.sleep))>=5) qs.push({key:'sleep_change',question:'Did anything change your sleep around the time it shifted?',type:'single',options:['No clear change','New schedule or workload','Trouble falling or staying asleep','Pain, illness, or another symptom affected sleep']});
  if(changes.activity!=null&&Math.abs(Number(changes.activity))>=10) qs.push({key:'activity_change',question:'What best explains the change in your activity?',type:'single',options:['I intentionally changed it','I felt less able to exercise','My routine or environment changed','No meaningful change']});
  if(changes.resting_hr!=null||changes.hrv!=null) qs.push({key:'illness_recent',question:'Have you had an illness, infection, fever, or unusually difficult recovery recently?',type:'single',options:['No','Yes','Not sure']});
  qs.push({key:'medication_change',question:'Did any medication, supplement, or dose change around the time these changes began?',type:'single',options:['No','Yes','Not sure']});
  qs.push({key:'symptom_onset',question:'When did the main symptoms or changes first become noticeable?',type:'single',options:['Within the last week','1–4 weeks ago','More than a month ago','I am not sure']});
  return qs.slice(0,5);
}
export default async function(req,res){
  const body=req.body||{},key=body.profileKey||'my-health-story',answers=body.answers||{},profile=body.profile||{};
  const [{rows:events},{rows:cycles},{rows:menstrual},{rows:answersDb}]=await Promise.all([
    db.query('SELECT event_date,metric,value_numeric,value_text,unit,source_type FROM health_events WHERE profile_key=$1 ORDER BY event_date DESC,id DESC LIMIT 2500',[key]),
    db.query('SELECT cycle_start,cycle_end,flow,notes FROM menstrual_cycles WHERE profile_key=$1 ORDER BY cycle_start DESC LIMIT 12',[key]),
    db.query('SELECT event_date,event_type,value_numeric,value_text,unit,notes FROM menstrual_events WHERE profile_key=$1 ORDER BY event_date DESC LIMIT 150',[key]),
    db.query('SELECT question_key,answer,created_at FROM interview_answers WHERE profile_key=$1 ORDER BY created_at DESC LIMIT 100',[key])
  ]);
  const numeric={};
  for(const e of events){if(e.value_numeric==null)continue;(numeric[e.metric]||(numeric[e.metric]=[])).push(Number(e.value_numeric));}
  const changes={};
  for(const [m,a] of Object.entries(numeric)){if(a.length<4)continue;const recent=a.slice(0,Math.min(7,a.length)),older=a.slice(Math.min(7,a.length),Math.min(21,a.length));if(!older.length)continue;const ra=recent.reduce((x,y)=>x+y,0)/recent.length,oa=older.reduce((x,y)=>x+y,0)/older.length;changes[m]=oa?Math.round((ra-oa)/Math.abs(oa)*1000)/10:null;}
  const existing={...Object.fromEntries(answersDb.map(x=>[x.question_key,x.answer])),...answers};
  const evidence={profile,changes,healthEventCount:events.length,cycles,menstrualEvents:menstrual,recentAnswers:existing};
  let questions=[];
  try{
    const r=await ai.generateText({
      model:'gpt-5.4-mini',purpose:'pulsestory-adaptive-context-questions',
      system:'You generate adaptive patient-context questions for a longitudinal health app. Identify the highest-value missing context that could help a clinician understand an observed change. Do not diagnose, label conditions, recommend treatment, or imply an answer proves something is wrong. Ask only questions justified by the evidence. Prefer timing, symptom onset, medication/supplement changes, illness/recovery, sleep, activity, stress, diet, cycle/reproductive context, or other plausible confounders. Avoid repeating answered questions unless a new follow-up is justified. Return JSON only.',
      prompt:'Generate 3-5 useful context questions using the longitudinal evidence. Adapt them when answers change. Return {"questions":[{"key":"unique_key","question":"...","type":"single","options":["..."]}]} or type "text" with options []. Evidence: '+JSON.stringify(evidence).slice(0,18000),
      maxTokens:1400
    });
    const parsed=parseJson(r.text);questions=Array.isArray(parsed?.questions)?parsed.questions:[];
  }catch(e){}
  questions=questions.filter(q=>q&&q.key&&q.question&&!existing[q.key]).slice(0,5);
  if(!questions.length)questions=fallback(evidence).filter(q=>!existing[q.key]).slice(0,5);
  res.json({questions,updatedAt:new Date().toISOString()});
}