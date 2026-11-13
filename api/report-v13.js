import { neon } from '@neondatabase/serverless';

const INCREMENTAL='INCREMENTAL_EVALUACION_USUARIO';
const n=x=>Number(x??0);
const delta=(a,b)=>Math.abs(n(a)-n(b));
const send=(res,status,obj)=>res.status(status).json(obj);

export function reconcileV13({manager,categories,rows,phases,byCode}){
 if(!manager)throw Error('Falta el indicador gerencial');
 const counts=new Map();
 for(const row of rows)counts.set(row.categoria_resumen_v13,(counts.get(row.categoria_resumen_v13)||0)+1);
 if(rows.length!==n(manager.total_solicitudes)||new Set(rows.map(r=>r.code)).size!==n(manager.codigos_unicos))throw Error('318 códigos no conciliados');
 if(categories.length!==6||categories.reduce((s,c)=>s+n(c.solicitudes),0)!==rows.length)throw Error('Seis categorías no conciliadas');
 for(const c of categories)if(counts.get(c.categoria_resumen_v13)!==n(c.solicitudes))throw Error('Clasificación discrepante: '+c.categoria_resumen_v13);
 const get=code=>n(categories.find(c=>c.categoria_resumen_v13===code)?.solicitudes);
 if(get(INCREMENTAL)!==n(manager.incrementales_evaluacion_usuario)||get('ALCANCE_SDO')!==n(manager.sdo)
  ||get('ALCANCE_BRECHA')!==n(manager.brechas)||get('DUPLICADO')!==n(manager.duplicados)
  ||get('EXTERNO_O_REFORMULACION')!==n(manager.sistemas_externos_y_reformulacion)
  ||get('CONFIGURACIONES_Y_AJUSTES')!==n(manager.configuraciones_y_ajustes))throw Error('Resumen incompatible con las seis categorías');
 const externals=rows.filter(r=>r.categoria_resumen_v13==='EXTERNO_O_REFORMULACION');
 if(externals.filter(x=>/Cambio directo en sistema externo/i.test(x.subcategoria_funcional_v13||'')).length!==n(manager.modificacion_sistema_externo)
 ||externals.filter(x=>/Reformular como funcionalidad EJE/i.test(x.subcategoria_funcional_v13||'')).length!==n(manager.reformular_para_eje))throw Error('52 / 34 casos externos no concilian');
 const proposals=rows.filter(x=>x.categoria_resumen_v13===INCREMENTAL);
 const pert=proposals.reduce((v,x)=>v+n(x.horas_pert_incrementales_propuestas),0);
 if(proposals.length!==n(manager.incrementales_evaluacion_usuario)||delta(pert,manager.horas_pert_incrementales)>.015)throw Error('122 propuestas o PERT inconciliables');
 if(phases.reduce((v,x)=>v+n(x.actividades),0)!==635||delta(phases.reduce((v,x)=>v+n(x.horas),0),manager.horas_pert_incrementales)>.015||byCode.length!==proposals.length)throw Error('635 WBS no concilian');
 const map=new Map(byCode.map(x=>[x.codigo,x]));
 if(proposals.some(x=>!map.has(x.code)||delta(x.horas_pert_incrementales_propuestas,map.get(x.code).horas_pert)>.015))throw Error('PERT WBS por solicitud no concilia');
 if(rows.some(x=>x.categoria_resumen_v13!==INCREMENTAL&&n(x.horas_pert_incrementales_propuestas)!==0))throw Error('Horas incrementales presentes fuera de propuestas');
 return {valid:true,requests:rows.length,proposals:proposals.length,activities:635,pert:Number(pert.toFixed(3)),checkedAt:new Date().toISOString()};
}

