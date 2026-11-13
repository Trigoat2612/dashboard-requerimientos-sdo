// Modelo único para tarjetas, filtros, matriz y exportaciones de la auditoría V09.
export const number = value => value === null || value === undefined || value === '' ? null : Number(value);
export const fmtHours = value => number(value)===null || !Number.isFinite(number(value)) ? 'Sin estimación' :
  new Intl.NumberFormat('es-PE',{maximumFractionDigits:2,minimumFractionDigits:0}).format(number(value))+' h';
export const text = value => String(value??'').trim();
export const labels = {
 INCREMENTAL:'Incremental firme',CONDICIONAL:'Estimación condicionada',EXCLUIDO:'Sin incremento propio',
 CONFIGURACION_SIN_INCREMENTO:'Configuración / ajuste',FUERA_ALCANCE_BOLSA:'Fuera de alcance',
 EXCLUIDA_OBLIGACION_SDO:'Obligación contractual SDO',EXCLUIDA_BRECHA_CONTRACTUAL:'Brecha contractual',
 EXCLUIDA_DUPLICADA:'Duplicidad',AMPLIACION_PARCIAL:'Ampliación parcial',
 NUEVO_DESARROLLO:'Nuevo desarrollo',INDETERMINADA_TECNICAMENTE:'Técnicamente indeterminada'
};
export function uniqueRequests(rows=[]) {
 const seen=new Set();
 return rows.filter(r=>{const k=text(r.code);if(!k||seen.has(k))return false;seen.add(k);return true;});
}
export function isEstimated(r){return Boolean(r?.estimate_id)&&r?.estimate_status==='Estimado'&&number(r.wbs_count)>0;}
export function summarize(rows=[],overlaps=[]) {
 const data=uniqueRequests(rows), firm=data.filter(r=>r.eligibility==='INCREMENTAL'),conditional=data.filter(r=>r.eligibility==='CONDICIONAL'),excluded=data.filter(r=>r.eligibility==='EXCLUIDO');
 const estimate=data.filter(isEstimated), firmEstimate=estimate.filter(r=>r.eligibility==='INCREMENTAL'), conditionalEstimate=estimate.filter(r=>r.eligibility==='CONDICIONAL');
 const sum=(rs,key)=>rs.reduce((s,r)=>s+(number(r[key])||0),0);
 const scenarios=rs=>rs.length?{optimistic:sum(rs,'optimistic'),mostLikely:sum(rs,'most_likely'),pert:sum(rs,'pert_expected'),pessimistic:sum(rs,'pessimistic'),contingency:sum(rs,'contingency_separate')}:{optimistic:null,mostLikely:null,pert:null,pessimistic:null,contingency:null};
 const pendingQA=estimate.filter(r=>!r.qa_outcome),accepted=estimate.filter(r=>r.qa_outcome&&/ACEPT|APROB/i.test(r.qa_outcome));
 return {
  total:data.length,firm:firm.length,conditional:conditional.length,excluded:excluded.length,estimated:estimate.length,
  pending:firm.length+conditional.length-estimate.length, pendingQA:pendingQA.length, accepted:accepted.length,
  contractApproved:null,firmHours:scenarios(firmEstimate),conditionalHours:scenarios(conditionalEstimate),
  qaHours:accepted.length?sum(accepted,'accepted_technical_pert'):null,
  sdoCovered:excluded.filter(r=>r.v07_category==='EXCLUIDA_OBLIGACION_SDO' && (r.sdo_links||[]).length).length,
  gapCovered:excluded.filter(r=>r.v07_category==='EXCLUIDA_BRECHA_CONTRACTUAL' && (r.gap_links||[]).length).length,
  overlaps:overlaps.filter(o=>o.status!=='RESUELTO' && data.some(r=>String(r.id)===String(o.request_a)||String(r.id)===String(o.request_b))).length
 };
}
export function filteredRequests(rows=[],filters={}) {
 const t=text(filters.search).toLocaleLowerCase('es-PE');
 return uniqueRequests(rows).filter(r=>{
  const hay=[r.code,r.description,r.area,r.batch,r.v07_category,r.v2_decision,r.original_covered_scope,r.incremental_delta,r.contractual_basis,
   ...(r.sdo_links||[]).map(s=>s.code),...(r.gap_links||[]).map(g=>g.id)].join(' ').toLocaleLowerCase('es-PE');
  if(t && !hay.includes(t))return false;
  for(const [key,field] of [['eligibility','eligibility'],['agent','v08_agent'],['area','area'],['category','v07_category'],['status','estimate_status'],['confidence','estimate_confidence'],['batch','batch'],['qa','qa_outcome']]){
   if(text(filters[key])&&String(r[field]||'Sin dato')!==filters[key])return false;
  }
  if(filters.onlySdo && !(r.sdo_links||[]).length)return false;
  if(filters.onlyGap && !(r.gap_links||[]).length)return false;
  if(filters.onlyEstimated && !isEstimated(r))return false;
  if(filters.onlyExcluded && r.eligibility!=='EXCLUIDO')return false;
  if(number(filters.minHours)!==null&&(!isEstimated(r)||Number(r.pert_expected)<Number(filters.minHours)))return false;
  if(number(filters.maxHours)!==null&&(!isEstimated(r)||Number(r.pert_expected)>Number(filters.maxHours)))return false;
  return true;
 });
}
export const stateLabel = r => r.eligibility==='EXCLUIDO'?'0 h adicionales propias (excluido)':
  isEstimated(r)?fmtHours(r.pert_expected):r.eligibility==='CONDICIONAL'||r.eligibility==='INCREMENTAL'?'Pendiente de estimación':'Sin dictamen de elegibilidad';
