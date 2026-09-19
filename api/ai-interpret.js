import { ai } from 'hatchable';

export const access = 'public';
export const methods = ['POST'];

export default async function(req,res){
  const body=req.body||{};
  const evidence=body.evidence;
  if(!evidence || typeof evidence !== 'object') return res.status(400).json({error:'evidence required'});
  const compact=JSON.stringify(evidence).slice(0,12000);
  try{
    const result=await ai.generateText({
      model:'gpt-mini',
      purpose:'pulsestory-clinical-interpretation',
      system:'You are a clinical data summarization assistant. Do not diagnose, recommend treatment, or independently order tests. Identify longitudinal changes, temporal relationships, missing context, contradictions, and questions that would help a clinician. Clearly distinguish measured facts from interpretation. Keep the output concise and clinician-ready.',
      prompt:'Analyze this longitudinal health evidence and return: 1) meaningful changes, 2) signals that co-occur, 3) missing context, 4) 3 highest-value follow-up questions, 5) a cautious clinician-review statement. Evidence: '+compact,
      maxTokens:1200
    });
    res.json({interpretation:result.text,usage:result.usage});
  }catch(e){
    res.status(502).json({error:'AI interpretation unavailable',detail:String(e.message||e)});
  }
}