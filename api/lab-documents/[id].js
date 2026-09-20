import { db, storage } from 'hatchable';

export const access = 'user';
export const methods = ['GET'];

export default async function(req,res){
  const id=Number(req.params.id);
  if(!Number.isFinite(id)) return res.status(400).send('Invalid document.');
  const row=(await db.query('SELECT storage_key FROM lab_documents WHERE id=$1 LIMIT 1',[id])).rows[0];
  if(!row) return res.status(404).send('Document not found.');
  const url=await storage.url(row.storage_key,{ttl:120});
  return res.redirect(302,url);
}