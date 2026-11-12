import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

// V09: la consulta anónima expone solo metadatos de seguimiento.
// No hay identidad de usuario verificada: NO devolver documentos, URLs de Drive,
// textos de solicitudes, conclusiones técnicas, identificadores judiciales ni hallazgos.
// La vista institucional completa requerirá autorización verificable de servidor.
const docKey = id => 'doc-' + createHash('sha256').update(String(id ?? '')).digest('hex').slice(0, 20);
const restricted = 'Detalle institucional reservado; consultar mediante un canal autorizado.';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Authorization, Cookie');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'Conexión a Neon no configurada' });
  try {
    const sql = neon(process.env.DATABASE_URL);
    // Proyección positiva: nunca leer ni serializar campos confidenciales
    // en una respuesta pública. Los joins se basan en claves y no en texto.
    const [requests, sdo, documents, methods, evidence, assessments, compliance, classification] = await Promise.all([
      sql`SELECT id, request_code, area, component, requirement_class, status AS historical_status FROM ejenp_requerimientos_sdo.proposed_requirements ORDER BY request_code`,
      sql`SELECT code, stage, layer, component, requirement_type, cycle, progress_reported, progress_route_count FROM ejenp_requerimientos_sdo.sdo_requirements ORDER BY code`,
      sql`SELECT id, category, mime_type, scan_status FROM ejenp_requerimientos_sdo.source_documents WHERE mime_type <> 'application/vnd.google-apps.folder' ORDER BY id`,
      sql`SELECT name, supplier_proposed FROM ejenp_requerimientos_sdo.methodology_reviews ORDER BY name`,
      sql`SELECT sdo_code, document_id, confidence FROM ejenp_requerimientos_sdo.requirement_evidence ORDER BY sdo_code`,
      sql`SELECT id, document_id, sdo_code, coverage, review_level FROM ejenp_requerimientos_sdo.document_assessments ORDER BY id DESC`,
      sql`SELECT code, proposed_evaluation, proposal_status, reviewed_at FROM ejenp_requerimientos_sdo.sdo_compliance_proposals`,
      sql`SELECT request_id, classification, proposal_status, related_sdo_codes, reviewed_at FROM ejenp_requerimientos_sdo.request_classification_proposals`
    ]);
    const bySdo = new Map(compliance.map(c => [c.code, c]));
    const byRequest = new Map(classification.map(c => [String(c.request_id), c]));
    const docNames = new Map(documents.map((d, i) => [String(d.id), 'Documento institucional ' + String(i + 1).padStart(4, '0')]));
    return res.status(200).json({
      access: 'public_metadata_only',
      dataScope: 'Metadatos anonimizados; NO son fichas institucionales completas',
      accessNotice: 'Los textos, URLs y hallazgos institucionales no se publican sin autenticación individual verificable.',
      requests: requests.map(r => {
        const c = byRequest.get(String(r.id));
        return {
          id: r.id, request_code: r.request_code, area: r.area, component: r.component,
          requirement_class: r.requirement_class,
          request_text: restricted, requester: null, sdo_reference: (c?.related_sdo_codes || []).join(', '),
          gap_reference: null, comments: null, historical_status: r.historical_status,
          status: c?.classification || 'Sin evaluación V07',
          v07_classification: c?.classification || null, v07_proposal_status: c?.proposal_status || null,
          v07_reviewed_at: c?.reviewed_at || null, compliance_status: 'Propuesta, no aprobada',
          evidence_status: null, hours_min: null, hours_expected: null, hours_max: null,
          estimate_confidence: null, estimation_basis: null
        };
      }),
      sdo: sdo.map(r => {
        const c = bySdo.get(r.code);
        return {
          ...r, description: restricted, verification_status: 'Estado oficial no publicado',
          notes: null, progress_basis: null,
          v06_evaluation: c?.proposed_evaluation || null,
          v06_proposal_status: c?.proposal_status || null, v06_reviewed_at: c?.reviewed_at || null
        };
      }),
      documents: documents.map(d => ({
        id: docKey(d.id), title: docNames.get(String(d.id)), url: null,
        category: d.category, mime_type: d.mime_type, parent_id: null, size_bytes: null,
        modified_at: null, scan_status: d.scan_status, verification_notes: null, checked_at: null
      })),
      evidence: evidence.map(e => ({
        sdo_code: e.sdo_code, document_id: docKey(e.document_id),
        document_title: docNames.get(String(e.document_id)) || 'Documento institucional',
        document_url: null, rationale: restricted, confidence: e.confidence
      })),
      assessments: assessments.map(a => ({
        id: a.id, document_id: docKey(a.document_id), sdo_code: a.sdo_code,
        document_title: docNames.get(String(a.document_id)) || 'Documento institucional',
        document_url: null, criterion: 'Criterio de revisión reservado',
        coverage: a.coverage, review_level: a.review_level,
        finding: restricted, missing_validation: restricted, source_detail: restricted, reviewed_at: null
      })),
      methods: methods.map(m => ({
        name: m.name, supplier_proposed: m.supplier_proposed, description: restricted,
        strengths: restricted, risks: restricted, decision: 'Pendiente de validación institucional', source_document_id: null
      })),
      suggestions: [],
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('V09 metadata read failed');
    return res.status(500).json({ error: 'No se pudieron recuperar los indicadores de Neon' });
  }
}
