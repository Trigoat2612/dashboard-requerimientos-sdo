// Comprobación productiva de solo lectura; no crea ni modifica datos institucionales.
import assert from 'node:assert/strict';

const base = (process.env.AUDIT_PRODUCTION_URL || 'https://dashboard-requerimientos-sdo.vercel.app').replace(/\/$/,'');
const pause = ms => new Promise(r => setTimeout(r,ms));
async function load(url,options={}){
 const response=await fetch(url,{...options,signal:AbortSignal.timeout(20000),headers:{Accept:'application/json',...(options.headers||{})}});
 const raw=await response.text();
 let payload;
 try{payload=JSON.parse(raw)}catch{payload=null}
 return {status:response.status,body:payload,rawLength:raw.length,redirect:response.url};
}
async function verify(){
 const home=await load(base+'/');
 assert.equal(home.status,200,'La página productiva debe responder 200');
 const data=await load(base+'/api/integrated-audit?view=snapshot');
 assert.equal(data.status,200,'La API consolidada debe responder 200; HTTP '+data.status);
 assert.equal(data.body?.access,'read_only_audit');
 const rows=data.body.requests,gaps=data.body.gaps;
 assert.equal(rows.length,318,'Universo de 318 solicitudes');
 assert.equal(new Set(rows.map(x=>x.code)).size,318,'Código de solicitud único');
 assert.equal(gaps.length,331,'Universo de 331 brechas Laboral');
 assert.equal(data.body.agents.length,8,'Ventanas V08 habilitadas');

 const finalVersion=data.body.sourceVersion;
 assert.ok(finalVersion?.includes('NOVEDAD-TECNICA-V9'),'Solo cierre técnico V00 V9 vigente');
 assert.equal(data.body.managerial.universo_318,318,'Referencia gerencial unívoca');
 const final=rows.filter(r=>r.final_new);
 assert.equal(final.length,Number(data.body.managerial.novedades_eje),'Contar únicamente NUEVO_EJE');
 assert.ok(final.every(r=>r.final_decision==='NUEVO_EJE'),'La estimación final es estrictamente de novedad técnica');
 const actual=final.reduce((sum,r)=>sum+Number(r.final_pert||0),0);
 assert.ok(Math.abs(actual-Number(data.body.managerial.horas_pert))<0.02,'Horas finales reconciliadas con el gerente V00 V9');
 const allNonNew=rows.filter(r=>!r.final_new);
 assert.equal(allNonNew.length+final.length,318,'Clasificación final de todas las solicitudes');
 assert.ok(allNonNew.every(r=>Number(r.final_pert||0)===0),'Excluidos y externos sin horas EJE');
 assert.ok(allNonNew.some(r=>r.final_decision==='CAMBIO_EXTERNO'),'Modificar satélite no es desarrollo EJE');
 assert.ok(data.body.r48?.registryStatus==='recorded','R48 persistido en Neon');
 assert.ok(data.body.r48.scope?.length>0&&data.body.r48.resolutions?.length>0,'Resoluciones R48 consultables');
 const exported=await load(base+'/api/integrated-audit?view=export');
 assert.equal(exported.status,200,'Excel completo debe responder 200');
 assert.equal(exported.body?.access,'read_only_audit_export');
 assert.equal(exported.body.rows.length,318,'Exportación íntegra de 318 registros');
 const exportDetail=exported.body.rows.find(x=>x.code==='REQ00157');
 assert.ok(exportDetail?.contractual_basis_full,'Excel con fundamento contractual');
 assert.ok(exportDetail?.fundamento_final_export,'Excel con dictamen V00 V9');
 assert.ok(exportDetail?.estimate_justification,'Excel con WBS histórica y su justificación');
 const positive=await load(base+'/api/integrated-audit?view=detail&code=REQ00157');
 assert.equal(positive.status,200,'Ficha de nueva funcionalidad accesible');
 assert.equal(positive.body.finalDecision.decision_tecnica_final,'NUEVO_EJE');
 assert.ok(positive.body.wbs?.length>0,'WBS admitida mostrada');
 const wbsSum=positive.body.wbs.reduce((sum,w)=>sum+Number(w.pert||0),0);
 assert.ok(Math.abs(wbsSum-Number(positive.body.finalDecision.horas_pert_admitidas))<0.02,'WBS de la ficha coincide con V00 V9');
 const external=await load(base+'/api/integrated-audit?view=detail&code=REQ00613');
 assert.equal(external.status,200,'Ficha de satélite accesible');
 assert.equal(external.body.finalDecision.decision_tecnica_final,'CAMBIO_EXTERNO');
 assert.equal(external.body.wbs.length,0,'No mostrar WBS histórica externa como esfuerzo reconocido');
 assert.ok(external.body.historicalWbs?.length>0,'Conservar historia V08 sin financiarla');
 const post=await load(base+'/api/integrated-audit',{method:'POST'});
 assert.equal(post.status,405,'Endpoint de lectura rechaza escritura');
 console.log(JSON.stringify({status:'OK',requests:rows.length,gaps:gaps.length,version:finalVersion,
   novedades:final.length,pertV00:Number(actual.toFixed(3)),r48V4:data.body.r48.scope.length,r48V5:data.body.r48.resolutions.length,
   admittedWbs:positive.body.wbs.length,externalExcluded:external.body.request.source_code,base}));
}
let error;
for(let attempt=1;attempt<=8;attempt++){
 try{await verify();process.exit(0)}catch(e){error=e;console.error('Intento '+attempt+': '+e.message);if(attempt<8)await pause(15000);}
}
console.error('Smoke productivo no aprobado: '+error.message);process.exit(1);
