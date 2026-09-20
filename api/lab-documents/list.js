import { db, storage } from 'hatchable';

export const access = 'user';
export const methods = ['GET'];

export default async function(req,res){
  const profileKey=String(req.query?.profileKey||'my-health-story');
  const {rows}=await db.query(
    `SELECT id,document_date,title,document_type,provider,notes,original_filename,content_type,bytes,created_at
       FROM lab_documents
      WHERE profile_key=$1
      ORDER BY document_date DESC NULLS LAST, created_at DESC`,
    [profileKey]
  );
  const docs=await Promise.all(rows.map(async r=>({
    ...r,
    url:`/api/lab-documents/${r.id}`
  })));
  res.json({documents:docs});
}