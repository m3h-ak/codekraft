export const access = 'public';
export const methods = ['GET'];

function seeded(i, offset=0) {
  const x = Math.sin(i * 12.9898 + offset * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export default async function(req, res) {
  const days = 84;
  const start = new Date(Date.now() - (days - 1) * 86400000);
  const series = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const current = i >= 56;
    const stress = current ? 1 : 0;
    series.push({
      date: d.toISOString().slice(0,10),
      restingHR: Math.round(63 + (current ? 4.8 : 0) + (seeded(i,1)-.5)*3),
      hrv: Math.round(58 - (current ? 11 : 0) + (seeded(i,2)-.5)*7),
      sleep: +(7.45 - (current ? .8 : 0) + (seeded(i,3)-.5)*.5).toFixed(1),
      activity: Math.round(8200 - (current ? 2300 : 0) + (seeded(i,4)-.5)*1200),
      glucose: +(88 + (current ? 4 : 0) + (seeded(i,5)-.5)*7).toFixed(0),
      temperature: +(36.55 + (current ? .10 : 0) + (seeded(i,6)-.5)*.08).toFixed(2),
      fatigue: Math.min(5, Math.max(1, Math.round(2 + stress*2 + (seeded(i,7)-.5))))
    });
  }
  const baseline = series.slice(14, 42);
  const recent = series.slice(-14);
  const avg = key => arr => arr.reduce((s,x)=>s+x[key],0)/arr.length;
  const pct = (a,b) => Math.round((b-a)/a*100);
  const metrics = ['restingHR','hrv','sleep','activity','glucose'];
  const changes = Object.fromEntries(metrics.map(k=>[k,pct(avg(k)(baseline),avg(k)(recent))]));
  res.json({
    profile:{name:'Aarushi',age:24,sex:'Female',concern:'Fatigue + changing menstrual pattern'},
    series, changes,
    symptoms:[{name:'Fatigue',value:4,delta:2},{name:'Sleep quality',value:3,delta:-1},{name:'Stress',value:4,delta:2},{name:'Cramps',value:2,delta:0}],
    menstrual:{cycleDay:31,recentLengths:[29,31,36,34,38],pattern:'Increasing variability'},
    labs:[
      {name:'TSH',value:'4.8',unit:'mIU/L',previous:'2.9',range:'0.4–4.0',flag:'Above reference range'},
      {name:'Ferritin',value:'18',unit:'ng/mL',previous:'31',range:'15–150',flag:'Low-normal'},
      {name:'HbA1c',value:'5.4',unit:'%',previous:'5.2',range:'<5.7',flag:'Within reference range'}
    ],
    provenance:[['Resting HR','Wearable-derived'],['Fatigue','Patient-reported'],['TSH','Lab-measured'],['Pattern interpretation','AI-inferred']]
  });
}