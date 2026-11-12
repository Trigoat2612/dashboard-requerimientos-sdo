import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterGaps, pageGaps, gapExportRows } from '../src/gap-model.js';
import { escapeCsvCell, toSafeCsv } from '../src/csv-utils.js';
import dataHandler, { buildPublicMetadata } from '../api/data.js';
import gapsHandler, { buildPublicGapMetadata } from '../api/gaps.js';
import updateHandler from '../api/update.js';

const gaps = [
  {gap_id:'GAP-001', gap_kind:'Defecto de implementación', sdo_codes:['RFU-01'], component:'Migración', severity:'Alta', owner_proposed:'GTI', attention_status:'Abierta', observed_behavior:'Error de consulta'},
  {gap_id:'GAP-002', gap_kind:'Insuficiencia de evidencia', sdo_codes:['RNF-02'], component:'Seguridad', severity:'Media', owner_proposed:'Softplan', attention_status:'En revisión', observed_behavior:'Validación pendiente'},
  {gap_id:'GAP-003', gap_kind:'Mejora fuera de SDO', sdo_codes:['RFU-03'], component:'Integraciones', severity:'Baja', owner_proposed:'GTI', attention_status:'Propuesta', observed_behavior:'Solicitud nueva'}
];
function response() {
  return {
    headers: {}, statusCode: 200, body: null,
    setHeader(k, v){ this.headers[k] = v; return this; },
    status(v){ this.statusCode = v; return this; },
    json(v){ this.body = v; return this; }
  };
}

test('filtros V09 combinan código SDO, tipo, componente y estado con AND', () => {
  assert.deepEqual(filterGaps(gaps, {sdo:'RFU-01', kind:'Defecto de implementación', component:'Migración', status:'Abierta'}).map(x=>x.gap_id), ['GAP-001']);
  assert.deepEqual(filterGaps(gaps, {sdo:'RFU-01', severity:'Baja'}), []);
});
test('filtrado de responsable y texto tolera mayúsculas y acentos', () => {
  assert.equal(filterGaps(gaps, {owner:'softPLAN', search:'validacion'}).length, 1);
  assert.equal(filterGaps(gaps, {search:'integraciones'}).length, 1);
});
test('paginación acota páginas, no repite registros ni altera datos', () => {
  assert.deepEqual(pageGaps(gaps, 2, 2).rows.map(x=>x.gap_id), ['GAP-003']);
  assert.equal(pageGaps(gaps, 20, 2).page, 2);
  assert.equal(pageGaps([], 0, 20).page, 1);
  assert.equal(gaps.length, 3);
});
test('exportación conserva las claves referenciales y no crea horas', () => {
  const rows = gapExportRows(gaps);
  assert.equal(rows.length, 4);
  assert.equal(rows[1][2], 'RFU-01');
  assert.ok(!rows[0].includes('Horas'));
});
test('proyección pública conserva las clasificaciones y elimina contenidos institucionales', () => {
  const secret = 'INFORMACION_INTERNA_CONFIDENCIAL_741';
  const payload = buildPublicMetadata({
    requests: [{id:4,request_code:'REQ00004',area:'Área',component:'Componente',request_text:secret,requester:secret,hours_expected:999}],
    sdo:[{code:'RFU-01',stage:'E1',layer:'Servicio',component:'Consulta',requirement_type:'Funcional',cycle:'1',description:secret,verification_status:secret}],
    documents:[{id:'drive-original-secreto',category:'Diseño',mime_type:'application/pdf',scan_status:'Contrastado',title:secret,url:'https://internal.example/secret'}],
    methods:[{name:'WBS',supplier_proposed:true,description:secret}],
    evidence:[{sdo_code:'RFU-01',document_id:'drive-original-secreto',confidence:'Alta',rationale:secret}],
    assessments:[{id:1,sdo_code:'RFU-01',document_id:'drive-original-secreto',coverage:'Parcial',review_level:'Análisis documental contrastado',finding:secret,source_detail:secret,missing_validation:secret}],
    compliance:[{code:'RFU-01',proposed_evaluation:'Cumplimiento parcial',proposal_status:'Propuesta'}],
    classification:[{request_id:4,classification:'Indeterminada',related_sdo_codes:['RFU-01'],proposal_status:'Propuesta'}],
    estimateMethodCounts:[{request_id:4,total:2,estimate_expected:999}]
  });
  assert.equal(payload.access, 'public_metadata_only');
  assert.equal(payload.sdo[0].v06_evaluation, 'Cumplimiento parcial');
  assert.equal(payload.requests[0].v07_classification, 'Indeterminada');
  assert.equal(payload.documents[0].url, null);
  assert.equal(payload.documents[0].title.startsWith('Documento institucional'), true);
  assert.equal(payload.evidence[0].document_id, payload.documents[0].id);
  assert.equal(payload.requests[0].hours_expected, null);
  assert.equal(payload.requests[0].v08_independent_method_count, 2);
  assert.equal(payload.requests[0].estimation_basis,null);
  assert.ok(!JSON.stringify(payload).includes(secret));
  assert.ok(!JSON.stringify(payload).includes('drive-original-secreto'));
  assert.ok(!JSON.stringify(payload).includes('internal.example'));
  assert.ok(!JSON.stringify(payload).includes('999'));
});
test('endpoints de consulta aceptan GET, rechazan POST y no divulgan secretos ante error', async () => {
  const before = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    for (const handler of [dataHandler,gapsHandler]) {
      const post = response();
      await handler({method:'POST'},post);
      assert.equal(post.statusCode,405);
      const get = response();
      await handler({method:'GET',headers:{authorization:'Bearer falso'}},get);
      assert.equal(get.statusCode,503);
      assert.ok(!JSON.stringify(get.body).includes('DATABASE_URL='));
      assert.match(String(get.headers['Cache-Control']),/no-store/);
    }
  } finally {
    if(before===undefined)delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL=before;
  }
});
test('las consultas públicas no seleccionan textos contractuales, fuentes ni hallazgos', () => {
  const code = readFileSync(new URL('../api/data.js',import.meta.url),'utf8');
  const sqlProjection = code.slice(code.indexOf('const [requests, sdo, documents'),code.indexOf('return res.status(200).json(buildPublicMetadata'));
  assert.doesNotMatch(sqlProjection, /SELECT\\s+\\*/i);
  assert.doesNotMatch(sqlProjection, /\\b(request_text|requester|description|finding|missing_validation|source_detail|rationale|url|basis|evidence_references|contractual_evidence|hours_expected)\\b/i);
  const gaps = readFileSync(new URL('../api/gaps.js',import.meta.url),'utf8');
  assert.doesNotMatch(gaps, /SELECT[^;]*(?:basis|contractual_evidence|finding|request_text)/i);
  assert.match(gaps, /registryStatus: 'not_migrated'/);
});
test('/api/update mantiene prohibición de escritura anónima', async () => {
  const res = response();
  await updateHandler({method:'POST'}, res);
  assert.equal(res.statusCode, 403);
});
test('el resumen no suma el triaje como estimación independiente', () => {
  const source = readFileSync(new URL('../api/v2-summary.js', import.meta.url), 'utf8');
  assert.match(source, /historical_triage_hours/);
  assert.match(source, /hours_estimate_proposals/);
  assert.match(source, /approved_hours: null/);
});
test('SQL de brechas existe únicamente como DRAFT y no depende de V06 parcial', () => {
  const source = readFileSync(new URL('../sql/v09-gap-register-DRAFT.sql', import.meta.url),'utf8');
  assert.match(source, /CREATE TABLE IF NOT EXISTS/);
  assert.doesNotMatch(source, /INSERT INTO.*sdo_compliance_proposals/i);
});

