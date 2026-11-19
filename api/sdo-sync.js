import { neon } from '@neondatabase/serverless';
import { timingSafeEqual } from 'node:crypto';
import { readMasterSheet } from '../lib/google-sdo-sheet.js';
import { normalizeSheet } from '../lib/sdo-document-model.js';
import { verifyInstitutionalToken,extractBearer } from '../lib/institutional-auth.js';
const same=(a,b)=>{
  const x=Buffer.from(String(a||''));const y=Buffer.from(String(b||''));
  return x.length>0&&x.length===y.length&&timingSafeEqual(x,y);
};
async function allowSync(req) {
  const token=extractBearer(req);
  if(process.env.CRON_SECRET&&same(token,process.env.CRON_SECRET))return 'vercel-cron';
  const user=await verifyInstitutionalToken(token);
  const allowed=String(process.env.INSTITUTIONAL_SYNC_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(!allowed.includes(user.email))throw new Error('No autorizado a sincronizar');
  return user.email;
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método no permitido'});
  let actor;
  try{actor=await allowSync(req);}catch{return res.status(403).json({error:'Autorización requerida para sincronizar'});}
  if(!process.env.DATABASE_URL)return res.status(503).json({error:'DATABASE_URL no configurada'});
  const sql=neon(process.env.DATABASE_URL);
  try{
    const rows=normalizeSheet(await readMasterSheet());
    // One upsert statement reconciles all 83 rows; no delete, no inferred changes to W/X/Y/Z.
    const payload=JSON.stringify(rows.map(({snapshot,source_row,content_hash})=>({
      code:snapshot.code,source_row,phase:snapshot.phase,title:snapshot.title,agent:snapshot.agent,
      audit_state:snapshot.audit_state,inventory_state:snapshot.inventory_state,
      source_note:snapshot.source_note,original_reference:snapshot.original_reference,
      technical_opinion:snapshot.technical_opinion,external_validation:snapshot.external_validation,
      proposal_url:snapshot.proposal_url,correction_qa:snapshot.correction_qa,
      snapshot,content_hash
    })));
    const statement=[
      'WITH incoming AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS i(code text,source_row integer,phase text,title text,agent text,audit_state text,inventory_state text,source_note text,original_reference text,technical_opinion text,external_validation text,proposal_url text,correction_qa text,snapshot jsonb,content_hash text)),',
      'prior AS MATERIALIZED (SELECT d.code,d.snapshot FROM ejenp_requerimientos_sdo.sdo_document_catalog_83 d JOIN incoming i USING(code)),',
      'updated AS (INSERT INTO ejenp_requerimientos_sdo.sdo_document_catalog_83 AS d(code,source_row,phase,title,agent,audit_state,inventory_state,source_note,original_reference,technical_opinion,external_validation,proposal_url,correction_qa,snapshot,content_hash)',
      'SELECT code,source_row,phase,title,agent,audit_state,inventory_state,source_note,original_reference,technical_opinion,external_validation,proposal_url,correction_qa,snapshot,content_hash FROM incoming',
      'ON CONFLICT(code) DO UPDATE SET source_row=EXCLUDED.source_row,phase=EXCLUDED.phase,title=EXCLUDED.title,agent=EXCLUDED.agent,audit_state=EXCLUDED.audit_state,inventory_state=EXCLUDED.inventory_state,source_note=EXCLUDED.source_note,original_reference=EXCLUDED.original_reference,technical_opinion=EXCLUDED.technical_opinion,external_validation=EXCLUDED.external_validation,proposal_url=EXCLUDED.proposal_url,correction_qa=EXCLUDED.correction_qa,snapshot=EXCLUDED.snapshot,content_hash=EXCLUDED.content_hash,version=d.version+1,changed_at=now()',
      'WHERE d.content_hash IS DISTINCT FROM EXCLUDED.content_hash RETURNING code,version,snapshot),',
      'history AS (INSERT INTO ejenp_requerimientos_sdo.sdo_document_changes_83(code,version,old_snapshot,new_snapshot,changed_fields)',
      'SELECT u.code,u.version,p.snapshot,u.snapshot,ARRAY(SELECT k FROM jsonb_object_keys(u.snapshot) AS k WHERE p.snapshot->k IS DISTINCT FROM u.snapshot->k) FROM updated u LEFT JOIN prior p USING(code) RETURNING id)',
      'SELECT (SELECT COUNT(*)::integer FROM incoming) source_count,(SELECT COUNT(*)::integer FROM history) changed_count'
    ].join(' ');
    const result=await sql.query(statement,[payload]);
    const stats=result[0];
    await sql.query('INSERT INTO ejenp_requerimientos_sdo.sdo_document_sync_runs_83(success,source_count,changed_count) VALUES (true,$1,$2)',[stats.source_count,stats.changed_count]);
    return res.status(200).json({ok:true,source_count:stats.source_count,changed_count:stats.changed_count,actor,at:new Date().toISOString()});
  }catch(error){
    console.error('SDO sync failed',error?.message);
    try{await sql.query('INSERT INTO ejenp_requerimientos_sdo.sdo_document_sync_runs_83(success,error_message) VALUES(false,$1)',[String(error?.message||'Error').slice(0,250)]);}catch{}
    return res.status(503).json({ok:false,error:'Sincronización fallida; último corte exitoso preservado'});
  }
}
