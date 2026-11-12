import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

// V09: la consulta anónima expone solo metadatos de seguimiento.
// No hay identidad de usuario verificada: NO devolver documentos, URLs de Drive,
// textos de solicitudes, conclusiones técnicas, identificadores judiciales ni hallazgos.
// La vista institucional completa requerirá autorización verificable de servidor.
const docKey = id => 'doc-' + createHash('sha256').update(String(id ?? '')).digest('hex').slice(0, 20);
const restricted = 'Texto original disponible mediante acceso institucional individual.';

export function buildPublicMetadata({ requests, sdo, documents, methods, evidence, assessments, compliance, classification, estimateMethodCounts = [] }) {
    const bySdo = new Map(compliance.map(c => [c.code, c]));
    const byRequest = new Map(classification.map(c => [String(c.request_id), c]));
    const estimateCountByRequest = new Map(estimateMethodCounts.map(e => [String(e.request_id), Number(e.total) || 0]));
    const docNames = new Map(documents.map((d, i) => [String(d.id), 'Documento institucional ' + String(i + 1).padStart(4, '0')]));
    return {
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
          estimate_confidence: null, estimation_basis: null,
          v08_independent_method_count: estimateCountByRequest.get(String(r.id)) || 0
        };
      }),
      sdo: sdo.map(r => {
        const c = bySdo.get(r.code);
        return {
          code: r.code, stage: r.stage, layer: r.layer, component: r.component,
          requirement_type: r.requirement_type, cycle: r.cycle,
          progress_reported: r.progress_reported, progress_route_count: r.progress_route_count,
          description: restricted, verification_status: 'Estado oficial no publicado',
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
    };
}


// Mantener acceso público documental ya existente en main.
// El nuevo detalle institucional permanece en /api/institutional-data con autenticación.
export default async function handler(req, res) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Pragma','no-cache');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method !== 'GET') return res.status(405).json({error:'Método no permitido'});
  if (!process.env.DATABASE_URL) return res.status(503).json({error:'DATABASE_URL no está configurada'});
  try {
    const sql = neon(process.env.DATABASE_URL);
    const [requests, sdo, documents, methods, evidence, suggestions, assessments, compliance, classification, estimateMethodCounts] = await Promise.all([
      sql`SELECT id, source_row, request_code, area, request_text, requester, sdo_reference, gap_reference, component, requirement_class, evidence_status, compliance_status, status, comments, hours_min, hours_expected, hours_max, estimate_confidence, estimation_basis, updated_at FROM ejenp_requerimientos_sdo.proposed_requirements ORDER BY request_code`,
      sql`SELECT code, stage, layer, component, description, requirement_type, cycle, verification_status, notes, progress_reported, progress_basis, progress_route_count FROM ejenp_requerimientos_sdo.sdo_requirements ORDER BY code`,
      sql`SELECT id, title, url, category, mime_type, parent_id, size_bytes, modified_at, scan_status, verification_notes, checked_at FROM ejenp_requerimientos_sdo.source_documents WHERE mime_type <> 'application/vnd.google-apps.folder' ORDER BY title`,
      sql`SELECT name, supplier_proposed, description, strengths, risks, decision, source_document_id FROM ejenp_requerimientos_sdo.methodology_reviews ORDER BY supplier_proposed DESC, name`,
      sql`SELECT e.sdo_code,e.document_id,e.rationale,e.confidence,d.title AS document_title,d.url AS document_url FROM ejenp_requerimientos_sdo.requirement_evidence e LEFT JOIN ejenp_requerimientos_sdo.source_documents d ON d.id=e.document_id ORDER BY e.sdo_code`,
      sql`SELECT a.proposed_requirement_id,a.sdo_code,a.similarity,a.rationale,a.review_status,s.component,s.description FROM ejenp_requerimientos_sdo.association_suggestions a JOIN ejenp_requerimientos_sdo.sdo_requirements s ON s.code=a.sdo_code ORDER BY a.proposed_requirement_id,a.similarity DESC`,
      sql`SELECT a.id,a.document_id,a.sdo_code,a.criterion,a.coverage,a.finding,a.missing_validation,a.source_detail,a.review_level,a.reviewed_at,d.title AS document_title,d.url AS document_url FROM ejenp_requerimientos_sdo.document_assessments a JOIN ejenp_requerimientos_sdo.source_documents d ON d.id=a.document_id ORDER BY a.reviewed_at DESC,a.id DESC`,
      sql`SELECT code, proposed_evaluation, proposal_status, reviewed_at FROM ejenp_requerimientos_sdo.sdo_compliance_proposals`,
      sql`SELECT request_id, classification, proposal_status, related_sdo_codes, reviewed_at FROM ejenp_requerimientos_sdo.request_classification_proposals`,
      sql`SELECT request_id, COUNT(*)::int AS total FROM ejenp_requerimientos_sdo.hours_estimate_proposals GROUP BY request_id`
    ]);
    res.setHeader('Cache-Control','no-store, max-age=0');
    // El dashboard no requiere clave, por ello los informes clasificados como
    // confidenciales se muestran únicamente como referencias de revisión.
    const reserved = /(?:pentest|ethical.?hacking|vulnerabilit|vulnerabilidades|retest|rat[ -]+pentest)/i;
    const publicDocuments = documents.map(d => reserved.test(d.title || '') ? {
      ...d, title: 'Informe técnico de seguridad (acceso reservado)',
      url: null, verification_notes: 'Existe evidencia de evaluación de seguridad. El informe detallado es confidencial y debe consultarse por canales institucionales autorizados.'
    } : d);
    const publicEvidence = evidence.map(e => reserved.test(e.document_title || '') ? {
      ...e, document_title: 'Informe técnico de seguridad (acceso reservado)', document_url: null,
      rationale: 'Referencia documental de seguridad registrada. Evidencia técnica detallada de acceso restringido.'
    } : e);
    const sensitive=/(?:pentest|ethical.?hacking|vulnerabilit|retest|rat[ -]+pentest|expedientes? sin (?:estado|partes)|resumenincidenciaspruebas|log de errores|listadodeexpedientes|registro_usuarios|usuarios_dia_)/i;
    const checkedDocuments=publicDocuments.map(d=>sensitive.test(d.title||'')?{...d,url:null,verification_notes:'Documento con datos o detalles restringidos. La evaluación pública omite identificadores y contenido sensible.'}:d);
    const checkedEvidence=publicEvidence.map(e=>sensitive.test(e.document_title||'')?{...e,document_url:null,rationale:'Referencia documental registrada. Acceso institucional restringido.'}:e);
    const publicAssessments=assessments.map(a=>{
      const isRestricted=sensitive.test(a.document_title||'');
      return isRestricted?{...a,
        document_url:null,
        document_title:reserved.test(a.document_title||'')?'Evaluación de seguridad reservada':a.document_title,
        finding:'Evaluación documental registrada. La información detallada requiere autorización institucional y no se divulga en el dashboard público.',
        missing_validation:'Consultar evidencia, subsanaciones y conformidad mediante los canales institucionales autorizados.',
        source_detail:'Metadatos de revisión (detalle reservado).'
      }:a;
    });
    // Conserva exactamente el conjunto de documentos/textos ya accesibles en main.
    // Agrega solo clasificaciones y estados propuestos de V06/V07: nunca bases,
    // evidencia contractual íntegra ni dictámenes detallados mediante este endpoint.
    const bySdo=new Map(compliance.map(c=>[c.code,c]));
    const byRequest=new Map(classification.map(c=>[String(c.request_id),c]));
    const estimateCountByRequest=new Map(estimateMethodCounts.map(c=>[String(c.request_id),Number(c.total)||0]));
    const publicRequests=requests.map(r=>{
      const c=byRequest.get(String(r.id));
      return {...r,historical_status:r.status,status:c?.classification||r.status,
        v07_classification:c?.classification||null,v07_proposal_status:c?.proposal_status||null,
        v07_reviewed_at:c?.reviewed_at||null,
        v08_independent_method_count:estimateCountByRequest.get(String(r.id))||0};
    });
    const publicSdo=sdo.map(r=>{
      const c=bySdo.get(r.code);
      return {...r,v06_evaluation:c?.proposed_evaluation||null,
        v06_proposal_status:c?.proposal_status||null,v06_reviewed_at:c?.reviewed_at||null};
    });
    res.setHeader('X-Content-Type-Options','nosniff');
    return res.status(200).json({
      access:'public_legacy_readonly',
      dataScope:'Información documental pública heredada de la versión productiva, con exclusiones sensibles y dictámenes V06/V07 resumidos',
      requests:publicRequests,sdo:publicSdo,documents:checkedDocuments,methods,
      evidence:checkedEvidence,suggestions,assessments:publicAssessments,generatedAt:new Date().toISOString()
    });
  } catch (error) {
    console.error('DB read failed', error?.message);
    return res.status(500).json({error:'No se pudieron recuperar los datos de Neon'});
  }
}