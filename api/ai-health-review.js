import { db, ai, email } from 'hatchable';
export const access='user';
export const methods=['POST'];
const clip=(v,n)=>JSON.stringify(v).slice(0,n);
export default async function(req,res){
 const key=req.body?.profileKey||'my-health-story';
 const [{rows:events},{rows:cycles},{rows:menstrual},{rows:labs},{rows:context}]=await Promise.all([
  db.query('SELECT event_date,metric,value_numeric,value_text,unit,source_type FROM health_events WHERE profile_key=$1 ORDER BY event_date DESC,id DESC LIMIT 3000',[key]),
  db.query('SELECT cycle_start,cycle_end,flow,notes FROM menstrual_cycles WHERE profile_key=$1 ORDER BY cycle_start DESC LIMIT 24',[key]),
  db.query('SELECT event_date,event_type,value_numeric,value_text,unit,notes FROM menstrual_events WHERE profile_key=$1 ORDER BY event_date DESC LIMIT 300',[key]),
  db.query('SELECT document_date,title,document_type,provider,notes,original_filename FROM lab_documents WHERE profile_key=$1 ORDER BY document_date DESC NULLS LAST LIMIT 50',[key]),
  db.query('SELECT question_key,answer FROM interview_answers WHERE profile_key=$1 ORDER BY created_at DESC LIMIT 50',[key])
 ]);
 const evidence={healthEvents:events,menstrualCycles:cycles,menstrualEvents:menstrual,labDocuments:labs,context};
 const prompt='Review this longitudinal health evidence for a licensed clinician. Identify persistent/concerning patterns, low-risk actions that could be discussed, and investigations a clinician might consider. Do not diagnose, prescribe, or claim causation. For menstrual data, flag cycle irregularity, unusually persistent symptoms, or patterns that merit clinician review, but do not label a condition. Return concise JSON with summary, actions, tests, flags, questions. Evidence: '+clip(evidence,24000);
 let draft;
 try{
  const r=await ai.generateText({model:'gpt-5.4-mini',purpose:'pulsestory-clinical-review-draft',system:'You are a conservative clinical decision-support assistant. Every recommendation must be reviewed by a licensed clinician before the person sees it. Distinguish observations from hypotheses and uncertainty.',prompt,maxTokens:1800});
  draft=r.text;
 }catch(e){return res.status(502).json({error:'AI review draft unavailable',detail:String(e.message||e)})}
 const {rows}=await db.query('INSERT INTO review_requests (profile_key,status,ai_summary,evidence_json,updated_at) VALUES ($1,$2,$3,$4,now()) RETURNING id,status,created_at',[key,'pending',draft,clip(evidence,30000)]);
 const clinicianEmail='docrajivsingla@gmail.com';
 let emailed=false;
 try{
  await email.send({
   to:clinicianEmail,
   subject:'PulseStory clinician review request #'+rows[0].id,
   html:'<p>A PulseStory user has explicitly requested a clinician review.</p><p><b>Review #'+rows[0].id+'</b></p><p>The AI draft below is a decision-support draft and has not been presented as clinician-approved guidance.</p><pre style="white-space:pre-wrap;font-family:Arial,sans-serif">'+String(draft).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</pre><p>Please reply to this email or contact the patient through the appropriate clinical channel if you choose to review the request.</p>'
  });
  emailed=true;
 }catch(e){ console.error('clinician email failed',e); }
 res.json({status:'pending_clinician_review',reviewId:rows[0].id,emailed,message:emailed?'AI review draft emailed to Dr. Rajiv Singla. This does not mean the clinician has reviewed it yet.':'Review saved, but the clinician email could not be sent. No clinician review has occurred.'});
}