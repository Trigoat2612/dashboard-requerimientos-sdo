import { neon } from '@neondatabase/serverless';
import { verifyInstitutionalToken,extractBearer,authErrorResponse,protectedHeaders } from '../lib/institutional-auth.js';
export default async function handler(req,res) {
  protectedHeaders(res);
  if(req.method!=='GET')return res.status(405).json({error:'Método no permitido'});
  try{
    const identity=await verifyInstitutionalToken(extractBearer(req));
    const code=String(req.query?.code||'').trim();
    if(!/^\d+(?:\.\d+)*$/.test(code))return res.status(400).json({error:'Código inválido'});
    const sql=neon(process.env.DATABASE_URL);
    const [rows,changes]=await Promise.all([
      sql.query('SELECT code,source_row,phase,title,agent,source_note,original_reference,technical_opinion,external_validation,proposal_url,correction_qa,version,changed_at,snapshot FROM ejenp_requerimientos_sdo.sdo_document_catalog_83 WHERE code=$1',[code]),
      sql.query('SELECT version,changed_fields,changed_at FROM ejenp_requerimientos_sdo.sdo_document_changes_83 WHERE code=$1 ORDER BY version DESC LIMIT 40',[code])
    ]);
    if(!rows.length)return res.status(404).json({error:'Documento no encontrado'});
    return res.status(200).json({document:rows[0],changes,requestedBy:identity.email});
  }catch(error){return authErrorResponse(error,res);}
}
