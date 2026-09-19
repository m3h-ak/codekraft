export const access = 'public';
export const methods = ['GET'];

const days = Array.from({length: 56}, (_, i) => i);

function seeded(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function avg(arr) {
  return arr.reduce((a,b) => a+b, 0) / arr.length;
}

function buildSeries() {
  return days.map(i => {
    const phase = i < 30 ? 0 : 1;
    const sleep = Math.max(5.6, 7.35 - (phase ? (i - 29) * 0.045 : 0) + (seeded(i)-0.5)*0.45);
    const activity = Math.max(4200, 8600 - (phase ? (i - 29) * 140 : 0) + (seeded(i+7)-0.5)*700);
    const restingHr = 61 + (phase ? (i - 29) * 0.38 : 0) + (seeded(i+14)-0.5)*2.4;
    const hrv = 54 - (phase ? (i - 29) * 0.42 : 0) + (seeded(i+21)-0.5)*5;
    const temperature = 36.55 + Math.sin(i/5)*0.09 + (phase ? 0.02 : 0) + (seeded(i+28)-0.5)*0.035;
    const glucose = 91 + (phase ? (i - 29) * 0.35 : 0) + (seeded(i+35)-0.5)*8;
    return {
      day:i+1,
      sleep:+sleep.toFixed(2),
      activity:Math.round(activity),
      restingHr:+restingHr.toFixed(1),
      hrv:+hrv.toFixed(1),
      temperature:+temperature.toFixed(2),
      glucose:+glucose.toFixed(1)
    };
  });
}

export default async function(req, res) {
  const series = buildSeries();
  const baseline = series.slice(7, 22);
  const current = series.slice(-14);
  const metrics = {
    restingHr: {baseline:+avg(baseline.map(x=>x.restingHr)).toFixed(1), current:+avg(current.map(x=>x.restingHr)).toFixed(1), unit:'bpm'},
    sleep: {baseline:+avg(baseline.map(x=>x.sleep)).toFixed(2), current:+avg(current.map(x=>x.sleep)).toFixed(2), unit:'h'},
    activity: {baseline:+avg(baseline.map(x=>x.activity)).toFixed(0), current:+avg(current.map(x=>x.activity)).toFixed(0), unit:'steps'},
    hrv: {baseline:+avg(baseline.map(x=>x.hrv)).toFixed(1), current:+avg(current.map(x=>x.hrv)).toFixed(1), unit:'ms'},
    glucose: {baseline:+avg(baseline.map(x=>x.glucose)).toFixed(1), current:+avg(current.map(x=>x.glucose)).toFixed(1), unit:'mg/dL'},
    temperature: {baseline:+avg(baseline.map(x=>x.temperature)).toFixed(2), current:+avg(current.map(x=>x.temperature)).toFixed(2), unit:'°C'}
  };
  for (const m of Object.values(metrics)) {
    m.change = +(100*(m.current-m.baseline)/m.baseline).toFixed(1);
  }
  const findings = [
    {id:'hr', icon:'♥', title:'Resting heart rate is up', value:`${metrics.restingHr.change > 0 ? '+' : ''}${metrics.restingHr.change}%`, detail:`${metrics.restingHr.current} bpm vs ${metrics.restingHr.baseline} bpm personal baseline`, severity:'attention'},
    {id:'sleep', icon:'◒', title:'Sleep duration has fallen', value:`${metrics.sleep.change}%`, detail:`${metrics.sleep.current} h vs ${metrics.sleep.baseline} h baseline`, severity:'attention'},
    {id:'activity', icon:'↘', title:'Daily activity is lower', value:`${metrics.activity.change}%`, detail:`${metrics.activity.current} vs ${metrics.activity.baseline} steps/day`, severity:'context'},
    {id:'hrv', icon:'≈', title:'HRV has shifted downward', value:`${metrics.hrv.change}%`, detail:`${metrics.hrv.current} ms vs ${metrics.hrv.baseline} ms baseline`, severity:'context'}
  ];
  res.json({
    profile:{name:'Aarushi', age:24, sex:'Female', concern:'Fatigue + changing menstrual pattern', sourceCount:4},
    series, metrics, findings,
    symptoms:[
      {label:'Fatigue', intensity:4, delta:'+2'},
      {label:'Sleep quality', intensity:3, delta:'-1'},
      {label:'Cramps', intensity:2, delta:'0'},
      {label:'Stress', intensity:4, delta:'+2'}
    ],
    menstrual:{cycleDay:31, recentCycleLengths:[29,31,36,34,38], trend:'more variable'},
    labs:[
      {name:'TSH', latest:4.8, unit:'mIU/L', previous:2.9, range:'0.4–4.0'},
      {name:'Ferritin', latest:18, unit:'ng/mL', previous:31, range:'15–150'},
      {name:'HbA1c', latest:5.4, unit:'%', previous:5.2, range:'<5.7'}
    ],
    provenance:[
      {label:'Wearable-derived', value:'Fitbit-style daily metrics'},
      {label:'Patient-reported', value:'Symptoms + menstrual history'},
      {label:'Lab-measured', value:'TSH, ferritin, HbA1c'},
      {label:'AI-inferred', value:'Temporal patterns & change explanations'}
    ]
  });
}