test('CSV conserva BOM y CRLF, neutraliza fórmulas y escapa comillas', () => {
  assert.equal(escapeCsvCell('=SUM(1,2)'), '"\'=SUM(1,2)"');
  assert.equal(escapeCsvCell('  @cmd'), '"\'  @cmd"');
  assert.equal(escapeCsvCell('nombre "doble"'), '"nombre ""doble"""');
  const output = toSafeCsv([['Código','Campo'],['A','+payload'],['B','texto']]);
  assert.ok(output.startsWith('\uFEFF'));
  assert.ok(output.includes('\r\n'));
  assert.ok(output.includes('"\'+payload"'));
});

test('candidatos de brechas son referencias V07, nunca brechas confirmadas', () => {
  const sensitive = 'CONTRATO_RESERVADO_9';
  const projected = buildPublicGapMetadata([{
    request_code: 'REQ00100', classification:'Brecha existente',
    related_sdo_codes:['RFU-01'], related_gap_ids:['BRE-164'],
    proposal_status:'Propuesta, pendiente de aprobación', basis:sensitive,
    contractual_evidence:sensitive, owner:sensitive
  }]);
  assert.equal(projected.access,'public_metadata_only');
  assert.equal(projected.registryStatus,'not_migrated');
  assert.deepEqual(projected.rows,[]);
  assert.equal(projected.candidates.length,1);
  assert.deepEqual(projected.candidates[0].reference_ids,['BRE-164']);
  assert.ok(!JSON.stringify(projected).includes(sensitive));
  assert.match(projected.notice,/no son brechas consolidadas/i);
});
test('paneles de lectura anonimizados habilitados sin contraseñas compartidas', () => {
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.match(app,/public_metadata_only/);
  assert.match(app,/publicRedacted/);
  assert.match(app,/Ficha de consulta/);
  assert.doesNotMatch(app,/Acceso a datos institucionales no habilitado/);
  const summary=readFileSync(new URL('../api/v2-summary.js',import.meta.url),'utf8');
  assert.doesNotMatch(summary,/methods_count::int AS total, total_min/);
  assert.match(summary,/lease_expires_at > NOW\(\)/);
  const publicApi=readFileSync(new URL('../api/data.js',import.meta.url),'utf8');
  assert.doesNotMatch(publicApi,/DASHBOARD_ACCESS_KEY/);
});
test('explorador de brechas incluye adaptación responsive definida', () => {
  const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
  assert.match(css, /@media\(max-width:630px\)/);
  assert.match(css, /\.gap-explorer \.toolbar/);
});