export async function loadSnapshot(sql){
 const [managers,categories,rows,phases,byCode,sdo,gaps]=await Promise.all([
  sql`SELECT * FROM ejenp_estimacion_v08.v00_informe_gerencial_v13`,
  sql`SELECT * FROM ejenp_estimacion_v08.v00_informe_categorias_v13`,
  sql`SELECT request_id,code,descripcion,especialidad,lote,hoja_fuente,fila_fuente,
   categoria_resumen_v13,categoria_visible_v13,subcategoria_funcional_v13,clasificacion_para_informe,
   criterio_decision_informe,horas_pert_incrementales_propuestas,estado_evaluacion_usuario_final,
   funcion_originalmente_exigible,ampliacion_funcional_analizada,motivo_exclusion_y_recomendacion,recomendacion_final,
   responsable_contractual_funcional,requisitos_sdo,brechas_relacionadas,requerimiento_maestro,
   estado_estimacion,metodo_empleado,justificacion_metodo,horas_optimistas,horas_mas_probables,horas_pesimistas,
   estimacion_id,agente_estimador,actividades_wbs,condiciones_pendientes,version_presentacion_v13,fecha_registro_informe
   FROM ejenp_estimacion_v08.v00_informe_matriz_318_v13 ORDER BY code`,
  sql`SELECT fase,COUNT(*)::integer actividades,ROUND(SUM(horas_pert),3) horas FROM ejenp_estimacion_v08.v00_informe_wbs_122_v13 GROUP BY fase ORDER BY horas DESC`,
  sql`SELECT codigo,COUNT(*)::integer actividades,ROUND(SUM(horas_pert),3) horas_pert FROM ejenp_estimacion_v08.v00_informe_wbs_122_v13 GROUP BY codigo ORDER BY codigo`,
  sql`SELECT code,description,verification_status,source_document_id FROM ejenp_requerimientos_sdo.sdo_requirements ORDER BY code`,
  sql`SELECT id,source_gap_code AS gap_code,source_sdo_code AS sdo_code,source_request_code AS request_code,source_description AS description,source_final_status,source_sheet,source_row FROM ejenp_v14_brechas.items ORDER BY id`
 ]);
 const manager=managers[0];
 const reconciliation=reconcileV13({manager,categories,rows,phases,byCode});
 return {access:'public_readonly_report',source:'Neon · informe técnico consolidado',
  generatedAt:new Date().toISOString(),manager,categories,rows,phases,byCode,sdo,gaps,reconciliation};
}
export async function loadDetail(sql,code){
 const [matrix,wbs,sdoLinks,gapLinks,evidence,assessments]=await Promise.all([
  sql`SELECT * FROM ejenp_estimacion_v08.v00_informe_matriz_318_v13 WHERE code=${code}`,
  sql`SELECT * FROM ejenp_estimacion_v08.v00_informe_wbs_122_v13 WHERE codigo=${code} ORDER BY fase,codigo_actividad`,
  sql`SELECT l.sdo_code AS code,l.relation,l.contractual_basis,l.origin,s.description,s.source_document_id,s.verification_status,d.title AS document_title,d.url AS document_url
    FROM ejenp_auditoria_318.sdo_links l JOIN ejenp_auditoria_318.requests r ON r.id=l.request_id
    LEFT JOIN ejenp_requerimientos_sdo.sdo_requirements s ON s.code=l.sdo_code
    LEFT JOIN ejenp_requerimientos_sdo.source_documents d ON d.id=s.source_document_id
    WHERE r.source_code=${code} ORDER BY l.sdo_code`,
  sql`SELECT l.gap_item_id AS id,l.relation,l.basis,g.source_gap_code AS code,g.source_sdo_code AS sdo_code,g.source_description AS description
    FROM ejenp_auditoria_318.gap_links l JOIN ejenp_auditoria_318.requests r ON r.id=l.request_id
    LEFT JOIN ejenp_v14_brechas.items g ON g.id=l.gap_item_id WHERE r.source_code=${code} ORDER BY l.gap_item_id`,
  sql`SELECT ev.document_ref,ev.locator,ev.evidence_type,ev.claim,ev.created_at
    FROM ejenp_auditoria_318.assessment_evidence ev
    JOIN ejenp_auditoria_318.technical_assessments a ON a.id=ev.assessment_id
    JOIN ejenp_auditoria_318.requests r ON r.id=a.request_id WHERE r.source_code=${code} ORDER BY ev.created_at DESC,ev.id`,
  sql`SELECT a.revision_no,a.technical_basis,a.contractual_basis,a.reusable_summary,a.assumptions,a.limitations,a.source_provenance,a.created_at
    FROM ejenp_auditoria_318.technical_assessments a JOIN ejenp_auditoria_318.requests r ON r.id=a.request_id
    WHERE r.source_code=${code} ORDER BY a.revision_no DESC LIMIT 2`
 ]);
 if(matrix.length!==1)return null;
 const record=matrix[0],incremental=record.categoria_resumen_v13===INCREMENTAL;
 if(!incremental&&wbs.length)throw Error('WBS inesperada para categoría no incremental');
 const total=wbs.reduce((x,r)=>x+n(r.horas_pert),0);
 if(incremental&&(!wbs.length||delta(total,record.horas_pert_incrementales_propuestas)>.015))throw Error('WBS individual no concilia: '+code);
 const sources=[...sdoLinks.filter(x=>x.document_url).map(x=>({title:x.document_title||x.code,url:x.document_url,locator:x.code,type:'SDO'})),
 ...evidence.filter(x=>/^https:\/\//.test(x.document_ref||'')).map(x=>({title:x.document_ref,url:x.document_ref,locator:x.locator,type:x.evidence_type,claim:x.claim}))];
 return {record,wbs,sdoLinks,gapLinks,evidence,assessments,sources,
  totals:incremental?{o:wbs.reduce((v,x)=>v+n(x.optimistas),0),m:wbs.reduce((v,x)=>v+n(x.mas_probables),0),
    pert:Number(total.toFixed(3)),p:wbs.reduce((v,x)=>v+n(x.pesimistas),0),activities:wbs.length}:null};
}
export async function loadAllWbs(sql){
 return await sql`SELECT * FROM ejenp_estimacion_v08.v00_informe_wbs_122_v13 ORDER BY codigo,codigo_actividad,fase`;
}
export async function loadExport(sql){
 const [rows,wbs,categories,managers]=await Promise.all([
  sql`SELECT * FROM ejenp_estimacion_v08.v00_informe_matriz_318_v13 ORDER BY code`,
  loadAllWbs(sql),
  sql`SELECT * FROM ejenp_estimacion_v08.v00_informe_categorias_v13 ORDER BY categoria_visible_v13`,
  sql`SELECT * FROM ejenp_estimacion_v08.v00_informe_gerencial_v13`
 ]);
 const manager=managers[0],proposals=rows.filter(x=>x.categoria_resumen_v13===INCREMENTAL);
 if(rows.length!==318||new Set(rows.map(x=>x.code)).size!==318||proposals.length!==Number(manager?.incrementales_evaluacion_usuario)
  ||wbs.length!==635||new Set(wbs.map(x=>x.codigo)).size!==proposals.length
  ||delta(wbs.reduce((a,x)=>a+n(x.horas_pert),0),manager?.horas_pert_incrementales)>.015)
  throw Error('Exportación incompatible con vistas del informe');
 return {rows,wbs,categories,manager};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return send(res,405,{error:'Solo lectura GET'});
 if(!process.env.DATABASE_URL)return send(res,503,{error:'Neon no configurado'});
 try{
  const sql=neon(process.env.DATABASE_URL),view=String(req.query?.view||'snapshot');
  if(view==='snapshot')return send(res,200,await loadSnapshot(sql));
  if(view==='detail'){
   const code=String(req.query?.code||'').trim().toUpperCase();
   if(!/^REQ\d{5,7}$/.test(code))return send(res,400,{error:'Código de solicitud inválido'});
   const detail=await loadDetail(sql,code);
   return detail?send(res,200,detail):send(res,404,{error:'Solicitud no encontrada'});
  }
  if(view==='wbs')return send(res,200,{access:'public_readonly_report',rows:await loadAllWbs(sql)});
  if(view==='export')return send(res,200,{access:'public_readonly_report',...(await loadExport(sql))});
  return send(res,400,{error:'Vista no disponible'});
 }catch(error){console.error('Informe V13 no disponible:',String(error?.message||'').slice(0,220));
  return send(res,503,{error:'No se pudieron conciliar los resultados del informe'});
 }
}
