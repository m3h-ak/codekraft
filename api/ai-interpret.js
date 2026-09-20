import { ai } from 'hatchable';

export const access = 'user';
export const methods = ['POST'];

export default async function(req,res){
  const body=req.body||{};
  const evidence=body.evidence;
  if(!evidence || typeof evidence !== 'object') return res.status(400).json({error:'evidence required'});
  const compact=JSON.stringify(evidence).slice(0,12000);
  try{
    const result=await ai.generateText({
      model:'gpt-5.4-mini',
      purpose:'pulsestory-clinical-interpretation',
      system:'You are a clinical data summarization assistant. Do not diagnose, recommend treatment, or independently order tests. Identify longitudinal changes, temporal relationships, missing context, contradictions, and questions that would help a clinician. Clearly distinguish measured facts from interpretation. Keep the output concise and clinician-ready.',
      prompt:'Analyze this longitudinal health evidence. Return exactly these five sections, each with a short heading on its own line: Meaningful changes; What changed together; Missing context; Questions for you; Clinician review. Use short bullets, plain language, and measured facts first. Never diagnose, prescribe, or imply certainty. Evidence: '+compact,
      maxTokens:1200
    });
    res.json({interpretation:result.text,usage:result.usage});
  }catch(e){
    res.status(502).json({error:'AI interpretation unavailable',detail:String(e.message||e)});
  }
}