// Modelo único para tarjetas, filtros, matriz y exportaciones de la auditoría V09.
export const number = value => value === null || value === undefined || value === '' ? null : Number(value);
export const fmtHours = value => number(value)===null || !Number.isFinite(number(value)) ? 'Sin estimación' :
  new Intl.NumberFormat('es-PE',{maximumFractionDigits:2,minimumFractionDigits:0}).format(number(value))+' h';
export const text = value => String(value??'').trim();
export const labels = {
 INCREMENTAL:'Incremental V2 (histórico)',CONDICIONAL:'Condicional V2 (histórico)',EXCLUIDO:'Sin incremento V2 (histórico)',
 NUEVO_EJE:'Nueva funcionalidad acreditada del EJE',ALCANCE_ORIGINAL_SDO:'Obligación SDO existente',
 ALCANCE_ORIGINAL_BRECHA:'Brecha originalmente contratada',CAMBIO_EXTERNO:'Cambio directo a sistema externo',
 REFORMULACION_PENDIENTE:'Reformular propuesta para EJE',NOVEDAD_NO_ACREDITADA:'Novedad técnica no acreditada',
 CONFIGURACION_O_AJUSTE:'Configuración o ajuste contratado',DUPLICADO:'Solicitud duplicada',
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
// El corte V00 V9 prevalece sobre elegibilidad V2 y las estimaciones brutas históricas.
export function summarize(rows=[],overlaps=[]) {
 const data=uniqueRequests(rows),newRows=data.filter(r=>r.final_decision==='NUEVO_EJE'&&r.final_new);
 const count=d=>data.filter(r=>r.final_decision===d).length;
 const sum=(rs,key)=>rs.reduce((n,r)=>n+Number(r[key]||0),0);
 const finalHours=newRows.length?{
  optimistic:sum(newRows,'final_o'),mostLikely:sum(newRows,'final_m'),
  pert:sum(newRows,'final_pert'),pessimistic:sum(newRows,'final_p')
 }:{optimistic:null,mostLikely:null,pert:null,pessimistic:null};
 const legacy=data.filter(isEstimated);
 return {
  total:data.length,newCount:newRows.length,notNew:data.length-newRows.length,
  sdoCovered:count('ALCANCE_ORIGINAL_SDO'),gapCovered:count('ALCANCE_ORIGINAL_BRECHA'),
  external:count('CAMBIO_EXTERNO'),reformulation:count('REFORMULACION_PENDIENTE'),
  notAccredited:count('NOVEDAD_NO_ACREDITADA'),configuration:count('CONFIGURACION_O_AJUSTE'),
  duplicates:count('DUPLICADO'),
  firm:newRows.length,conditional:0,excluded:data.length-newRows.length,
  estimated:newRows.length,technicalHistorical:legacy.length,pending:0,pendingQA:null,accepted:null,
  contractApproved:null,finalHours,firmHours:finalHours,conditionalHours:{optimistic:null,mostLikely:null,pert:null,pessimistic:null,contingency:null},
  qaHours:null,notIncludedHours:sum(data,'final_excluded_hours'),
  referenceBruteHours:sum(data,'horas_pert_brutas'),
  wbsAccepted:sum(newRows,'actividades_wbs'),
  overlaps:overlaps.filter(o=>data.some(r=>r.code===o.code_a||r.code===o.code_b)).length,
  overlapPending:overlaps.filter(o=>!/(RESUELTO|CONCILIADO|CERRADO)/i.test(o.status||'')&&data.some(r=>r.code===o.code_a||r.code===o.code_b)).length,
  classification:Object.fromEntries([...new Set(data.map(r=>r.final_decision))].map(k=>[k,data.filter(r=>r.final_decision===k).length]))
 };
}
export function filteredRequests(rows=[],filters={}) {
 const t=text(filters.search).toLocaleLowerCase('es-PE');
 return uniqueRequests(rows).filter(r=>{
  const hay=[r.code,r.description,r.area,r.batch,r.v07_category,r.v2_decision,r.final_decision,r.final_reason,r.original_covered_scope,r.incremental_delta,r.contractual_basis,
   ...(r.sdo_links||[]).map(s=>s.code),...(r.gap_links||[]).map(g=>g.id)].join(' ').toLocaleLowerCase('es-PE');
  if(t && !hay.includes(t))return false;
  for(const [key,field] of [['decision','final_decision'],['eligibility','eligibility'],['agent','v08_agent'],['area','area'],['category','v07_category'],['status','estimate_status'],['confidence','estimate_confidence'],['batch','batch'],['qa','qa_outcome']]){
   if(text(filters[key])&&String(r[field]||'Sin dato')!==filters[key])return false;
  }
  if(filters.onlySdo && !(r.sdo_links||[]).length)return false;
  if(filters.onlyGap && !(r.gap_links||[]).length)return false;
  if(filters.onlyEstimated && !r.final_new)return false;
  if(filters.onlyExcluded && r.final_new)return false;
  if(number(filters.minHours)!==null&&(!r.final_new||Number(r.final_pert)<Number(filters.minHours)))return false;
  if(number(filters.maxHours)!==null&&(!r.final_new||Number(r.final_pert)>Number(filters.maxHours)))return false;
  return true;
 });
}
export const stateLabel = r => r.final_decision==='NUEVO_EJE' ? fmtHours(r.final_pert)
 :r.final_decision ? '0 h incrementales admitidas · '+(labels[r.final_decision]||r.final_decision)
 :'Clasificación final no disponible';
export function exportColumns(r) {
 return [r.code,r.description,r.batch,r.area,r.v07_agent,r.v07_category,r.qa_v07,r.eligibility,r.v2_decision,
 (r.sdo_links||[]).map(v=>v.code).join(' | '),(r.gap_links||[]).map(v=>v.id).join(' | '),
 r.original_covered_scope,r.additional_behavior,r.incremental_delta,r.technical_basis,r.exclusion_reason||r.estimation_exclusions,
 r.estimate_status|| (r.eligibility==='EXCLUIDO'?'Sin incremento':'Pendiente de estimación'),r.v08_agent,r.estimate_confidence,
 r.final_decision==='NUEVO_EJE'?r.final_o:0,r.final_decision==='NUEVO_EJE'?r.final_m:0,
 r.final_decision==='NUEVO_EJE'?r.final_pert:0,r.final_decision==='NUEVO_EJE'?r.final_p:0,
 0,
 r.contractual_status||'',r.qa_outcome||'Pendiente',r.pending_conditions,r.sdo_equivalence,
 r.duplicate_master_request_id||'',r.source_date||'',r.v2_date||'',
 r.contractual_basis_full||r.contractual_basis||'',r.technical_basis_full||r.technical_basis||'',
 r.sdo_baseline_full||'',r.gap_baseline_full||'',r.equivalence_full||r.sdo_equivalence||'',
 r.v2_quality_reason||'',r.exclusions_full||'',r.estimate_justification||'',
 JSON.stringify(r.document_references||[]),JSON.stringify(r.estimate_sources||[]),
 r.final_decision,r.final_reason,r.final_version,r.final_new?'Sí':'No',
 r.final_o,r.final_m,r.final_pert,r.final_p,r.final_excluded_hours,
 r.final_sources,r.final_master,r.final_system,
 r.decision_final_export||'',r.fundamento_final_export||'',r.fuentes_final_export||''
 ];
}
export const exportHeaders=['Código','Solicitud íntegra','Lote','Área','Agente V07','Categoría V07','QA V07','Elegibilidad V2','Dictamen V2','SDO vinculados','Brechas vinculadas','Cobertura original','Comportamiento adicional','Delta incremental','Fundamento técnico','Exclusión','Estado V08','Agente V08','Confianza','Optimista h','Más probable h','PERT h','Pesimista h','Contingencia h','Estado contractual','QA técnico','Condiciones pendientes','Equivalencia funcional','Duplicado principal','Fecha fuente','Fecha revisión V2','Base contractual íntegra','Fundamento V07 íntegro','Línea base SDO íntegra','Línea base de brechas','Equivalencia V2 íntegra','Fundamento de revisión V2','Exclusiones íntegras','Justificación experta WBS','Referencias V2','Fuentes estimación V08',
 'Decisión final V00 V9','Fundamento final V00 V9','Versión del cierre','Nueva EJE acreditada',
 'Horas finales optimistas','Horas finales más probables','Horas finales PERT','Horas finales pesimistas',
 'Horas no incluidas','Fuentes del dictamen final','Requerimiento maestro','Responsable o sistema',
 'Decisión exportada','Fundamento final íntegro','Fuentes finales íntegras'];
