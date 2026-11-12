import { neon } from '@neondatabase/serverless';
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({error:'Método no permitido'});
  if (!process.env.DATABASE_URL) return res.status(503).json({error:'DATABASE_URL no está configurada'});
  try {
    const sql = neon(process.env.DATABASE_URL);
    const [requests, sdo, documents, methods, evidence, suggestions, assessments] = await Promise.all([
      sql`SELECT id, source_row, request_code, area, request_text, requester, sdo_reference, gap_reference, component, requirement_class, evidence_status, compliance_status, status, comments, hours_min, hours_expected, hours_max, estimate_confidence, estimation_basis, updated_at FROM ejenp_requerimientos_sdo.proposed_requirements ORDER BY request_code`,
      sql`SELECT code, stage, layer, component, description, requirement_type, cycle, verification_status, notes, progress_reported, progress_basis, progress_route_count FROM ejenp_requerimientos_sdo.sdo_requirements ORDER BY code`,
      sql`SELECT id, title, url, category, mime_type, parent_id, size_bytes, modified_at, scan_status, verification_notes, checked_at FROM ejenp_requerimientos_sdo.source_documents WHERE mime_type <> 'application/vnd.google-apps.folder' ORDER BY title`,
      sql`SELECT name, supplier_proposed, description, strengths, risks, decision, source_document_id FROM ejenp_requerimientos_sdo.methodology_reviews ORDER BY supplier_proposed DESC, name`,
      sql`SELECT e.sdo_code,e.document_id,e.rationale,e.confidence,d.title AS document_title,d.url AS document_url FROM ejenp_requerimientos_sdo.requirement_evidence e LEFT JOIN ejenp_requerimientos_sdo.source_documents d ON d.id=e.document_id ORDER BY e.sdo_code`,
      sql`SELECT a.proposed_requirement_id,a.sdo_code,a.similarity,a.rationale,a.review_status,s.component,s.description FROM ejenp_requerimientos_sdo.association_suggestions a JOIN ejenp_requerimientos_sdo.sdo_requirements s ON s.code=a.sdo_code ORDER BY a.proposed_requirement_id,a.similarity DESC`,
      sql`SELECT a.id,a.document_id,a.sdo_code,a.criterion,a.coverage,a.finding,a.missing_validation,a.source_detail,a.review_level,a.reviewed_at,d.title AS document_title,d.url AS document_url FROM ejenp_requerimientos_sdo.document_assessments a JOIN ejenp_requerimientos_sdo.source_documents d ON d.id=a.document_id ORDER BY a.reviewed_at DESC,a.id DESC`
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
    return res.status(200).json({requests,sdo,documents:checkedDocuments,methods,evidence:checkedEvidence,suggestions,assessments:publicAssessments,generatedAt:new Date().toISOString()});
  } catch (error) {
    console.error('DB read failed', error?.message);
    return res.status(500).json({error:'No se pudieron recuperar los datos de Neon'});
  }
}