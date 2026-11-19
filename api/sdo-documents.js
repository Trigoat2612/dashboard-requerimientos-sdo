import { neon } from '@neondatabase/serverless';
import { toPublic } from '../lib/sdo-document-model.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=45, stale-while-revalidate=90');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({error:'Método no permitido'});
  if(!process.env.DATABASE_URL)return res.status(503).json({error:'DATABASE_URL no configurada'});
  try{
    const sql=neon(process.env.DATABASE_URL);
    const [docs,lastSync,lastSuccessfulSync,trend]=await Promise.all([
      sql.query('SELECT * FROM ejenp_requerimientos_sdo.sdo_document_catalog_83 ORDER BY source_row'),
      sql.query('SELECT executed_at,success,source_count,changed_count,error_message FROM ejenp_requerimientos_sdo.sdo_document_sync_runs_83 ORDER BY id DESC LIMIT 1'),
      sql.query('SELECT executed_at,source_count,changed_count FROM ejenp_requerimientos_sdo.sdo_document_sync_runs_83 WHERE success=true ORDER BY id DESC LIMIT 1'),
      sql.query('SELECT date_trunc(\'day\',changed_at)::date AS day,COUNT(*)::integer AS changes FROM ejenp_requerimientos_sdo.sdo_document_changes_83 GROUP BY 1 ORDER BY 1 DESC LIMIT 30')
    ]);
    const documents=docs.map(toPublic);
    return res.status(200).json({
      source:'Catalogo_83 · espejo Neon',generatedAt:new Date().toISOString(),
      count:documents.length,documents,sync:lastSync[0]||null,lastSuccessfulSync:lastSuccessfulSync[0]||null,changes:trend.reverse()
    });
  }catch(error){
    console.error('SDO document read failure',error?.message);
    return res.status(503).json({error:'Seguimiento documental no disponible',detail:'Revisar migración y acceso a Neon'});
  }
}
