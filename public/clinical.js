(()=>{
const P='my-health-story';
const q=id=>document.getElementById(id);
let cycles=[],events=[],calendarDate=new Date();
const pad=n=>String(n).padStart(2,'0');
const iso=(y,m,d)=>y+'-'+pad(m+1)+'-'+pad(d);
const parseDate=s=>{const [y,m,d]=String(s).slice(0,10).split('-').map(Number);return new Date(Date.UTC(y,m-1,d));};
const fmtMonth=d=>d.toLocaleString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
const sameDay=(a,b)=>a===b;
function cycleForDate(date){return cycles.find(c=>{const start=c.cycle_start;const end=c.cycle_end||c.cycle_start;return date>=start&&date<=end;});}
function renderCalendar(){
 const root=q('cycleOverview'); if(!root)return;
 if(!cycles.length){root.innerHTML='<div class="cycle-empty">Log your first cycle below to start building your history.</div>';return;}
 const y=calendarDate.getUTCFullYear(),m=calendarDate.getUTCMonth();
 const first=new Date(Date.UTC(y,m,1)),days=new Date(Date.UTC(y,m+1,0)).getUTCDate();
 const offset=(first.getUTCDay()+6)%7;
 const cells=[];
 for(let i=0;i<offset;i++)cells.push('<div class="cycle-day cycle-day-empty"></div>');
 for(let d=1;d<=days;d++){
   const date=iso(y,m,d),cycle=cycleForDate(date),dayEvents=events.filter(e=>e.event_date===date);
   const cls=['cycle-day'];if(cycle)cls.push('in-cycle');if(cycle&&date===cycle.cycle_start)cls.push('cycle-start');if(cycle&&cycle.cycle_end&&date===cycle.cycle_end)cls.push('cycle-end');
   const dots=dayEvents.slice(0,3).map(e=>'<i class="event-dot event-'+String(e.event_type).replace(/[^a-z0-9_-]/gi,'')+'" title="'+String(e.event_type).replaceAll('_',' ')+'"></i>').join('');
   cells.push('<button type="button" class="'+cls.join(' ')+'" data-calendar-date="'+date+'"><span>'+d+'</span><div>'+dots+'</div></button>');
 }
 root.innerHTML='<div class="calendar-wrap"><div class="calendar-toolbar"><button type="button" class="calendar-nav" id="calendarPrev" aria-label="Previous month">←</button><strong>'+fmtMonth(calendarDate)+'</strong><button type="button" class="calendar-nav" id="calendarNext" aria-label="Next month">→</button></div><div class="calendar-weekdays">'+['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>'<span>'+x+'</span>').join('')+'</div><div class="calendar-grid">'+cells.join('')+'</div><div class="calendar-legend"><span><i class="legend-cycle"></i> cycle days</span><span><i class="legend-event"></i> logged event</span></div></div>';
 q('calendarPrev').onclick=()=>{calendarDate=new Date(Date.UTC(y,m-1,1));renderCalendar()};
 q('calendarNext').onclick=()=>{calendarDate=new Date(Date.UTC(y,m+1,1));renderCalendar()};
 root.querySelectorAll('[data-calendar-date]').forEach(btn=>btn.onclick=()=>showDay(btn.dataset.calendarDate));
}
function showDay(date){
 const cycle=cycleForDate(date),dayEvents=events.filter(e=>e.event_date===date);
 const parts=[];if(cycle)parts.push('<b>Cycle day</b> · '+cycle.cycle_start+(cycle.cycle_end?' → '+cycle.cycle_end:' · ongoing'));
 if(dayEvents.length)parts.push(dayEvents.map(e=>String(e.event_type).replaceAll('_',' ')+(e.value_numeric!=null?' · '+e.value_numeric+(e.unit?' '+e.unit:''):'')+(e.value_text?' · '+e.value_text:'')).join('<br>'));
 const target=q('cycleDayDetail');if(target){target.innerHTML=parts.length?'<b>'+date+'</b><div>'+parts.join('<br>')+'</div>':'<b>'+date+'</b><div class="muted">No cycle or event data logged for this day.</div>';target.classList.add('visible');}
}
async function load(){
 const a=await fetch('/api/menstrual-cycles/list?profileKey='+P),b=await fetch('/api/menstrual-events/list?profileKey='+P),g=await fetch('/api/clinical-guidance?profileKey='+P);
 cycles=a.ok?(await a.json()).cycles||[]:[];events=b.ok?(await b.json()).events||[]:[];const x=g.ok?await g.json():{status:'none'};
 if(cycles.length){const latest=parseDate(cycles[0].cycle_start);calendarDate=new Date(Date.UTC(latest.getUTCFullYear(),latest.getUTCMonth(),1));}
 if(q('cycleCount'))q('cycleCount').textContent=cycles.length;if(q('cycleHistoryCount'))q('cycleHistoryCount').textContent=cycles.length+' logged';
 if(q('cycleList'))q('cycleList').innerHTML=cycles.length?cycles.map(v=>'<div class="cycle-history-row"><div><strong>'+v.cycle_start+'</strong><span>'+(v.cycle_end?' → '+v.cycle_end:' · ongoing')+'</span></div><em>'+(v.flow||'Flow not recorded')+'</em></div>').join(''):'<div class="cycle-empty">No previous cycles yet.</div>';
 if(q('cycleStatus'))q('cycleStatus').textContent=cycles.length?'Latest cycle':'No cycle yet';
 renderCalendar();
 const latest=cycles[0];if(q('cycleDayDetail')&&latest)q('cycleDayDetail').innerHTML='<b>'+latest.cycle_start+'</b><div>Select a day in the calendar to see logged events.</div>';
 if(q('menstrualEventList'))q('menstrualEventList').innerHTML=events.length?events.slice(0,20).map(v=>'<span class="event-chip"><b>'+v.event_date+'</b> '+String(v.event_type).replaceAll('_',' ')+'</span>').join(''):'<div class="cycle-empty">No events logged yet.</div>';
 if(q('approvedGuidance'))q('approvedGuidance').textContent=x.status==='approved'?(x.summary||'Clinician-approved guidance is available.'):(x.status==='pending'?'AI review is waiting for clinician confirmation.':'No clinician-approved guidance yet.');
}
async function sendReview(){if(q('clinicalReviewStatus'))q('clinicalReviewStatus').textContent='Reading changes, labs, symptoms and cycle data…';const r=await fetch('/api/ai-health-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profileKey:P})});const j=await r.json();if(q('clinicalReviewStatus'))q('clinicalReviewStatus').textContent=r.ok?'AI draft sent to clinician. Nothing will be shown as medical guidance until they confirm it. Review #'+j.reviewId:(j.error||'Could not create review.');load();}
q('runClinicalReview')?.addEventListener('click',sendReview);q('sendClinicalReview')?.addEventListener('click',sendReview);
q('cycleForm')?.addEventListener('submit',async e=>{e.preventDefault();const b={profileKey:P,cycleStart:q('cycleStart').value,cycleEnd:q('cycleEnd').value,flow:q('cycleFlow').value,notes:q('cycleNotes').value};const r=await fetch('/api/menstrual-cycles/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});q('cycleResult').textContent=r.ok?'Cycle saved.':'Could not save cycle.';if(r.ok){q('cycleForm').reset();await load();}});
q('menstrualEventForm')?.addEventListener('submit',async e=>{e.preventDefault();const b={profileKey:P,eventDate:q('eventDate').value,eventType:q('eventType').value,valueNumeric:q('eventValue').value,valueText:q('eventText').value,unit:q('eventUnit').value,notes:q('eventNotes')?.value||''};const r=await fetch('/api/menstrual-events/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});q('eventResult').textContent=r.ok?'Cycle event saved.':'Could not save event.';if(r.ok){q('menstrualEventForm').reset();await load();}});
load();
})();