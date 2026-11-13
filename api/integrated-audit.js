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
  const [requests, gaps, agents, overlaps, components, exclusionReviews, sdo] = await Promise.all([
    sql`
      SELECT r.id, r.source_code AS code, r.batch_code AS batch, r.source_sheet,
        r.source_row, r.area, r.request_text AS description, r.created_at AS source_date,
        a.id AS assessment_id, a.revision_no AS v07_revision, a.author_agent AS v07_agent,
        a.category AS v07_category, a.contractual_basis, a.technical_basis,
        a.base_functionality, a.sdo_obligation, a.contractual_gap,
        a.additional_capacity, a.genuine_delta, a.estimation_exclusions,
        a.confidence AS v07_confidence, a.created_at AS v07_date,
        q.result AS qa_v07, q.reason AS qa_v07_reason, q.created_at AS qa_v07_date,
        e.eligibility, e.category AS eligibility_category, e.technical_reason AS exclusion_reason,
        v.id AS v2_id, v.review_version, v.decision AS v2_decision, v.effort_mode,
        v.sdo_equivalence, v.original_covered_scope, v.additional_behavior,
        v.incremental_delta, v.sdo_baseline, v.gap_baseline,
        v.exclusions AS v2_exclusions, v.pending_conditions, v.quality_reason,
        v.duplicate_master_request_id, v.source_category, v.reviewed_at AS v2_date,
        u.id AS unit_id, u.assigned_agent AS v08_agent, u.workstream,
        u.status AS estimate_status, u.block_reason, u.updated_at AS estimate_updated,
        s.estimate_id, s.confidence AS estimate_confidence, s.contractual_status,
        s.wbs_count, s.optimistic, s.most_likely, s.pert_expected, s.pessimistic,
        s.contingency_separate, s.qa_outcome, s.accepted_technical_pert, s.extreme_hours,
        x.technical_reason AS exclusion_zero_reason, x.incremental_hours AS exclusion_zero_hours,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('code',l.sdo_code,'relation',l.relation,'basis',l.contractual_basis))
           FROM ejenp_auditoria_318.sdo_links l WHERE l.request_id=r.id),'[]'::jsonb) AS sdo_links,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',l.gap_item_id,'relation',l.relation,'basis',l.basis))
           FROM ejenp_auditoria_318.gap_links l WHERE l.request_id=r.id),'[]'::jsonb) AS gap_links,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('request_id',l.related_request_id,'relation',l.relation_type,'basis',l.basis))
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
    sql`SELECT code,description,verification_status FROM ejenp_requerimientos_sdo.sdo_requirements ORDER BY code`
  ]);
  // La revisión paralela R48 no dispone todavía de un registro específico consultable.
  // Se expone la decisión V2 vigente y se distingue la inexistencia de una resolución R48.
  return {
    access:'read_only_audit', generatedAt:new Date().toISOString(),
    source:'Neon: ejenp_auditoria_318 + ejenp_v14_brechas + ejenp_estimacion_v08 + ejenp_requerimientos_sdo',
    r48:{registryStatus:'not_registered',notice:'No se encontró un registro propio y verificable de decisiones R48. Se muestra la clasificación V2 y la revisión R48 permanece pendiente.'},
    requests,gaps,agents,overlaps,components,exclusions:exclusionReviews,sdo
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
    if(view!=='snapshot') return json(res,400,{error:'Vista no disponible'});
    return json(res,200,await loadAuditSnapshot(sql));
  } catch(error) {
    console.error('V09 audit integration failed',String(error?.message||'').slice(0,180));
    return json(res,503,{error:'No se pudieron recuperar las fuentes consolidadas de Neon'});
  }
}
