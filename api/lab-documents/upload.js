import { storage, db } from 'hatchable';
import crypto from 'node:crypto';

export const access = 'user';
export const methods = ['POST'];

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf','image/jpeg','image/png','image/webp']);

export default async function(req,res){
  const file=(req.files||[]).find(f=>f.field==='file');
  if(!file) return res.status(400).json({error:'No lab report file selected.'});
  if(file.buffer.length>MAX_BYTES) return res.status(413).json({error:'File too large. Maximum is 12 MB.'});
  if(!ALLOWED.has(file.contentType)) return res.status(415).json({error:'Please upload a PDF, JPG, PNG, or WebP file.'});

  const profileKey=String(req.body?.profileKey||'my-health-story');
  const title=String(req.body?.title||file.filename||'Lab report').trim().slice(0,200);
  const documentType=String(req.body?.documentType||'Lab report').trim().slice(0,80);
  const provider=String(req.body?.provider||'').trim().slice(0,160);
  const notes=String(req.body?.notes||'').trim().slice(0,2000);
  const documentDate=String(req.body?.documentDate||'').trim()||null;

  if(!title) return res.status(400).json({error:'Please give the report a title.'});

  const ext=(file.filename.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'');
  const key=`lab-documents/${profileKey}/${crypto.randomUUID()}.${ext}`;
  await storage.put(key,file.buffer,file.contentType);

  const {rows}=await db.query(
    `INSERT INTO lab_documents
      (profile_key,document_date,title,document_type,provider,notes,original_filename,storage_key,content_type,bytes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, document_date, title, document_type, provider, notes, original_filename, bytes, created_at`,
    [profileKey,documentDate,title,documentType,provider||null,notes||null,file.filename,key,file.contentType,file.buffer.length]
  );
  res.json({document:rows[0]});
}