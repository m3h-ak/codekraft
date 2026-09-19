import { db } from 'hatchable';

export const access = 'public';
export const methods = ['POST'];

function parseCSV(text){
  const rows=[]; let row=[], cell='', quote=false;
  for(let i=0;i<text.length;i++){const ch=text[i], next=text[i+1];
    if(ch==='"' && quote && next==='"'){cell+='"';i++;continue}
    if(ch==='"'){quote=!quote;continue}
    if(ch===',' && !quote){row.push(cell.trim());cell='';continue}
    if((ch==='\n'||ch==='\r')&&!quote){if(ch==='\r'&&next==='\n')i++;row.push(cell.trim());cell='';if(row.some(Boolean))rows.push(row);row=[];continue}
    cell+=ch;
  }
  if(cell||row.length){row.push(cell.trim());if(row.some(Boolean))rows.push(row)}
  return rows;
}
function num(v){const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:null}
export default async function(req,res){
  const file=(req.files||[]).find(f=>f.field==='file');
  if(!file) return res.status(400).json({error:'Upload a CSV file.'});
  if(file.buffer.length>8*1024*1024) return res.status(413).json({error:'CSV too large. Maximum 8 MB.'});
  const text=file.buffer.toString('utf8');
  const rows=parseCSV(text);
  if(rows.length<2) return res.status(400).json({error:'CSV needs a header row and at least one data row.'});
  const headers=rows[0].map(x=>x.toLowerCase().replace(/[^a-z0-9]+/g,'_'));
  const dateIdx=headers.findIndex(x=>/date|time|timestamp/.test(x));
  if(dateIdx<0) return res.status(400).json({error:'Could not find a date column.'});
  const profileKey=(req.body&&req.body.profileKey)||'imported-patient';
  const mappings={
    resting_hr:/resting.*hr|rhr/,
    hrv:/^hrv|heart.*variability/,
    sleep:/sleep.*(hour|duration)|sleep_hours/,
    activity:/step|activity/,
    glucose:/glucose/,
    temperature:/temp/,
    fatigue:/fatigue|energy/
  };
  let inserted=0;
  for(const row of rows.slice(1)){
    const date=row[dateIdx]; if(!date) continue;
    for(const [metric,re] of Object.entries(mappings)){
      const idx=headers.findIndex(h=>re.test(h));
      if(idx<0) continue;
      const value=num(row[idx]); if(value===null) continue;
      await db.query('INSERT INTO health_events(profile_key,event_date,source_type,metric,value_numeric,unit,confidence) VALUES($1,$2,$3,$4,$5,$6,$7)',[profileKey,date,'CSV upload',metric,value,null,0.95]);
      inserted++;
    }
  }
  res.json({ok:true,profileKey,rows:rows.length-1,eventsInserted:inserted,columns:headers});
}