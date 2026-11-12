import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  institutionalAuthConfig, verifyInstitutionalToken, AuthenticationError
} from '../lib/institutional-auth.js';
import { buildInstitutionalDashboard, buildInstitutionalDetail } from '../lib/institutional-views.js';
import { createInstitutionalHandler } from '../api/institutional-data.js';

const now = Math.floor(Date.now()/1000);
const keys = generateKeyPairSync('rsa',{modulusLength:2048});
const publicJwk = { ...keys.publicKey.export({format:'jwk'}), kid:'testkid', use:'sig', alg:'RS256' };
const env = { GOOGLE_OIDC_CLIENT_ID:'google-client.apps.googleusercontent.com',
  INSTITUTIONAL_ALLOWED_EMAILS:'analista@pj.gob.pe,auditoria@pj.gob.pe' };
const fetchImpl = async ()=>({ok:true,json:async()=>({keys:[publicJwk]})});
function jwt(payload={}, header={}) {
  const h = Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid:'testkid',...header})).toString('base64url');
  const p = Buffer.from(JSON.stringify({iss:'https://accounts.google.com',aud:env.GOOGLE_OIDC_CLIENT_ID,sub:'google-sub-123',email:'analista@pj.gob.pe',email_verified:true,iat:now-30,exp:now+3600,...payload})).toString('base64url');
  const signature=sign('RSA-SHA256',Buffer.from(h+'.'+p),keys.privateKey).toString('base64url');
  return h+'.'+p+'.'+signature;
}
function res() {return {headers:{},statusCode:200,data:null,setHeader(k,v){this.headers[k]=v;return this;},status(n){this.statusCode=n;return this;},json(v){this.data=v;return this;}};}

