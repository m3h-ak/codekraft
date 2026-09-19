export const access = 'public';
export const methods = ['POST'];
export default async function(req,res){
  const body=req.body||{};
  res.json({ok:true,id:'review_'+Date.now(),status:'pending',profileKey:body.profileKey||'demo-aarushi',message:'Clinician review requested.'});
}