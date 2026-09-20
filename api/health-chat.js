import { db, ai, auth } from 'hatchable';
export const access='public';
export const methods=['POST'];
const clip=(v,n)=>JSON.stringify(v).slice(0,n);
export default async function(req,res){
  const user=await auth.getUser(req);
  if(!user)return res.status(401).json({error:'Sign in to ask questions about your health story.'});
  const key=req.body?.profileKey;
  const question=String(req.body?.question||'').trim();
  if(!key||!question)return res.status(400).json({error:'Question and profile are required.'});
  const [{rows:events},{rows:cycles},{rows:menstrual},{rows:labs},{rows:answers}]=await Promise.all([
    db.query('SELECT event_date,metric,value_numeric,value_text,unit,source_type FROM health_events WHERE profile_key=$1 ORDER BY event_date DESC,id DESC LIMIT 1200',[key]),
    db.query('SELECT cycle_start,cycle_end,flow,notes FROM menstrual_cycles WHERE profile_key=$1 ORDER BY cycle_start DESC LIMIT 12',[key]),
    db.query('SELECT event_date,event_type,value_numeric,value_text,unit,notes FROM menstrual_events WHERE profile_key=$1 ORDER BY event_date DESC LIMIT 120',[key]),
    db.query('SELECT document_date,title,document_type,provider,notes FROM lab_documents WHERE profile_key=$1 ORDER BY document_date DESC LIMIT 30',[key]),
    db.query('SELECT question_key,answer FROM interview_answers WHERE profile_key=$1 ORDER BY created_at DESC LIMIT 30',[key])
  ]);
  const evidence={events,cycles,menstrual,labDocuments:labs,contextAnswers:answers};
  try{
    const r=await ai.generateText({
      model:'gpt-5.4-mini',
      purpose:'pulsestory-health-chat',
      system:'You are PulseStory, a cautious longitudinal health-information assistant. Answer questions about the user\'s own recorded data in plain language. Start with observed facts from their timeline, distinguish patterns from causes, and say when the data is insufficient. Do not diagnose, prescribe, change medication, or claim certainty. Do not invent missing measurements. If the question suggests a potentially important persistent change, encourage arranging a clinician review rather than giving a treatment directive. For emergencies, tell the user to seek local emergency care. Keep answers concise and useful.',
      prompt:'User question: '+question+'\nLongitudinal evidence: '+clip(evidence,26000),
      maxTokens:1000
    });
    res.json({answer:r.text});
  }catch(e){res.status(502).json({error:'Chat is temporarily unavailable',detail:String(e.message||e)})}
}