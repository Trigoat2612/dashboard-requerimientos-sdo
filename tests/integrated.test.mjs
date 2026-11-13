import test from 'node:test';
import assert from 'node:assert/strict';
import {uniqueRequests,filteredRequests,summarize,exportColumns,exportHeaders} from '../src/integrated-model.js';
import {buildAuditXlsx,buildAuditPptx} from '../src/integrated-export.js';
import {loadAuditSnapshot,loadRequestDetail} from '../api/integrated-audit.js';

const rows=[
 {id:'1',code:'REQ00001',description:'Simulación estructural',area:'Arquitectura',batch:'LOTE_B02',eligibility:'INCREMENTAL',v07_category:'AMPLIACION_PARCIAL',estimate_status:'Estimado',estimate_id:'1',wbs_count:'3',optimistic:'10',most_likely:'16',pert_expected:'17',pessimistic:'28',contingency_separate:'0',v08_agent:'V08-09',sdo_links:[{code:'RFU-ADM-03'}],gap_links:[]},
 {id:'2',code:'REQ00002',description:'Control por rol',area:'Estadística',batch:'LOTE_B02',eligibility:'CONDICIONAL',v07_category:'INDETERMINADA_TECNICAMENTE',estimate_status:'Estimado',estimate_id:'2',wbs_count:'1',optimistic:'8',most_likely:'14',pert_expected:'15',pessimistic:'26',contingency_separate:'0',v08_agent:'V08-09',sdo_links:[],gap_links:[]},
 {id:'3',code:'REQ00003',description:'Configuración SDO',area:'Arquitectura',batch:'LOTE_B02',eligibility:'EXCLUIDO',v07_category:'EXCLUIDA_OBLIGACION_SDO',estimate_status:null,estimate_id:null,sdo_links:[{code:'RFU-ADM-12'}],gap_links:[]},
 {id:'4',code:'REQ00004',description:'Ampliación pendiente',area:'Arquitectura',batch:'LOTE_B02',eligibility:'CONDICIONAL',v07_category:'NUEVO_DESARROLLO',estimate_status:'Pendiente',estimate_id:null,sdo_links:[],gap_links:[]}
];
test('318 filas únicas: el modelo no multiplica solicitudes por sus relaciones SDO',()=>{
 assert.equal(uniqueRequests([...rows,rows[0]]).length,4);
 assert.equal(filteredRequests([...rows,rows[0]],{}).length,4);
});
test('horas técnicas firmes y condicionales se separan y excluidos conservan cero',()=>{
 const m=summarize(rows,[]);
 assert.deepEqual([m.total,m.firm,m.conditional,m.excluded,m.estimated,m.pending],[4,1,2,1,2,1]);
 assert.equal(m.firmHours.pert,17);assert.equal(m.conditionalHours.pert,15);
 assert.equal(m.qaHours,null);assert.equal(m.contractApproved,null);
 assert.equal(exportColumns(rows[2])[19],0);assert.equal(exportColumns(rows[3])[19],'');
 assert.equal(exportHeaders.length,41);
});
test('filtros combinables de área, elegibilidad, horas y SDO',()=>{
 assert.deepEqual(filteredRequests(rows,{area:'Arquitectura',eligibility:'INCREMENTAL',onlySdo:true}).map(x=>x.code),['REQ00001']);
 assert.deepEqual(filteredRequests(rows,{onlyEstimated:true,minHours:'16'}).map(x=>x.code),['REQ00001']);
 assert.deepEqual(filteredRequests(rows,{eligibility:'CONDICIONAL',maxHours:'15'}).map(x=>x.code),['REQ00002']);
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
test('snapshot del backend no escribe datos y devuelve 318 sin uniones multiplicadoras',async()=>{
 const reply=[rows,[{id:1,description:'Brecha Laboral'}],[{agent_id:'V08-09',focus:'Seguridad',assigned:'4'}],[{code_a:'REQ00001',code_b:'REQ00002',status:'PENDIENTE_WBS'}],[],[],[]];
 let n=0;const sql=()=>Promise.resolve(reply[n++]);
 const result=await loadAuditSnapshot(sql);
 assert.equal(n,7);assert.equal(result.requests.length,4);assert.equal(result.gaps.length,1);
 assert.equal(result.access,'read_only_audit');
 assert.equal(result.r48.registryStatus,'not_registered');
});
test('detalle recoge solicitudes vigentes y no crea WBS cuando no existen estimaciones',async()=>{
 let n=0;const sql=()=>Promise.resolve(n++===0?[{id:3,source_code:'REQ00003',request_text:'Configuración'}]:[]);
 const result=await loadRequestDetail(sql,'REQ00003');
 assert.equal(result.request.source_code,'REQ00003');
 assert.deepEqual(result.wbs,[]);
 assert.equal(result.units.length,0);
});
