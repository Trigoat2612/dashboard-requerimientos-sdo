import { neon } from '@neondatabase/serverless';

// V09: capa de lectura de la auditoría 318, V2, brechas Laboral y WBS V08.
// Ninguna operación de escritura; los estados oficiales no se infieren.
const responseHeaders = res => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
};
const json = (res, status, body) => res.status(status).json(body);

export async function loadAuditSnapshot(sql) {
  // Una fila por solicitud. Relaciones N:M se agregan como arreglos, no como JOIN multiplicador.
  const [requests, gaps, agents, legacyOverlaps, components, exclusionReviews, sdo, finalRows, finalGerencial, r48Scope, r48Resolutions, overlapV00] = await Promise.all([
    sql`
      SELECT r.id, r.source_code AS code, r.batch_code AS batch, r.source_sheet,
        r.source_row, r.area, r.request_text AS description, r.created_at AS source_date,
        a.id AS assessment_id, a.revision_no AS v07_revision, a.author_agent AS v07_agent,
        a.category AS v07_category, LEFT(a.contractual_basis,450) AS contractual_basis,
        LEFT(a.technical_basis,500) AS technical_basis, LEFT(a.genuine_delta,350) AS genuine_delta,
        LEFT(a.estimation_exclusions,350) AS estimation_exclusions,
        a.confidence AS v07_confidence, a.created_at AS v07_date,
        q.result AS qa_v07, LEFT(q.reason,350) AS qa_v07_reason, q.created_at AS qa_v07_date,
        e.eligibility, e.category AS eligibility_category, LEFT(e.technical_reason,400) AS exclusion_reason,
        v.id AS v2_id, v.review_version, v.decision AS v2_decision, v.effort_mode,
        LEFT(v.sdo_equivalence,600) AS sdo_equivalence, LEFT(v.original_covered_scope,350) AS original_covered_scope,
        LEFT(v.additional_behavior,350) AS additional_behavior, LEFT(v.incremental_delta,350) AS incremental_delta,
        LEFT(v.pending_conditions,350) AS pending_conditions,
        v.duplicate_master_request_id, v.source_category, v.reviewed_at AS v2_date,
        u.id AS unit_id, u.assigned_agent AS v08_agent, u.workstream,
        u.status AS estimate_status, LEFT(u.block_reason,300) AS block_reason, u.updated_at AS estimate_updated,
        s.estimate_id, s.confidence AS estimate_confidence, s.contractual_status,
        s.wbs_count, s.optimistic, s.most_likely, s.pert_expected, s.pessimistic,
        s.contingency_separate, s.qa_outcome, s.accepted_technical_pert, s.extreme_hours,
        LEFT(x.technical_reason,400) AS exclusion_zero_reason, x.incremental_hours AS exclusion_zero_hours,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('code',l.sdo_code,'relation',l.relation))
           FROM ejenp_auditoria_318.sdo_links l WHERE l.request_id=r.id),'[]'::jsonb) AS sdo_links,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',l.gap_item_id,'relation',l.relation))
           FROM ejenp_auditoria_318.gap_links l WHERE l.request_id=r.id),'[]'::jsonb) AS gap_links,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('request_id',l.related_request_id,'relation',l.relation_type))
           FROM ejenp_auditoria_318.request_relations l WHERE l.request_id=r.id),'[]'::jsonb) AS relations
      FROM ejenp_auditoria_318.requests r
      LEFT JOIN LATERAL (SELECT * FROM ejenp_auditoria_318.technical_assessments a
         WHERE a.request_id=r.id ORDER BY a.revision_no DESC,a.id DESC LIMIT 1) a ON TRUE
      LEFT JOIN LATERAL (SELECT * FROM ejenp_auditoria_318.quality_reviews q
         WHERE q.assessment_id=a.id ORDER BY q.created_at DESC,q.id DESC LIMIT 1) q ON TRUE
      LEFT JOIN LATERAL (SELECT * FROM ejenp_estimacion_v08.eligibility_register e
         WHERE e.request_id=r.id ORDER BY e.checked_at DESC,e.id DESC LIMIT 1) e ON TRUE
      LEFT JOIN LATERAL (SELECT * FROM ejenp_estimacion_v08.eligibility_revisions_v2 v
         WHERE v.request_id=r.id ORDER BY v.review_version DESC,v.reviewed_at DESC,v.id DESC LIMIT 1) v ON TRUE
      LEFT JOIN LATERAL (SELECT * FROM ejenp_estimacion_v08.estimation_units u
         WHERE u.request_id=r.id ORDER BY u.created_at DESC,u.id DESC LIMIT 1) u ON TRUE
      LEFT JOIN LATERAL (SELECT * FROM ejenp_estimacion_v08.scenario_summary s
         WHERE s.request_id=r.id ORDER BY s.revision_no DESC,s.estimate_id DESC LIMIT 1) s ON TRUE
      LEFT JOIN LATERAL (SELECT * FROM ejenp_estimacion_v08.exclusions_zero x
         WHERE x.request_id=r.id LIMIT 1) x ON TRUE
      ORDER BY r.source_code,r.id`,
    sql`
      SELECT i.id, i.record_class, i.source_gap_code AS gap_code, i.source_sdo_code AS sdo_code,
        i.source_request_code AS request_code, i.source_description AS description,
        i.source_solution, i.source_final_status, i.source_sheet, i.source_row,
        ev.verdict, ev.contractual_basis AS evaluation_contractual, ev.technical_basis AS evaluation_technical,
        ev.missing_evidence, ev.unblock_condition, ev.reviewed_at
      FROM ejenp_v14_brechas.items i
      LEFT JOIN LATERAL (SELECT e.* FROM ejenp_v14_brechas.evaluations e
        JOIN ejenp_v14_brechas.review_queue q ON q.id=e.queue_id
        WHERE q.item_id=i.id ORDER BY e.revision_no DESC,e.reviewed_at DESC,e.id DESC LIMIT 1) ev ON TRUE
      ORDER BY i.id`,
    sql`SELECT agent_id,focus,assigned,pending,in_progress,estimated,blocked,superseded,conditional
      FROM ejenp_estimacion_v08.monitoring ORDER BY agent_id`,
    sql`SELECT request_a,request_b,code_a,code_b,relation_types,agent_a,agent_b,status,
       resolution_basis,reviewed_by,validated_at FROM ejenp_estimacion_v08.overlap_guard_v2
       ORDER BY code_a,code_b`,
    sql`SELECT component_key,description,owner_agent,status,dependencies
       FROM ejenp_estimacion_v08.shared_components ORDER BY component_key`,
    sql`SELECT request_id,source_code,category,technical_reason FROM ejenp_estimacion_v08.exclusions_zero ORDER BY request_id`,
    sql`SELECT code,description,verification_status FROM ejenp_requerimientos_sdo.sdo_requirements ORDER BY code`,
    sql`SELECT request_id,code,decision_tecnica_final,es_novedad_acreditada,version_cierre_tecnico,
      fundamento_tecnico_final,fuentes_tecnicas_finales,clasificacion_contractual_final,fuente_decision,cierre_contractual,
      requerimiento_maestro,requisitos_sdo,brechas_relacionadas,funcion_originalmente_exigible,
      ampliacion_funcional_analizada,responsable_contractual_funcional,
      motivo_exclusion_y_recomendacion,qa_resultado,revision_secundaria,
      solapamientos_pendientes,solapamientos_casos,condiciones_pendientes,
      horas_optimistas,horas_mas_probables,horas_pert_brutas,horas_pesimistas,
      horas_optimistas_admitidas,horas_mas_probables_admitidas,horas_pert_admitidas,
      horas_pesimistas_admitidas,horas_no_incluidas,horas_excluidas_contractuales,
      horas_descuento_duplicidad_demostrada,metodo_cierre,actividades_wbs,agente_estimador
      FROM ejenp_estimacion_v08.v00_final_novedad_318_v9 ORDER BY code`,
    sql`SELECT * FROM ejenp_estimacion_v08.v00_novedad_gerencial_v9`,
    sql`SELECT source_code,final_decision,target_system,sdo_codes,sdo_functional_equivalence,
       eje_reformulation,technical_viability,contractual_rationale,canonical_request,
       accountable_party,incremental_hours,approval_status,decided_at
       FROM ejenp_estimacion_v08.v00_r48_final_scope_v4 ORDER BY source_code`,
    sql`SELECT source_code,previous_status,decision,contractual_owner,target_system,
       sdo_codes,contractual_function,scope_difference,eje_solution,technical_viability,
       pending_requirements,basis,master_request,incremental_hours,qa_source,
       decided_at FROM ejenp_estimacion_v08.v00_r48_resolutions_v5 ORDER BY source_code`,
    sql`SELECT tipo,code_a,code_b,dictamen,tipo_deslinde,propietario_componente,
      pert_a,pert_b,excluido_contractual_a,excluido_contractual_b,
      descuento_duplicidad_demostrada,fundamento,condiciones,version_decision,status_operativo
      FROM ejenp_estimacion_v08.v00_overlap_dashboard_49_v7 ORDER BY code_a,code_b`
  ]);
  // La única clasificación ejecutiva vigente procede de V00 V9.
  if (requests.length!==318 || finalRows.length!==318 ||
      new Set(finalRows.map(r=>r.code)).size!==318) {
    throw new Error('Las matrices original y V00 V9 no son reconciliables (318 códigos únicos)');
  }
  const byCode=new Map(finalRows.map(x=>[x.code,x]));
  const reconciled=requests.map(r=>{
    const c=byCode.get(r.code);
    if(!c || String(c.request_id)!==String(r.id)) throw new Error('Cruce inconsistente V00 V9: '+r.code);
    return {...r,...c,
      id:r.id, code:r.code,description:r.description,area:r.area,
      // Se conserva la V2 histórica como dato, nunca como decisión vigente.
      final_decision:c.decision_tecnica_final,final_new:c.es_novedad_acreditada===true,
      final_o:c.horas_optimistas_admitidas,final_m:c.horas_mas_probables_admitidas,
      final_pert:c.horas_pert_admitidas,final_p:c.horas_pesimistas_admitidas,
      final_excluded_hours:c.horas_no_incluidas,final_reason:c.fundamento_tecnico_final,
      final_sources:c.fuentes_tecnicas_finales,final_version:c.version_cierre_tecnico,
      final_master:c.requerimiento_maestro,final_system:c.responsable_contractual_funcional,
    };
  });
  const versions=[...new Set(finalRows.map(x=>x.version_cierre_tecnico))];
  if(versions.length!==1) throw new Error('Versiones V00 heterogéneas en el mismo corte');
  const newRows=reconciled.filter(r=>r.final_new);
  const finalSum=newRows.reduce((total,r)=>total+Number(r.final_pert||0),0);
  const gerencial=finalGerencial[0];
  if(!gerencial ||
     Number(gerencial.universo_318)!==reconciled.length ||
     Number(gerencial.novedades_eje)!==newRows.length ||
     Math.abs(Number(gerencial.horas_pert)-finalSum)>0.02)
    throw new Error('Resumen V00 V9 y matriz V00 V9 no concilian');
  const byId=new Map(reconciled.map(r=>[String(r.id),r.code]));
  const overlaps=overlapV00.map((x,i)=>({
    ...x,request_a:reconciled.find(r=>r.code===x.code_a)?.id||null,
    request_b:reconciled.find(r=>r.code===x.code_b)?.id||null,
    relation_types:x.tipo||x.tipo_deslinde,agent_a:'V00',agent_b:x.propietario_componente,
    status:x.status_operativo||x.dictamen,resolution_basis:x.fundamento,
    descuento_demostrado:x.descuento_duplicidad_demostrada,
    fuente_version:x.version_decision
  }));
  return {
    access:'read_only_audit', generatedAt:new Date().toISOString(),
    source:'Neon · cierre técnico final V00 V9 / auditoría 318 / Laboral / SDO',
    sourceVersion:versions[0], managerial:gerencial,
    r48:{registryStatus:'recorded',scope:r48Scope,resolutions:r48Resolutions,
      notice:'Decisiones R48 vigentes consultadas. Se conservan versiones y criterios anteriores sin duplicar horas.'},
    requests:reconciled,gaps,agents,overlaps,components,exclusions:exclusionReviews,sdo,
    historical:{estimateCount:reconciled.filter(x=>x.estimate_id).length,
      overlapGuardCount:legacyOverlaps.length}
  };
}

