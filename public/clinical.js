(()=>{
const P='my-health-story';
const q=id=>document.getElementById(id);
async function load(){
 const a=await fetch('/api/menstrual-cycles/list?profileKey='+P);
 const b=await fetch('/api/menstrual-events/list?profileKey='+P);
 const g=await fetch('/api/clinical-guidance?profileKey='+P);
 const c=a.ok?(await a.json()).cycles||[]:[];
 const e=b.ok?(await b.json()).events||[]:[];
 const x=g.ok?await g.json():{status:'none'};
 if(q('cycleCount'))q('cycleCount').textContent=c.length;
 if(q('cycleHistoryCount'))q('cycleHistoryCount').textContent=c.length+' logged';
 if(q('cycleList'))q('cycleList').innerHTML=c.length?c.map(v=>'<div class="cycle-history-row"><div><strong>'+v.cycle_start+'</strong><span>'+(v.cycle_end?' → '+v.cycle_end:' · ongoing')+'</span></div><em>'+(v.flow||'Flow not recorded')+'</em></div>').join(''):'<div class="cycle-empty">No previous cycles yet.</div>';
 if(q('cycleStatus'))q('cycleStatus').textContent=c.length?'Latest cycle':'No cycle yet';
 if(q('cycleOverview'))q('cycleOverview').innerHTML=c.length?'<div class="cycle-stat"><strong>'+c[0].cycle_start+'</strong><span>latest start</span></div><div class="cycle-stat"><strong>'+(c[0].cycle_end||'Ongoing')+'</strong><span>end date</span></div><div class="cycle-stat"><strong>'+(c[0].flow||'—')+'</strong><span>flow</span></div>':'<div class="cycle-empty">Log your first cycle below to start building your history.</div>';
 if(q('menstrualEventList'))q('menstrualEventList').innerHTML=e.length?e.slice(0,20).map(v=>'<span class="event-chip"><b>'+v.event_date+'</b> '+String(v.event_type).replaceAll('_',' ')+'</span>').join(''):'<div class="cycle-empty">No events logged yet.</div>';
 if(q('approvedGuidance'))q('approvedGuidance').textContent=x.status==='approved'?(x.summary||'Clinician-approved guidance is available.'):(x.status==='pending'?'AI review is waiting for clinician confirmation.':'No clinician-approved guidance yet.');
}
async function sendReview(){
 if(q('clinicalReviewStatus'))q('clinicalReviewStatus').textContent='Reading changes, labs, symptoms and cycle data…';
 const r=await fetch('/api/ai-health-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profileKey:P})});
 const j=await r.json();
 if(q('clinicalReviewStatus'))q('clinicalReviewStatus').textContent=r.ok?'AI draft sent to clinician. Nothing will be shown as medical guidance until they confirm it. Review #'+j.reviewId:(j.error||'Could not create review.');
 load();
}
q('runClinicalReview')?.addEventListener('click',sendReview);
q('sendClinicalReview')?.addEventListener('click',sendReview);
q('cycleForm')?.addEventListener('submit',async e=>{e.preventDefault();const b={profileKey:P,cycleStart:q('cycleStart').value,cycleEnd:q('cycleEnd').value,flow:q('cycleFlow').value,notes:q('cycleNotes').value};const r=await fetch('/api/menstrual-cycles/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});q('cycleResult').textContent=r.ok?'Cycle saved.':'Could not save cycle.';if(r.ok){q('cycleForm').reset();await load();}});
q('menstrualEventForm')?.addEventListener('submit',async e=>{e.preventDefault();const b={profileKey:P,eventDate:q('eventDate').value,eventType:q('eventType').value,valueNumeric:q('eventValue').value,valueText:q('eventText').value,unit:q('eventUnit').value,notes:q('eventNotes')?.value||''};const r=await fetch('/api/menstrual-events/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});q('eventResult').textContent=r.ok?'Cycle event saved.':'Could not save event.';if(r.ok){q('menstrualEventForm').reset();await load();}});
load();
})();