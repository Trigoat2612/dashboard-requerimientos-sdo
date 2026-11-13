import assert from 'node:assert/strict';

const base=(process.env.DASHBOARD_PRODUCTION_URL||'https://dashboard-requerimientos-sdo.vercel.app').replace(/\/$/,'');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchData(path,method='GET'){
 const r=await fetch(base+path,{method,cache:'no-store',signal:AbortSignal.timeout(25000),headers:{Accept:'application/json'}});
 const raw=await r.text();let body=null;try{body=JSON.parse(raw)}catch{}
 return {status:r.status,body,text:raw};
}
const n=x=>Number(x??0),sum=(rows,k)=>rows.reduce((s,r)=>s+n(r[k]),0);
async function verify(){
 const home=await fetchData('/');
 assert.equal(home.status,200,'Página de producción inaccesible');
 const snap=await fetchData('/api/report-v13?view=snapshot');
 assert.equal(snap.status,200,'Snapshot institucional no responde 200');
 const d=snap.body;assert.equal(d.access,'public_readonly_report');
 const m=d.manager;
 assert.equal(m.total_solicitudes,318);assert.equal(m.codigos_unicos,318);
 assert.equal(m.estimaciones_originales_conservadas,175);
 assert.equal(m.incrementales_evaluacion_usuario,122);
 assert.ok(Math.abs(n(m.horas_pert_incrementales)-13547.86)<.001);
 assert.equal(d.rows.length,318);assert.equal(new Set(d.rows.map(r=>r.code)).size,318);
 assert.equal(d.gaps.length,331);assert.equal(d.sdo.length,511);assert.equal(d.categories.length,6);
 assert.equal(d.reconciliation.valid,true);assert.equal(d.reconciliation.activities,635);
 assert.equal(d.byCode.length,122);
 const c=new Map(d.categories.map(x=>[x.categoria_resumen_v13,x]));
 for(const [key,expected] of Object.entries({
  INCREMENTAL_EVALUACION_USUARIO:122,ALCANCE_SDO:94,ALCANCE_BRECHA:2,
  DUPLICADO:8,EXTERNO_O_REFORMULACION:86,CONFIGURACIONES_Y_AJUSTES:6
 }))assert.equal(c.get(key)?.solicitudes,expected,'Clasificación '+key);
 assert.equal(c.get('CONFIGURACIONES_Y_AJUSTES').categoria_visible_v13,'Configuraciones y ajustes');
 const proposals=d.rows.filter(r=>r.categoria_resumen_v13==='INCREMENTAL_EVALUACION_USUARIO');
 assert.equal(proposals.length,122);
 assert.ok(Math.abs(sum(proposals,'horas_pert_incrementales_propuestas')-13547.86)<.015);
 assert.ok(d.rows.filter(r=>r.categoria_resumen_v13!=='INCREMENTAL_EVALUACION_USUARIO')
  .every(r=>n(r.horas_pert_incrementales_propuestas)===0),'Horas indebidamente asignadas');
 const external=d.rows.filter(r=>r.categoria_resumen_v13==='EXTERNO_O_REFORMULACION');
 assert.equal(external.length,86);
 assert.equal(external.filter(x=>/Cambio directo en sistema externo/i.test(x.subcategoria_funcional_v13||'')).length,52);
 assert.equal(external.filter(x=>/Reformular como funcionalidad EJE/i.test(x.subcategoria_funcional_v13||'')).length,34);
 assert.ok(Math.abs(sum(d.phases,'horas')-13547.86)<.015);
 assert.equal(sum(d.phases,'actividades'),635);
 const w=await fetchData('/api/report-v13?view=wbs');
 assert.equal(w.status,200);assert.equal(w.body.rows.length,635);
 assert.equal(new Set(w.body.rows.map(x=>x.codigo)).size,122);
 assert.ok(Math.abs(sum(w.body.rows,'horas_pert')-13547.86)<.015);
 const detail=await fetchData('/api/report-v13?view=detail&code=REQ00157');
 assert.equal(detail.status,200);
 assert.equal(detail.body.record.categoria_resumen_v13,'INCREMENTAL_EVALUACION_USUARIO');
 assert.ok(detail.body.wbs.length>0);
 assert.ok(Math.abs(n(detail.body.totals.pert)-n(detail.body.record.horas_pert_incrementales_propuestas))<.015);
 const externalDetail=await fetchData('/api/report-v13?view=detail&code=REQ00613');
 assert.equal(externalDetail.status,200);
 assert.equal(externalDetail.body.record.categoria_resumen_v13,'EXTERNO_O_REFORMULACION');
 assert.equal(externalDetail.body.wbs.length,0);
 assert.equal(n(externalDetail.body.record.horas_pert_incrementales_propuestas),0);
 const full=await fetchData('/api/report-v13?view=export');
 assert.equal(full.status,200);assert.equal(full.body.rows.length,318);
 assert.equal(full.body.wbs.length,635);
 assert.equal(full.body.categories.length,6);
 assert.ok(full.body.rows.some(r=>r.justificacion_metodo&&r.criterio_decision_informe),'Fundamentos individuales no exportados');
 const docs=await fetchData('/api/data');
 assert.equal(docs.status,200,'Se conservó consulta pública documental');
 assert.ok(docs.body.documents?.length>0);
 assert.ok(docs.body.documents.some(x=>/^https:\/\//.test(x.url||'')),'Enlaces originales no disponibles');
 const write=await fetchData('/api/report-v13','POST');
 assert.equal(write.status,405,'El endpoint debe rechazar modificaciones');
 console.log(JSON.stringify({status:'OK',report:'Consolidado institucional',requests:d.rows.length,
  proposed:proposals.length,pert:n(m.horas_pert_incrementales),categories:d.categories.map(x=>[x.categoria_visible_v13,x.solicitudes]),
  estimateCount:m.estimaciones_originales_conservadas,wbs:w.body.rows.length,documents:docs.body.documents.length,
  detail:detail.body.record.code,excluded:externalDetail.body.record.code,url:base}));
}
let lastError;
for(let attempt=1;attempt<=9;attempt++){
 try{await verify();process.exit(0)}catch(e){lastError=e;console.error('Verificación '+attempt+': '+e.message);if(attempt<9)await sleep(12000)}
}
console.error('No se pudo aprobar la verificación productiva: '+lastError.message);process.exit(1);