test('configuración deshabilitada sin correo nominal y client id',()=>{
  assert.equal(institutionalAuthConfig({GOOGLE_OIDC_CLIENT_ID:'abc'}).enabled,false);
  assert.equal(institutionalAuthConfig(env).allowedEmails.size,2);
});
test('Google JWT RS256 auténtico autoriza exclusivamente usuario nominal',async()=>{
  const result=await verifyInstitutionalToken(jwt(),{env,fetchImpl});
  assert.equal(result.email,'analista@pj.gob.pe');
  assert.deepEqual(result.roles,['institutional_reader']);
  assert.ok(result.expiresAt>now);
});
test('restringe cuenta no autorizada aunque Google verifique la firma',async()=>{
  await assert.rejects(verifyInstitutionalToken(jwt({email:'externo@example.com'}),{env,fetchImpl}),e=>e instanceof AuthenticationError&&e.status===403);
  await assert.rejects(verifyInstitutionalToken(jwt({email_verified:false}),{env,fetchImpl}),AuthenticationError);
});
test('deniega token expirado, audiencia incorrecta, issuer falso, firma inválida y alg none',async()=>{
  for(const token of [
    jwt({exp:now-20}),jwt({aud:'other-client'}),jwt({iss:'https://attacker.invalid'}),
    jwt().slice(0,-5)+'aaaaa',jwt({}, {alg:'none'})
  ]) await assert.rejects(verifyInstitutionalToken(token,{env,fetchImpl}),AuthenticationError);
});
test('proyección institucional conserva texto, V06 y V07 sin alterar estado original',()=>{
  const data=buildInstitutionalDashboard({
    requirements:[{code:'RFU-X',description:'Texto SDO original',verification_status:'Pendiente oficial'}],
    compliance:[{code:'RFU-X',proposed_evaluation:'Cumplimiento parcial',basis:'Análisis V06 original',missing_validation:'Prueba pendiente',proposal_status:'Propuesta'}],
    requests:[{id:8,request_code:'REQ-X',request_text:'Solicitud original',status:'Por verificar',hours_expected:250}],
    classifications:[{request_id:8,classification:'Genuinamente nueva',basis:'Fundamento contractual V07',contractual_evidence:'Documento',related_sdo_codes:['RFU-X'],proposal_status:'Propuesta'}],
    documents:[{id:'doc-123',title:'Prueba.pdf',url:'https://drive.google.com/example'}],
    evidence:[{document_id:'doc-123',sdo_code:'RFU-X',rationale:'Hallazgo sustentado'}],
    assessments:[{id:1,document_id:'doc-123',finding:'Se requiere validación'}],
    estimateCounts:[{request_id:8,total:0}]
  });
  assert.equal(data.access,'institutional_verified');
  assert.equal(data.sdo[0].description,'Texto SDO original');
  assert.equal(data.sdo[0].verification_status,'Pendiente oficial');
  assert.equal(data.sdo[0].v06_basis,'Análisis V06 original');
  assert.equal(data.requests[0].request_text,'Solicitud original');
  assert.equal(data.requests[0].historical_status,'Por verificar');
  assert.equal(data.requests[0].v07_basis,'Fundamento contractual V07');
  assert.equal(data.documents[0].url,'https://drive.google.com/example');
  assert.equal(data.evidence[0].document_title,'Prueba.pdf');
  assert.equal(data.assessments[0].finding,'Se requiere validación');
  assert.equal(data.requests[0].hours_expected,250);
  assert.notEqual(data.sdo[0].verification_status,data.sdo[0].v06_evaluation);
});
test('la ficha independiente conserva fundamentos V06 y V07',()=>{
  const d=buildInstitutionalDetail('sdo',{code:'RFU-X',description:'Obligación'},{
    compliance:{basis:'Fundamento V06',missing_validation:'Pendiente'},evidence:[{document_title:'Prueba.pdf'}]});
  assert.equal(d.compliance.basis,'Fundamento V06');
  assert.equal(d.evidence[0].document_title,'Prueba.pdf');
});
test('sin token, incluso llamadas directas a API no alcanzan Neon',async()=>{
  let called=false;
  const handler=createInstitutionalHandler({authenticate:async()=>{called=true;return {roles:['institutional_reader']};},
    connect:()=>{throw Error('No debe conectarse');}});
  const response=res();await handler({method:'GET',query:{view:'dashboard'},headers:{}},response);
  assert.equal(response.statusCode,401);
  assert.equal(called,false);
  assert.equal(response.data.code,'UNAUTHENTICATED');
});
test('token firmado pero sin rol no permite consultas directas ni abre conexión',async()=>{
  let connected=false;
  const handler=createInstitutionalHandler({authenticate:async()=>({roles:[]}),
    connect:()=>{connected=true;throw Error('No debe conectarse');}});
  const response=res();await handler({method:'GET',headers:{authorization:'Bearer cualquiera'},query:{view:'dashboard'}},response);
  assert.equal(response.statusCode,403);
  assert.equal(connected,false);
});
test('autorizado obtiene análisis sin modificar fuente; POST queda prohibido',async()=>{
  const previous=process.env.DATABASE_URL;process.env.DATABASE_URL='postgresql://test-only';
  const fixtures=[
    [{code:'RFU-X',description:'Descripción SDO',verification_status:'Registrado'}],
    [{code:'RFU-X',proposed_evaluation:'No verificable',basis:'Fundamento V06'}],
    [{id:1,request_code:'REQ-X',request_text:'Descripción original',status:'Por verificar'}],
    [{request_id:1,classification:'Indeterminada',basis:'Fundamento V07'}],
    [{id:'file-1',title:'Documento real'}],
    [],[],[],[]
  ];
  let idx=0,queries=0;
  const handler=createInstitutionalHandler({
    authenticate:async()=>({email:'analista@pj.gob.pe',roles:['institutional_reader']}),
    connect:()=>async()=>{queries++;return fixtures[idx++];}
  });
  try {
    const ok=res();await handler({method:'GET',headers:{authorization:'Bearer válido'},query:{view:'dashboard'}},ok);
    assert.equal(ok.statusCode,200);assert.equal(ok.data.access,'institutional_verified');
    assert.equal(ok.data.sdo[0].description,'Descripción SDO');
    assert.equal(ok.data.sdo[0].v06_basis,'Fundamento V06');
    assert.equal(ok.data.requests[0].v07_basis,'Fundamento V07');
    assert.equal(queries,9);
    const bad=res();await handler({method:'POST',headers:{authorization:'Bearer válido'}},bad);
    assert.equal(bad.statusCode,405);assert.equal(queries,9);
  } finally {if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;}
});
