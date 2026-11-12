import { neon } from '@neondatabase/serverless';

const S = 'ejenp_requerimientos_sdo';
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'Conexión a Neon no configurada' });
  try {
    const sql = neon(process.env.DATABASE_URL);
    const [overview, windows, documental, compliance, classification, hours, inventory, availability, guidance, v09, reservations] = await Promise.all([
      sql`SELECT * FROM ejenp_requerimientos_sdo.audit_v2_summary`,
      sql`SELECT window_id, specialty, workstream, enabled, pending::int, in_progress::int, contrasted::int, duplicated::int, blocked::int, pending_institutional_validation::int, calibration_pending::int FROM ejenp_requerimientos_sdo.audit_v2_windows ORDER BY window_id`,
      sql`SELECT status, count(*)::int AS total FROM ejenp_requerimientos_sdo.review_queue_parallel WHERE task_kind='DOCUMENTO' GROUP BY status ORDER BY status`,
      sql`SELECT proposed_evaluation AS classification, total::int FROM ejenp_requerimientos_sdo.audit_v2_compliance_counts ORDER BY proposed_evaluation`,
      sql`SELECT classification, total::int FROM ejenp_requerimientos_sdo.audit_v2_classification_counts ORDER BY classification`,
      sql`SELECT method, methods_count::int AS total FROM ejenp_requerimientos_sdo.audit_v2_hours_counts ORDER BY method`,
      sql`SELECT count(*)::int AS total, count(*)::int AS new_identities, count(*) FILTER (WHERE i.mime_type<>'application/vnd.google-apps.folder')::int AS files, count(*) FILTER (WHERE i.mime_type='application/vnd.google-apps.folder')::int AS folders, count(*) FILTER (WHERE q.status='Contrastado')::int AS contrasted, count(*) FILTER (WHERE q.status='Duplicado verificado')::int AS duplicated, count(*) FILTER (WHERE q.status='En curso')::int AS in_progress, count(*) FILTER (WHERE q.status='Pendiente')::int AS pending FROM ejenp_requerimientos_sdo.drive_inventory_discovery i LEFT JOIN ejenp_requerimientos_sdo.review_queue_parallel q ON q.document_id=i.document_id WHERE i.root_id='1c_MhCpiG62IyyH8pl_dU-GEqaqiInn9T'`,
      sql`SELECT (SELECT count(*)::int FROM ejenp_requerimientos_sdo.review_queue_parallel q WHERE task_kind='REQUISITO_SDO' AND status='Pendiente' AND EXISTS(SELECT 1 FROM ejenp_requerimientos_sdo.document_assessments a WHERE a.sdo_code=q.requirement_code AND a.review_level='Análisis documental contrastado')) AS sdo_ready,
             (SELECT count(*)::int FROM ejenp_requerimientos_sdo.request_analysis_queue q WHERE q.task_type='ESTIMACION' AND q.status='Pendiente' AND EXISTS(SELECT 1 FROM ejenp_requerimientos_sdo.request_classification_proposals c WHERE c.request_id=q.request_id AND c.classification='Genuinamente nueva' AND c.proposal_status='Propuesta, pendiente de aprobación') AND EXISTS(SELECT 1 FROM ejenp_requerimientos_sdo.request_analysis_queue p WHERE p.request_id=q.request_id AND p.task_type='CLASIFICACION' AND p.status='Contrastado')) AS estimate_ready,
             (SELECT count(*)::int FROM ejenp_requerimientos_sdo.document_assessments WHERE review_level='Análisis documental contrastado') AS assessment_criteria_contrasted,
             (SELECT count(DISTINCT document_id)::int FROM ejenp_requerimientos_sdo.document_assessments WHERE review_level='Análisis documental contrastado') AS docs_with_any_contrast,
             (SELECT count(*)::int FROM ejenp_requerimientos_sdo.sdo_requirements) AS sdo_total,
             (SELECT count(*)::int FROM ejenp_requerimientos_sdo.review_queue_parallel WHERE task_kind='REQUISITO_SDO' AND status='Contrastado') AS sdo_closed`,
      sql`SELECT method, applicability, required_inputs, validation_control, limitations FROM ejenp_requerimientos_sdo.estimation_method_guidance_v2 ORDER BY method`,
      sql`SELECT (SELECT COALESCE(SUM(hours_expected),0) FROM ejenp_requerimientos_sdo.proposed_requirements) AS historical_triage_hours,
             (SELECT COUNT(*) FROM ejenp_requerimientos_sdo.hours_estimate_proposals) AS independent_method_records,
             (SELECT COUNT(DISTINCT h.request_id) FROM ejenp_requerimientos_sdo.hours_estimate_proposals h JOIN ejenp_requerimientos_sdo.request_classification_proposals c ON c.request_id=h.request_id WHERE c.classification='Genuinamente nueva') AS requests_with_independent_methods,
             (SELECT COUNT(*) FROM ejenp_requerimientos_sdo.request_analysis_queue WHERE task_type='ESTIMACION' AND status='Bloqueado') AS blocked_estimation_tasks,
             (SELECT COUNT(*) FROM ejenp_requerimientos_sdo.request_classification_proposals WHERE classification='Genuinamente nueva') AS potentially_incremental,
             (SELECT COUNT(*) FROM ejenp_requerimientos_sdo.sdo_compliance_proposals) AS evaluated_sdo,
             (SELECT COUNT(*) FROM ejenp_requerimientos_sdo.request_classification_proposals) AS classified_requests,
             (SELECT COUNT(*) FROM ejenp_requerimientos_sdo.document_assessments) AS document_assessments`,
      sql`SELECT assigned_window AS window_id, COUNT(*)::int AS active FROM (
             SELECT assigned_window, status, lease_expires_at FROM ejenp_requerimientos_sdo.review_queue_parallel
             UNION ALL SELECT assigned_window, status, lease_expires_at FROM ejenp_requerimientos_sdo.request_analysis_queue
           ) a WHERE status='En curso' AND lease_expires_at > NOW() AND assigned_window IS NOT NULL GROUP BY assigned_window`
    ]);
    const activeByWindow = new Map(reservations.map(r => [r.window_id, Number(r.active)]));
    // Public endpoint: only anonymous aggregates, never judicial records, findings, raw requests or links.
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).json({
      overview: { ...(overview[0] || {}), active_reservations: [...activeByWindow.values()].reduce((n,v)=>n+v,0) },
      windows: windows.map(w => ({
        ...w, activeReservations: activeByWindow.get(w.window_id) || 0
      })),
      documental, compliance, classification, hours, methodGuidance: guidance, inventory: inventory[0] || {},
      v09: { ...(v09[0] || {}), consolidated_gaps: null, approved_hours: null,
        disclosure: 'Las brechas no cuentan aún con registro consolidado validado. No se acreditan horas aprobadas desde estas tablas.' },
      availability: availability[0] || {}, generatedAt: new Date().toISOString(),
      disclaimer: 'Propuestas y evaluaciones preliminares. No son aprobaciones institucionales.'
    });
  } catch (error) {
    console.error('No se pudo consultar resumen V2');
    return res.status(500).json({ error: 'No se pudo consultar el resumen de auditoría en Neon' });
  }
}
