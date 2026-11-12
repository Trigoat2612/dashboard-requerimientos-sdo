import assert from 'node:assert/strict';

const base = process.env.V09_PREVIEW_URL || 'https://dashboard-requerimientos-sd-git-8b1718-miguel-trigosos-projects.vercel.app';
const expectedSha = process.env.V09_HEAD_SHA || '';
const token = process.env.GITHUB_TOKEN || '';
const repo = process.env.GITHUB_REPOSITORY || '';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const deadline = Date.now() + 105000;

async function waitForGitDeployment() {
  if (!token || !repo || !expectedSha) throw Error('Sin credenciales/código de PR para verificar commit Preview');
  let last = '';
  while (Date.now() < deadline) {
    const response = await fetch(`https://api.github.com/repos/${repo}/commits/${expectedSha}/status`, {
      headers: { Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json', 'User-Agent':'v09-preview-verification' }
    });
    if (!response.ok) throw Error(`No se pudo verificar estado de GitHub: HTTP ${response.status}`);
    const status = await response.json();
    const vercel = status.statuses?.find(s => s.context === 'Vercel');
    last = vercel?.state || 'missing';
    if (last === 'success') { console.log('GitHub/Vercel READY para commit '+expectedSha.slice(0,10));return; }
    if (last === 'failure' || last === 'error') throw Error('Vercel reportó error para commit candidato');
    await delay(5000);
  }
  throw Error('Vercel no confirmó READY para commit candidato; último estado='+last);
}

async function get(path,{method='GET'}={}) {
  const url = base + path;
  const headers = {};
  if(process.env.VERCEL_PREVIEW_BYPASS_TOKEN) headers['x-vercel-protection-bypass'] = process.env.VERCEL_PREVIEW_BYPASS_TOKEN;
  const response = await fetch(url,{method,headers,redirect:'manual',signal:AbortSignal.timeout(12000)});
  const ct = response.headers.get('content-type')||'';
  const body = ct.includes('json')?await response.json():await response.text();
  return {status:response.status,ct,body,location:response.headers.get('location')};
}

function statusMust(v,expected,path) {
  if(v.status !== expected) throw Error(`Smoke HTTP ${path}: ${v.status}, esperado ${expected}; Content-Type=${v.ct}`);
}
async function run() {
  await waitForGitDeployment();
  let index;
  for(let i=0;i<8;i++){
    try { index=await get('/'); if(index.status===200)break; }
    catch(e) {console.log('Preview aún no responde ('+e.name+')');}
    if(Date.now()+6000>deadline)break;
    await delay(5000);
  }
  statusMust(index,200,'/');
  if(typeof index.body !== 'string' || !index.body.includes('id="root"')) throw Error('HTML Preview sin raíz React');
  console.log('PASS Preview HTML');
  const auth=await get('/api/auth-config');
  statusMust(auth,200,'/api/auth-config');
  assert.equal(auth.body.provider,'google_oidc');
  assert.equal(typeof auth.body.enabled,'boolean');
  console.log('PASS OIDC configuración declarada (habilitado='+auth.body.enabled+')');
  const anonymous=await get('/api/institutional-data?view=dashboard');
  statusMust(anonymous,401,'/api/institutional-data sin token');
  assert.equal(anonymous.body.code,'UNAUTHENTICATED');
  console.log('PASS consulta institucional anónima rechazada');
  const badwrite=await get('/api/update',{method:'POST'});
  statusMust(badwrite,403,'/api/update POST');
  console.log('PASS escritura anónima rechazada');
  const publicRows=await get('/api/data');
  statusMust(publicRows,200,'/api/data');
  assert.equal(publicRows.body.access,'public_metadata_only');
  assert.equal(publicRows.body.sdo.length,511);
  assert.equal(publicRows.body.requests.length,68);
  const parsed=JSON.stringify(publicRows.body);
  for(const key of ['v07_basis','contractual_evidence','v06_basis','document_url_original','requester_email'])assert.ok(!parsed.includes('"'+key+'"'), 'Campo institucional en API pública: '+key);
  console.log('PASS Neon público 511 SDO y 68 solicitudes, sin fundamentos restringidos');
  const gaps=await get('/api/gaps');
  statusMust(gaps,200,'/api/gaps');
  assert.equal(gaps.body.access,'public_metadata_only');
  assert.equal(gaps.body.registryStatus,'not_migrated');
  console.log('PASS brechas clasificadas como propuestas, sin fingir migración');
  const overview=await get('/api/v2-summary');
  statusMust(overview,200,'/api/v2-summary');
  assert.equal(Number(overview.body.overview?.sdo_total),511);
  console.log('PASS resumen ejecutivo Neon');
  if(!auth.body.enabled)throw Error('Bloqueo institucional: OIDC no habilitado en Preview, falta configurar Google Client ID y correos');
  console.log('NOTA: login Google real y navegador siguen exigiendo pruebas E2E adicionales');
}
run().catch(e=>{console.error('PREVIEW BLOQUEADO:',e.message);process.exitCode=1;});
