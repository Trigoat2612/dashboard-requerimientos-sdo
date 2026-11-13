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
 const estimates=rows.filter(x=>x.estimate_id);
 assert.ok(estimates.length>0,'Estimaciones registradas visibles');
 assert.ok(rows.some(x=>x.eligibility==='EXCLUIDO'),'Exclusiones por contrato');
 assert.ok(rows.some(x=>x.eligibility==='CONDICIONAL'),'Estimaciones condicionadas');
 const exported=await load(base+'/api/integrated-audit?view=export');
 assert.equal(exported.status,200,'Exportación Excel debe consultar textos originales');
 assert.equal(exported.body?.access,'read_only_audit_export');
 assert.equal(exported.body.rows.length,318,'Exportación íntegra de 318 registros');
 const exDetail=exported.body.rows.find(x=>x.code==='REQ00411');
 assert.ok(exDetail?.contractual_basis_full,'Exportación incluye base contractual sin recorte');
 assert.ok(exDetail?.estimate_justification,'Exportación incluye justificación del método WBS');
 const req=await load(base+'/api/integrated-audit?view=detail&code=REQ00411');
 assert.equal(req.status,200,'Ficha individual accesible');
 assert.equal(req.body.request.source_code,'REQ00411');
 assert.ok(req.body.wbs?.length>0,'Actividades WBS visibles en detalle');
 assert.ok(req.body.sdoLinks?.length>0,'SDO relacionado visible');
 assert.ok(req.body.units?.[0]?.methodology?.startsWith('WBS_')||req.body.units?.some(x=>x.methodology?.startsWith('WBS_')),'Método de estimación explícito');
 const post=await load(base+'/api/integrated-audit',{method:'POST'});
 assert.equal(post.status,405,'Endpoint de lectura rechaza escritura');
 console.log(JSON.stringify({status:'OK',requests:rows.length,gaps:gaps.length,estimated:estimates.length,detail:req.body.request.source_code,wbs:req.body.wbs.length,base}));
}
let error;
for(let attempt=1;attempt<=8;attempt++){
 try{await verify();process.exit(0)}catch(e){error=e;console.error('Intento '+attempt+': '+e.message);if(attempt<8)await pause(15000);}
}
console.error('Smoke productivo no aprobado: '+error.message);process.exit(1);
