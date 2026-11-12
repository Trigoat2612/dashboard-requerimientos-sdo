import { neon } from '@neondatabase/serverless';
import { verifyInstitutionalToken, extractBearer, protectedHeaders, authErrorResponse, AuthenticationError } from '../lib/institutional-auth.js';
import { buildInstitutionalDashboard, buildInstitutionalDetail } from '../lib/institutional-views.js';

// Todas las sentencias usan un único esquema literal y parámetros enlazados.
// Verificar identidad + autorización ANTES de conectar a Neon, también en llamadas API directas.
export function createInstitutionalHandler({
  authenticate = verifyInstitutionalToken,
  connect = url => neon(url)
} = {}) {
  return async function handler(req, res) {
    protectedHeaders(res);
    if (req.method !== 'GET') {res.setHeader('Allow','GET');return res.status(405).json({error:'Método no permitido'});}
    try {
      const user = await authenticate(extractBearer(req));
      if (!user?.roles?.includes('institutional_reader')) throw new AuthenticationError('Rol de consulta requerido',403);
      if (!process.env.DATABASE_URL) return res.status(503).json({error:'Consulta institucional no configurada'});
      const sql=connect(process.env.DATABASE_URL);
      const view=req.query?.view||'dashboard';
      if (view==='dashboard') {
        const [requirements, compliance, requests, classifications, documents, methods, evidence, assessments, estimateCounts] = await Promise.all([
          sql`SELECT code,stage,layer,component,description,requirement_type,cycle,verification_status,notes,progress_reported,progress_basis,progress_route_count,source_document_id FROM ejenp_requerimientos_sdo.sdo_requirements ORDER BY code`,
          sql`SELECT code,proposed_evaluation,proposal_status,basis,evidence_references,missing_validation,proposed_by,reviewed_at FROM ejenp_requerimientos_sdo.sdo_compliance_proposals`,
          sql`SELECT id,request_code,area,request_text,requester,sdo_reference,gap_reference,component,requirement_class,evidence_status,compliance_status,status,comments,hours_min,hours_expected,hours_max,estimate_confidence,estimation_basis FROM ejenp_requerimientos_sdo.proposed_requirements ORDER BY request_code`,
          sql`SELECT request_id,classification,basis,contractual_evidence,related_sdo_codes,related_gap_ids,duplicate_of_request_id,proposed_by,proposal_status,reviewed_at FROM ejenp_requerimientos_sdo.request_classification_proposals`,
          sql`SELECT id,title,url,category,mime_type,parent_id,size_bytes,modified_at,scan_status,verification_notes,checked_at FROM ejenp_requerimientos_sdo.source_documents WHERE mime_type<>'application/vnd.google-apps.folder' ORDER BY title`,
          sql`SELECT name,supplier_proposed,description,strengths,risks,decision,source_document_id FROM ejenp_requerimientos_sdo.methodology_reviews ORDER BY name`,
          sql`SELECT id,proposed_requirement_id,sdo_code,document_id,evidence_type,confidence,created_at FROM ejenp_requerimientos_sdo.requirement_evidence ORDER BY sdo_code`,
          sql`SELECT id,document_id,sdo_code,criterion,coverage,review_level,reviewed_at FROM ejenp_requerimientos_sdo.document_assessments ORDER BY id DESC`,
          sql`SELECT request_id,COUNT(*)::int AS total FROM ejenp_requerimientos_sdo.hours_estimate_proposals GROUP BY request_id`
        ]);
        return res.status(200).json(buildInstitutionalDashboard({
          requirements,compliance,requests,classifications,documents,methods,evidence,assessments,estimateCounts
        }));
      }
      // Paginación lógica por demanda: evita respuestas de varios MB en el dashboard.
      // Evaluaciones completas se obtienen únicamente al abrir auditoría/contraste.
      if (view==='assessments') {
        const rows=await sql`SELECT a.id,a.document_id,a.sdo_code,a.criterion,a.coverage,a.finding,a.missing_validation,
          a.source_detail,a.review_level,a.reviewed_at,d.title AS document_title,d.url AS document_url
          FROM ejenp_requerimientos_sdo.document_assessments a
          LEFT JOIN ejenp_requerimientos_sdo.source_documents d ON d.id=a.document_id ORDER BY a.id DESC`;
        return res.status(200).json({access:'institutional_verified',rows,generatedAt:new Date().toISOString()});
      }
      if (view==='detail') {
        const kind=req.query?.kind, id=req.query?.id;
        if (!['sdo','request','document','assessment'].includes(kind) || typeof id!=='string' || !id.trim() || id.length>256) {
          return res.status(400).json({error:'Identificador de consulta no válido'});
        }
        if (kind==='sdo') {
          const [r,c,e,a]=await Promise.all([
            sql`SELECT code,stage,layer,component,description,requirement_type,cycle,verification_status,notes,progress_reported,progress_basis,progress_route_count,source_document_id FROM ejenp_requerimientos_sdo.sdo_requirements WHERE code=${id}`,
            sql`SELECT proposed_evaluation,proposal_status,basis,evidence_references,missing_validation,proposed_by,reviewed_at FROM ejenp_requerimientos_sdo.sdo_compliance_proposals WHERE code=${id}`,
            sql`SELECT e.id,e.rationale,e.evidence_type,e.confidence,e.proposed_requirement_id,d.id AS document_id,d.title AS document_title,d.url AS document_url FROM ejenp_requerimientos_sdo.requirement_evidence e LEFT JOIN ejenp_requerimientos_sdo.source_documents d ON d.id=e.document_id WHERE e.sdo_code=${id} ORDER BY d.title`,
            sql`SELECT a.id,a.coverage,a.criterion,a.finding,a.missing_validation,a.source_detail,a.review_level,a.reviewed_at,d.id AS document_id,d.title AS document_title,d.url AS document_url FROM ejenp_requerimientos_sdo.document_assessments a LEFT JOIN ejenp_requerimientos_sdo.source_documents d ON d.id=a.document_id WHERE a.sdo_code=${id} ORDER BY a.reviewed_at DESC`
          ]);
          if (!r.length) return res.status(404).json({error:'Requisito no encontrado'});
          return res.status(200).json(buildInstitutionalDetail(kind,r[0],{compliance:c[0],evidence:e,assessments:a}));
        }
        if (kind==='request') {
          const r=await sql`SELECT id,request_code,area,request_text,requester,sdo_reference,gap_reference,component,requirement_class,evidence_status,compliance_status,status,comments FROM ejenp_requerimientos_sdo.proposed_requirements WHERE request_code=${id}`;
          if (!r.length) return res.status(404).json({error:'Solicitud no encontrada'});
          const requestId=r[0].id;
          const [c,e,q,h]=await Promise.all([
            sql`SELECT classification,basis,contractual_evidence,related_sdo_codes,related_gap_ids,duplicate_of_request_id,proposed_by,proposal_status,reviewed_at FROM ejenp_requerimientos_sdo.request_classification_proposals WHERE request_id=${requestId}`,
            sql`SELECT e.id,e.sdo_code,e.rationale,e.evidence_type,e.confidence,d.id AS document_id,d.title AS document_title,d.url AS document_url FROM ejenp_requerimientos_sdo.requirement_evidence e LEFT JOIN ejenp_requerimientos_sdo.source_documents d ON d.id=e.document_id WHERE e.proposed_requirement_id=${requestId}`,
            sql`SELECT task_type,status,notes,updated_at FROM ejenp_requerimientos_sdo.request_analysis_queue WHERE request_id=${requestId} ORDER BY task_type`,
            sql`SELECT method,estimate_min,estimate_expected,estimate_max,unit,basis,source_references,exclusions_contractual,assumptions,proposed_by,proposal_status FROM ejenp_requerimientos_sdo.hours_estimate_proposals WHERE request_id=${requestId}`
          ]);
          return res.status(200).json(buildInstitutionalDetail(kind,r[0],{classification:c[0],evidence:e,queue:q,estimates:h}));
        }
        if (kind==='document') {
          const [r,a,e]=await Promise.all([
            sql`SELECT id,title,url,category,mime_type,parent_id,size_bytes,modified_at,scan_status,verification_notes,checked_at FROM ejenp_requerimientos_sdo.source_documents WHERE id=${id}`,
            sql`SELECT id,sdo_code,criterion,coverage,finding,missing_validation,source_detail,review_level,reviewed_at FROM ejenp_requerimientos_sdo.document_assessments WHERE document_id=${id} ORDER BY reviewed_at DESC`,
            sql`SELECT id,sdo_code,proposed_requirement_id,rationale,evidence_type,confidence FROM ejenp_requerimientos_sdo.requirement_evidence WHERE document_id=${id}`
          ]);
          if (!r.length) return res.status(404).json({error:'Documento no encontrado'});
          return res.status(200).json(buildInstitutionalDetail(kind,r[0],{assessments:a,evidence:e}));
        }
        const r=await sql`SELECT a.id,a.document_id,a.sdo_code,a.criterion,a.coverage,a.finding,a.missing_validation,a.source_detail,a.review_level,a.reviewed_at,d.title AS document_title,d.url AS document_url FROM ejenp_requerimientos_sdo.document_assessments a LEFT JOIN ejenp_requerimientos_sdo.source_documents d ON d.id=a.document_id WHERE a.id=${id}`;
        if (!r.length) return res.status(404).json({error:'Evaluación no encontrada'});
        return res.status(200).json(buildInstitutionalDetail(kind,r[0]));
      }
      return res.status(400).json({error:'Tipo de consulta no válido'});
    } catch(error) {
      if (!(error instanceof AuthenticationError)) console.error('Institutional read failed');
      return authErrorResponse(error,res);
    }
  };
}

export default createInstitutionalHandler();
