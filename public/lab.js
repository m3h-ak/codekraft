const LAB_PROFILE='my-health-story';
const lab$=id=>document.getElementById(id);
const labEsc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function loadLabDocs(){
  const r=await fetch('/api/lab-documents/list?profileKey='+encodeURIComponent(LAB_PROFILE));
  if(!r.ok)return;
  const j=await r.json(),docs=j.documents||[];
  lab$('labCount').textContent=docs.length+' document'+(docs.length===1?'':'s');
  lab$('labDocuments').innerHTML=docs.length?docs.map(d=>'<div class="lab"><div><b>'+labEsc(d.title)+'</b><small>'+labEsc(d.document_date||'Date not entered')+' · '+labEsc(d.document_type)+(d.provider?' · '+labEsc(d.provider):'')+' · '+labEsc(d.original_filename)+'</small>'+(d.notes?'<small>'+labEsc(d.notes)+'</small>':'')+'</div><div><a class="tag" href="'+labEsc(d.url)+'" target="_blank">Open</a> <button class="secondary" data-delete-lab="'+d.id+'">Delete</button></div></div>').join(''):'<p class="muted">No reports stored yet. Add your older blood tests and other medical documents here.</p>';
  document.querySelectorAll('[data-delete-lab]').forEach(b=>b.onclick=async()=>{
    if(!confirm('Delete this stored report?'))return;
    const rr=await fetch('/api/lab-documents/delete?id='+b.dataset.deleteLab,{method:'DELETE'});
    if(rr.ok)loadLabDocs();
  });
}
document.querySelector('[data-nav="records"]')?.addEventListener('click',loadLabDocs);
lab$('labForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const f=lab$('labFile').files[0]; if(!f)return;
  const fd=new FormData();
  fd.append('file',f);fd.append('profileKey',LAB_PROFILE);fd.append('title',lab$('labTitle').value);
  fd.append('documentDate',lab$('labDate').value);fd.append('documentType',lab$('labType').value);
  fd.append('provider',lab$('labProvider').value);fd.append('notes',lab$('labNotes').value);
  lab$('labResult').innerHTML='<div class="interpret">Storing your report…</div>';
  const r=await fetch('/api/lab-documents/upload',{method:'POST',body:fd});
  const j=await r.json();
  lab$('labResult').innerHTML='<div class="'+(r.ok?'success':'interpret')+'">'+(r.ok?'✓ Report stored in your health record.':'✕ '+labEsc(j.error||'Upload failed.'))+'</div>';
  if(r.ok){lab$('labForm').reset();loadLabDocs();}
});