export function exportColumns(r) {
 return [r.code,r.description,r.batch,r.area,r.v07_agent,r.v07_category,r.qa_v07,r.eligibility,r.v2_decision,
 (r.sdo_links||[]).map(v=>v.code).join(' | '),(r.gap_links||[]).map(v=>v.id).join(' | '),
 r.original_covered_scope,r.additional_behavior,r.incremental_delta,r.technical_basis,r.exclusion_reason||r.estimation_exclusions,
 r.estimate_status|| (r.eligibility==='EXCLUIDO'?'Sin incremento':'Pendiente de estimación'),r.v08_agent,r.estimate_confidence,
 isEstimated(r)?r.optimistic:r.eligibility==='EXCLUIDO'?0:'',isEstimated(r)?r.most_likely:r.eligibility==='EXCLUIDO'?0:'',
 isEstimated(r)?r.pert_expected:r.eligibility==='EXCLUIDO'?0:'',isEstimated(r)?r.pessimistic:r.eligibility==='EXCLUIDO'?0:'',
 isEstimated(r)?r.contingency_separate:r.eligibility==='EXCLUIDO'?0:'',
 r.contractual_status||'',r.qa_outcome||'Pendiente',r.pending_conditions,r.sdo_equivalence,
 r.duplicate_master_request_id||'',r.source_date||'',r.v2_date||'',
 r.contractual_basis_full||r.contractual_basis||'',r.technical_basis_full||r.technical_basis||'',
 r.sdo_baseline_full||'',r.gap_baseline_full||'',r.equivalence_full||r.sdo_equivalence||'',
 r.v2_quality_reason||'',r.exclusions_full||'',r.estimate_justification||'',
 JSON.stringify(r.document_references||[]),JSON.stringify(r.estimate_sources||[])];
}
export const exportHeaders=['Código','Solicitud íntegra','Lote','Área','Agente V07','Categoría V07','QA V07','Elegibilidad V2','Dictamen V2','SDO vinculados','Brechas vinculadas','Cobertura original','Comportamiento adicional','Delta incremental','Fundamento técnico','Exclusión','Estado V08','Agente V08','Confianza','Optimista h','Más probable h','PERT h','Pesimista h','Contingencia h','Estado contractual','QA técnico','Condiciones pendientes','Equivalencia funcional','Duplicado principal','Fecha fuente','Fecha revisión V2','Base contractual íntegra','Fundamento V07 íntegro','Línea base SDO íntegra','Línea base de brechas','Equivalencia V2 íntegra','Fundamento de revisión V2','Exclusiones íntegras','Justificación experta WBS','Referencias V2','Fuentes estimación V08'];