export async function loadRequestDetail(sql, code) {
  const match = await sql`SELECT id,source_code,batch_code,source_sheet,source_row,area,request_text,
    raw_record,created_at FROM ejenp_auditoria_318.requests WHERE source_code=${code} LIMIT 1`;
  if(!match.length) return null;
  const request=match[0], id=request.id;
  const [assessments,qa,conditions,sdoLinks,gapLinks,documents,units,related,overlaps]=await Promise.all([
    sql`SELECT * FROM ejenp_auditoria_318.technical_assessments WHERE request_id=${id} ORDER BY revision_no,id`,
    sql`SELECT q.* FROM ejenp_auditoria_318.quality_reviews q JOIN ejenp_auditoria_318.technical_assessments a ON a.id=q.assessment_id WHERE a.request_id=${id} ORDER BY q.created_at,q.id`,
    sql`SELECT c.* FROM ejenp_auditoria_318.pending_conditions c JOIN ejenp_auditoria_318.technical_assessments a ON a.id=c.assessment_id WHERE a.request_id=${id} ORDER BY c.id`,
    sql`SELECT l.*,s.description AS sdo_description,s.verification_status FROM ejenp_auditoria_318.sdo_links l LEFT JOIN ejenp_requerimientos_sdo.sdo_requirements s ON s.code=l.sdo_code WHERE l.request_id=${id} ORDER BY l.sdo_code`,
    sql`SELECT l.*,g.source_gap_code,g.source_description,g.source_sdo_code FROM ejenp_auditoria_318.gap_links l LEFT JOIN ejenp_v14_brechas.items g ON g.id=l.gap_item_id WHERE l.request_id=${id} ORDER BY l.gap_item_id`,
    sql`SELECT e.* FROM ejenp_auditoria_318.assessment_evidence e JOIN ejenp_auditoria_318.technical_assessments a ON a.id=e.assessment_id WHERE a.request_id=${id} ORDER BY e.id`,
    sql`SELECT u.*, v.id AS estimate_id,v.methodology,v.expert_justification,v.technical_sources,v.scope_basis,v.exclusions_basis,v.conditional_assumptions,v.confidence AS estimate_confidence,v.contractual_status,v.created_at AS estimated_at
      FROM ejenp_estimacion_v08.estimation_units u LEFT JOIN ejenp_estimacion_v08.estimates v ON v.unit_id=u.id WHERE u.request_id=${id} ORDER BY u.id DESC`,
    sql`SELECT l.*,r.source_code AS related_code FROM ejenp_auditoria_318.request_relations l LEFT JOIN ejenp_auditoria_318.requests r ON r.id=l.related_request_id WHERE l.request_id=${id} ORDER BY l.created_at`,
    sql`SELECT * FROM ejenp_estimacion_v08.overlap_guard_v2 WHERE request_a=${id} OR request_b=${id}`
  ]);
  const estimateId=units.find(u=>u.estimate_id)?.estimate_id;
  const [wbs,risks,assumptions,contingencies,methods,deps,usage,peerReviews,qualityChecks,events,v2]=await Promise.all([
    estimateId ? sql`SELECT * FROM ejenp_estimacion_v08.wbs_tasks WHERE estimate_id=${estimateId} ORDER BY activity_code,id` : Promise.resolve([]),
    estimateId ? sql`SELECT * FROM ejenp_estimacion_v08.risk_register WHERE estimate_id=${estimateId} ORDER BY id` : Promise.resolve([]),
    estimateId ? sql`SELECT * FROM ejenp_estimacion_v08.technical_assumptions WHERE estimate_id=${estimateId} ORDER BY id` : Promise.resolve([]),
    estimateId ? sql`SELECT * FROM ejenp_estimacion_v08.contingencies WHERE estimate_id=${estimateId} ORDER BY id` : Promise.resolve([]),
    estimateId ? sql`SELECT * FROM ejenp_estimacion_v08.functional_sizes WHERE estimate_id=${estimateId} ORDER BY id` : Promise.resolve([]),
    sql`SELECT d.* FROM ejenp_estimacion_v08.dependencies d JOIN ejenp_estimacion_v08.estimation_units u ON u.id=d.unit_id WHERE u.request_id=${id} ORDER BY d.id`,
    sql`SELECT cu.* FROM ejenp_estimacion_v08.component_usage cu JOIN ejenp_estimacion_v08.estimation_units u ON u.id=cu.unit_id WHERE u.request_id=${id} ORDER BY cu.id`,
    estimateId ? sql`SELECT * FROM ejenp_estimacion_v08.peer_reviews WHERE estimate_id=${estimateId} ORDER BY created_at` : Promise.resolve([]),
    estimateId ? sql`SELECT * FROM ejenp_estimacion_v08.quality_checks WHERE estimate_id=${estimateId} ORDER BY created_at` : Promise.resolve([]),
    sql`SELECT ev.* FROM ejenp_estimacion_v08.audit_events ev JOIN ejenp_estimacion_v08.estimation_units u ON u.id=ev.unit_id WHERE u.request_id=${id} ORDER BY ev.created_at,ev.id`,
    sql`SELECT * FROM ejenp_estimacion_v08.eligibility_revisions_v2 WHERE request_id=${id} ORDER BY review_version,reviewed_at,id`
  ]);
  return {request,assessments,qa,conditions,sdoLinks,gapLinks,documents,units,related,overlaps,
    wbs,risks,assumptions,contingencies,methods,deps,usage,peerReviews,qualityChecks,events,v2};
}

