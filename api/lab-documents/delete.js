import { db, storage } from 'hatchable';

export const access = 'public';
export const methods = ['DELETE'];

export default async function(req,res){
  const id=Number(req.query?.id||req.body?.id);
  if(!Number.isFinite(id)) return res.status(400).json({error:'Invalid document id.'});
  const row=(await db.query('SELECT storage_key FROM lab_documents WHERE id=$1 LIMIT 1',[id])).rows[0];
  if(!row) return res.status(404).json({error:'Document not found.'});
  await storage.del(row.storage_key);
  await db.query('DELETE FROM lab_documents WHERE id=$1',[id]);
  res.json({ok:true});
}