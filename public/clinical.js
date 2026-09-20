const P='my-health-story';
const $=id=>document.getElementById(id);
async function load(){
 const a=await fetch('/api/menstrual-cycles/list?profileKey='+P);
 const b=await fetch('/api/menstrual-events/list?profileKey='+P);
 const g=await fetch('/api/clinical-guidance?profileKey='+P);
 const c=a.ok?(await a.json()).cycles||[]:[];
 const e=b.ok?(await b.json()).events||[]:[];
 const x=g.ok?await g.json():{status:'none'};
 if($('cycleList'))$('cycleList').textContent=c.length?c.map(v=>v.cycle_start+(v.cycle_end?' → '+v.cycle_end:'')+(v.flow?' · '+v.flow:'')).join('\n'):'No cycles logged yet.';
 if($('menstrualEventList'))$('menstrualEventList').textContent=e.length?e.slice(0,20).map(v=>v.event_date+' · '+v.event_type).join('\n'):'No cycle events logged yet.';
 if($('approvedGuidance'))$('approvedGuidance').textContent=x.status==='approved'?(x.summary||'Clinician-approved guidance is available.'):(x.status==='pending'?'AI review is waiting for clinician confirmation.':'No clinician-approved guidance yet.');
}
async function sendReview(){
 if($('clinicalReviewStatus'))$('clinicalReviewStatus').textContent='Reading changes, labs, symptoms and cycle data…';
 const r=await fetch('/api/ai-health-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profileKey:P})});
 const j=await r.json();
 if($('clinicalReviewStatus'))$('clinicalReviewStatus').textContent=r.ok?'AI draft sent to clinician. Nothing will be shown as medical guidance until they confirm it. Review #'+j.reviewId:(j.error||'Could not create review.');
 load();
}
$('runClinicalReview')?.addEventListener('click',sendReview);
$('sendClinicalReview')?.addEventListener('click',sendReview);
$('cycleForm')?.addEventListener('submit',async e=>{e.preventDefault();const b={profileKey:P,cycleStart:$('cycleStart').value,cycleEnd:$('cycleEnd').value,flow:$('cycleFlow').value,notes:$('cycleNotes').value};const r=await fetch('/api/menstrual-cycles/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});$('cycleResult').textContent=r.ok?'Cycle saved.':'Could not save cycle.';if(r.ok)load()});
$('menstrualEventForm')?.addEventListener('submit',async e=>{e.preventDefault();const b={profileKey:P,eventDate:$('eventDate').value,eventType:$('eventType').value,valueNumeric:$('eventValue').value,valueText:$('eventText').value,unit:$('eventUnit').value,notes:$('eventNotes').value};const r=await fetch('/api/menstrual-events/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});$('eventResult').textContent=r.ok?'Cycle event saved.':'Could not save event.';if(r.ok)load()});
load();