// Solo para descarga Excel: texto técnico/contractual íntegro, solicitado bajo demanda.
export async function loadAuditExport(sql) {
 return await sql`SELECT r.source_code AS code,
   a.contractual_basis AS contractual_basis_full, a.technical_basis AS technical_basis_full,
   a.estimation_exclusions AS exclusions_full,a.source_provenance,
   v.sdo_baseline AS sdo_baseline_full,v.gap_baseline AS gap_baseline_full,
   v.sdo_equivalence AS equivalence_full,v.quality_reason AS v2_quality_reason,
   v.document_references,
   es.expert_justification AS estimate_justification,
   es.technical_sources AS estimate_sources
  FROM ejenp_auditoria_318.requests r
  LEFT JOIN LATERAL (SELECT * FROM ejenp_auditoria_318.technical_assessments a
      WHERE a.request_id=r.id ORDER BY a.revision_no DESC,a.id DESC LIMIT 1) a ON TRUE
  LEFT JOIN LATERAL (SELECT * FROM ejenp_estimacion_v08.eligibility_revisions_v2 v
      WHERE v.request_id=r.id ORDER BY v.review_version DESC,v.reviewed_at DESC,v.id DESC LIMIT 1) v ON TRUE
  LEFT JOIN LATERAL (SELECT es.* FROM ejenp_estimacion_v08.estimation_units u
      JOIN ejenp_estimacion_v08.estimates es ON es.unit_id=u.id
      WHERE u.request_id=r.id ORDER BY es.revision_no DESC,es.id DESC LIMIT 1) es ON TRUE
  ORDER BY r.source_code`;
}

export default async function handler(req,res) {
  responseHeaders(res);
  if(req.method!=='GET') return json(res,405,{error:'Método no permitido'});
  if(!process.env.DATABASE_URL) return json(res,503,{error:'Conexión Neon no configurada'});
  try {
    const sql=neon(process.env.DATABASE_URL);
    const view=String(req.query?.view||'snapshot');
    if(view==='detail') {
      const code=String(req.query?.code||'').trim().toUpperCase();
      if(!/^REQ\d{5,7}$/.test(code)) return json(res,400,{error:'Código de solicitud inválido'});
      const detail=await loadRequestDetail(sql,code);
      return detail ? json(res,200,detail) : json(res,404,{error:'Solicitud no encontrada'});
    }
    if(view==='export') return json(res,200,{access:'read_only_audit_export',rows:await loadAuditExport(sql)});
    if(view!=='snapshot') return json(res,400,{error:'Vista no disponible'});
    return json(res,200,await loadAuditSnapshot(sql));
  } catch(error) {
    console.error('V09 audit integration failed',String(error?.message||'').slice(0,180));
    return json(res,503,{error:'No se pudieron recuperar las fuentes consolidadas de Neon'});
  }
}
