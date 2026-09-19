export const access = 'public';
export const methods = ['POST'];
export default async function(req,res){
  const body=req.body||{};
  const answers=body.answers||{};
  const answered=Object.values(answers).filter(Boolean).length;
  const factors=[];
  if(answers.exercise==='less') factors.push('Reduced activity may be contributing to the recent energy/sleep shift.');
  if(answers.stress==='high') factors.push('Higher stress/workload temporally overlaps with the recent physiological changes.');
  if(answers.illness==='yes') factors.push('Recent illness is an important alternative context for short-term changes.');
  if(answers.meds==='new') factors.push('A medication or supplement change should be included in clinician review.');
  res.json({answered,factors,interpretation:'These answers add context; they do not establish a diagnosis. The clinician should interpret the pattern alongside the full history and measured labs.'});
}