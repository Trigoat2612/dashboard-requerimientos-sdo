import { neon } from '@neondatabase/serverless';

const S = 'ejenp_requerimientos_sdo';
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'Conexión a Neon no configurada' });
  try {
    const sql = neon(process.env.DATABASE_URL);
    const [overview, windows, documental, compliance, classification, hours, inventory, availability, assignments] = await Promise.all([
      sql`SELECT * FROM ejenp_requerimientos_sdo.audit_v2_summary`,
      sql`SELECT window_id, specialty, workstream, enabled FROM ejenp_requerimientos_sdo.review_windows ORDER BY window_id`,
      sql`SELECT status, count(*)::int AS total FROM ejenp_requerimientos_sdo.review_queue_parallel WHERE task_kind='DOCUMENTO' GROUP BY status ORDER BY status`,
      sql`SELECT proposed_evaluation AS classification, total::int FROM ejenp_requerimientos_sdo.audit_v2_compliance_counts ORDER BY proposed_evaluation`,
      sql`SELECT classification, total::int FROM ejenp_requerimientos_sdo.audit_v2_classification_counts ORDER BY classification`,
      sql`SELECT method, methods_count::int AS total, total_min, total_expected, total_max FROM ejenp_requerimientos_sdo.audit_v2_hours_counts ORDER BY method`,
      sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE change_type='Identidad nueva en inventario')::int AS new_identities FROM ejenp_requerimientos_sdo.inventory_revision_audit WHERE source_id='1c_MhCpiG62IyyH8pl_dU-GEqaqiInn9T'`,
      sql`SELECT (SELECT count(*)::int FROM ejenp_requerimientos_sdo.review_queue_parallel q WHERE task_kind='REQUISITO_SDO' AND status='Pendiente' AND EXISTS(SELECT 1 FROM ejenp_requerimientos_sdo.document_assessments a WHERE a.sdo_code=q.requirement_code AND a.review_level='Análisis documental contrastado')) AS sdo_ready,
             (SELECT count(*)::int FROM ejenp_requerimientos_sdo.request_analysis_queue q WHERE q.task_type='ESTIMACION' AND q.status='Pendiente' AND EXISTS(SELECT 1 FROM ejenp_requerimientos_sdo.request_classification_proposals c WHERE c.request_id=q.request_id AND c.classification='Genuinamente nueva' AND c.proposal_status='Propuesta, pendiente de aprobación') AND EXISTS(SELECT 1 FROM ejenp_requerimientos_sdo.request_analysis_queue p WHERE p.request_id=q.request_id AND p.task_type='CLASIFICACION' AND p.status='Contrastado')) AS estimate_ready,
             (SELECT count(*)::int FROM ejenp_requerimientos_sdo.document_assessments WHERE review_level='Análisis documental contrastado') AS assessment_criteria_contrasted,
             (SELECT count(DISTINCT document_id)::int FROM ejenp_requerimientos_sdo.document_assessments WHERE review_level='Análisis documental contrastado') AS docs_with_any_contrast,
             (SELECT count(*)::int FROM ejenp_requerimientos_sdo.sdo_requirements) AS sdo_total,
             (SELECT count(*)::int FROM ejenp_requerimientos_sdo.review_queue_parallel WHERE task_kind='REQUISITO_SDO' AND status='Contrastado') AS sdo_closed`,
      sql`SELECT assigned_window, count(*)::int AS total FROM (SELECT assigned_window FROM ejenp_requerimientos_sdo.review_queue_parallel WHERE status='En curso' UNION ALL SELECT assigned_window FROM ejenp_requerimientos_sdo.request_analysis_queue WHERE status='En curso') t WHERE assigned_window IS NOT NULL GROUP BY assigned_window`
    ]);
    // Public endpoint: only anonymous aggregates, never judicial records, findings, raw requests or links.
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).json({
      overview: overview[0] || {},
      windows: windows.map(w => ({
        ...w, activeReservations: Number(assignments.find(a => a.assigned_window === w.window_id)?.total || 0)
      })),
      documental, compliance, classification, hours, inventory: inventory[0] || {},
      availability: availability[0] || {}, generatedAt: new Date().toISOString(),
      disclaimer: 'Propuestas y evaluaciones preliminares. No son aprobaciones institucionales.'
    });
  } catch (error) {
    console.error('No se pudo consultar resumen V2:', error?.message);
    return res.status(500).json({ error: 'No se pudo consultar el resumen de auditoría en Neon' });
  }
}
