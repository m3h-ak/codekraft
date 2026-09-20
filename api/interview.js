import { db } from 'hatchable';

export const access = 'user';
export const methods = ['POST'];

export default async function(req,res){
  const body=req.body||{};
  const answers=body.answers||{};
  const profileKey=body.profileKey||'demo-aarushi';
  const factors=[];
  if(answers.exercise==='intentional') factors.push('A deliberate reduction in activity temporally overlaps the recent changes.');
  if(answers.exercise==='harder') factors.push('Exercise becoming harder temporally overlaps the recent changes.');
  if(answers.stress==='high') factors.push('Higher stress/workload overlaps with the recent physiological changes.');
  if(answers.illness==='yes') factors.push('Recent illness is important context for interpreting short-term changes.');
  if(answers.meds==='new') factors.push('A medication or supplement change should be included in clinician review.');
  for(const [k,v] of Object.entries(answers)){
    await db.query('INSERT INTO interview_answers(profile_key,question_key,answer) VALUES($1,$2,$3)',[profileKey,k,String(v||'')]);
  }
  res.json({answered:Object.values(answers).filter(Boolean).length,factors,interpretation:'These answers add context; they do not establish a diagnosis.'});
}