import test from 'node:test';
import assert from 'node:assert/strict';
import {uniqueRequests,filteredRequests,summarize,exportColumns,exportHeaders} from '../src/integrated-model.js';
import {buildAuditXlsx,buildAuditPptx} from '../src/integrated-export.js';
import {loadAuditSnapshot,loadRequestDetail} from '../api/integrated-audit.js';

const rows=[
 {id:'1',code:'REQ00001',description:'Nueva simulación EJE',area:'Arquitectura',batch:'LOTE_B02',eligibility:'INCREMENTAL',
  final_decision:'NUEVO_EJE',final_new:true,final_o:'10',final_m:'16',final_pert:'17',final_p:'28',final_excluded_hours:'0',
  horas_pert_brutas:'17',actividades_wbs:'3',v07_category:'AMPLIACION_PARCIAL',estimate_status:'Estimado',estimate_id:'1',wbs_count:'3',
  optimistic:'10',most_likely:'16',pert_expected:'17',pessimistic:'28',contingency_separate:'0',v08_agent:'V08-09',sdo_links:[{code:'RFU-ADM-03'}],gap_links:[]},
 {id:'2',code:'REQ00002',description:'Control por rol no acreditado',area:'Estadística',batch:'LOTE_B02',eligibility:'CONDICIONAL',
  final_decision:'NOVEDAD_NO_ACREDITADA',final_new:false,final_pert:'0',final_excluded_hours:'15',horas_pert_brutas:'15',
  v07_category:'INDETERMINADA_TECNICAMENTE',estimate_status:'Estimado',estimate_id:'2',wbs_count:'1',
  optimistic:'8',most_likely:'14',pert_expected:'15',pessimistic:'26',contingency_separate:'0',v08_agent:'V08-09',sdo_links:[],gap_links:[]},
 {id:'3',code:'REQ00003',description:'Configuración SDO',area:'Arquitectura',batch:'LOTE_B02',eligibility:'EXCLUIDO',
  final_decision:'ALCANCE_ORIGINAL_SDO',final_new:false,final_pert:'0',final_excluded_hours:'0',horas_pert_brutas:'0',
  v07_category:'EXCLUIDA_OBLIGACION_SDO',estimate_status:null,estimate_id:null,sdo_links:[{code:'RFU-ADM-12'}],gap_links:[]},
 {id:'4',code:'REQ00004',description:'Cambio externo',area:'Arquitectura',batch:'LOTE_B02',eligibility:'CONDICIONAL',
  final_decision:'CAMBIO_EXTERNO',final_new:false,final_pert:'0',final_excluded_hours:'0',horas_pert_brutas:'0',
  v07_category:'NUEVO_DESARROLLO',estimate_status:'Pendiente',estimate_id:null,sdo_links:[],gap_links:[]}
];
test('318 filas únicas: el modelo no multiplica solicitudes por sus relaciones SDO',()=>{
 assert.equal(uniqueRequests([...rows,rows[0]]).length,4);
 assert.equal(filteredRequests([...rows,rows[0]],{}).length,4);
});
test('el total final solo incluye nuevas funciones EJE y conserva WBS brutas históricas fuera',()=>{
 const m=summarize(rows,[]);
 assert.deepEqual([m.total,m.newCount,m.notNew,m.sdoCovered,m.external],[4,1,3,1,1]);
 assert.equal(m.finalHours.pert,17);
 assert.equal(m.notIncludedHours,15);
 assert.equal(m.referenceBruteHours,32);
 assert.equal(m.contractApproved,null);
 assert.equal(exportColumns(rows[2])[19],0);
 assert.equal(exportColumns(rows[3])[19],0);
 assert.equal(exportHeaders.length,56);
});
test('filtros combinables del corte final, no elegibilidad V2 histórica',()=>{
 assert.deepEqual(filteredRequests(rows,{decision:'NUEVO_EJE',area:'Arquitectura',onlySdo:true}).map(r=>r.code),['REQ00001']);
 assert.deepEqual(filteredRequests(rows,{onlyEstimated:true,minHours:'16'}).map(r=>r.code),['REQ00001']);
 assert.deepEqual(filteredRequests(rows,{decision:'CAMBIO_EXTERNO',onlyExcluded:true}).map(r=>r.code),['REQ00004']);
 assert.deepEqual(filteredRequests(rows,{maxHours:'15',decision:'NOVEDAD_NO_ACREDITADA'}),[]);
});
test('exportación Excel y PowerPoint generan ZIP OOXML con hojas y doce diapositivas',()=>{
 const xlsx=buildAuditXlsx(rows),pptx=buildAuditPptx({overlaps:[],r48:{registryStatus:'not_registered'}},rows);
 assert.equal(String.fromCharCode(...xlsx.slice(0,2)),'PK');
 assert.equal(String.fromCharCode(...pptx.slice(0,2)),'PK');
 assert.ok(xlsx.length>5000);assert.ok(pptx.length>15000);
 const xtext=new TextDecoder().decode(xlsx);
 const ptext=new TextDecoder().decode(pptx);
 assert.match(xtext,/xl\/worksheets\/sheet1\.xml/);
 assert.match(xtext,/REQ00001/);
 assert.match(xtext,/Auditoría 318/);
 assert.match(ptext,/ppt\/slides\/slide12\.xml/);
 assert.match(ptext,/TECNICA_NO_APROBADA|propuestas técnicas|Propuestas técnicas/i);
});
test('snapshot de 318 registros concilia una única versión V00 V9 y suma de novedad',async()=>{
 const sample=Array.from({length:318},(_,i)=>({id:String(i+1),code:'REQ'+String(i+1).padStart(5,'0'),source:'V07'}));
 const final=sample.map((r,i)=>({request_id:r.id,code:r.code,version_cierre_tecnico:'V00-20261113-NOVEDAD-TECNICA-V9',
    decision_tecnica_final:i===0?'NUEVO_EJE':'ALCANCE_ORIGINAL_SDO',es_novedad_acreditada:i===0,
    horas_pert_admitidas:i===0?'17':'0',horas_no_incluidas:i===0?'0':'5'}));
 const results=[sample,[],[],[],[],[],[],final,[{universo_318:'318',novedades_eje:'1',horas_pert:'17'}],[],[],[]];
 let n=0;const sql=()=>Promise.resolve(results[n++]);
 const out=await loadAuditSnapshot(sql);
 assert.equal(n,12);assert.equal(out.requests.length,318);
 assert.equal(out.requests[0].final_new,true);
 assert.equal(out.requests[1].final_new,false);
 assert.equal(out.sourceVersion,'V00-20261113-NOVEDAD-TECNICA-V9');
 assert.equal(out.r48.registryStatus,'recorded');
 assert.equal(out.access,'read_only_audit');
});
test('el detalle de una solicitud externa no admite la WBS preliminar',async()=>{
 const sql=(parts)=> {
  const q=Array.isArray(parts)?parts.join(''):String(parts);
  if(q.includes('FROM ejenp_auditoria_318.requests WHERE source_code'))return Promise.resolve([{id:3,source_code:'REQ00003',request_text:'Reforma externa'}]);
  if(q.includes('FROM ejenp_estimacion_v08.v00_final_novedad_318_v9 WHERE code'))return Promise.resolve([{code:'REQ00003',decision_tecnica_final:'CAMBIO_EXTERNO',es_novedad_acreditada:false,horas_pert_admitidas:'0'}]);
  return Promise.resolve([]);
 };
 const d=await loadRequestDetail(sql,'REQ00003');
 assert.equal(d.request.source_code,'REQ00003');
 assert.deepEqual(d.wbs,[]);
 assert.equal(d.finalDecision.decision_tecnica_final,'CAMBIO_EXTERNO');
});
