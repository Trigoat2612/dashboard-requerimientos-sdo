// Estructura de lectura autorizada. Preserva estados originales y propuestas independientes.
// Ninguna función de este módulo escribe en Neon.
export function buildInstitutionalDashboard({
  requirements = [], compliance = [], requests = [], classifications = [],
  documents = [], methods = [], evidence = [], assessments = [], estimateCounts = []
}) {
  const bySdo = new Map(compliance.map(c => [String(c.code),c]));
  const byRequest = new Map(classifications.map(c => [String(c.request_id),c]));
  const estimateMap = new Map(estimateCounts.map(e=>[String(e.request_id),Number(e.total)||0]));
  const docs = new Map(documents.map(d=>[String(d.id),d]));
  return {
    access: 'institutional_verified',
    scope: 'individual_read_only',
    sdo: requirements.map(r => {
      const c=bySdo.get(String(r.code));
      return {
        ...r, v06_evaluation:c?.proposed_evaluation||null,
        v06_proposal_status:c?.proposal_status||null,
        v06_reviewed_at:c?.reviewed_at||null,
        v06_basis:c?.basis||null,
        v06_missing_validation:c?.missing_validation||null,
        v06_evidence_references:c?.evidence_references||null,
        v06_proposed_by:c?.proposed_by||null
      };
    }),
    requests: requests.map(r => {
      const c=byRequest.get(String(r.id));
      return {
        ...r, historical_status:r.status,
        status:c?.classification||'Sin dictamen V07',
        v07_classification:c?.classification||null,
        v07_proposal_status:c?.proposal_status||null,
        v07_reviewed_at:c?.reviewed_at||null,
        v07_basis:c?.basis||null,
        v07_contractual_evidence:c?.contractual_evidence||null,
        v07_related_sdo_codes:c?.related_sdo_codes||[],
        v07_related_gap_ids:c?.related_gap_ids||[],
        v07_duplicate_of_request_id:c?.duplicate_of_request_id||null,
        sdo_reference:(c?.related_sdo_codes||[]).join(', ')||r.sdo_reference,
        v08_independent_method_count:estimateMap.get(String(r.id))||0
      };
    }),
    documents:documents.map(d=>({...d})),
    evidence:evidence.map(e=>({
      ...e,
      document_title:docs.get(String(e.document_id))?.title||'Documento no localizado',
      document_url:docs.get(String(e.document_id))?.url||null
    })),
    assessments:assessments.map(a=>({
      ...a,
      document_title:docs.get(String(a.document_id))?.title||'Documento no localizado',
      document_url:docs.get(String(a.document_id))?.url||null
    })),
    methods:methods.map(m=>({...m})),
    suggestions:[],
    generatedAt:new Date().toISOString()
  };
}

export function buildInstitutionalDetail(kind, record, linked = {}) {
  return { access:'institutional_verified', kind, record:record||null,
    evidence:linked.evidence||[], assessments:linked.assessments||[],
    compliance:linked.compliance||null, classification:linked.classification||null,
    estimates:linked.estimates||[], queue:linked.queue||[],
    generatedAt:new Date().toISOString() };
}
