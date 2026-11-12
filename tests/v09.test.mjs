import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterGaps, pageGaps, gapExportRows } from '../src/gap-model.js';
import { escapeCsvCell, toSafeCsv } from '../src/csv-utils.js';
import dataHandler from '../api/data.js';
import gapsHandler from '../api/gaps.js';
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
for(const [name, handler] of [['data', dataHandler], ['gaps', gapsHandler]]) {
  test('/api/'+name+' deniega usuario anónimo y credenciales no verificadas', async () => {
    for(const headers of [{}, {authorization:'Bearer inventado'}, {cookie:'session=sin_verificar'}]) {
      const res = response();
      await handler({ method:'GET', headers }, res);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'INSTITUTIONAL_ACCESS_REQUIRED');
      assert.match(String(res.headers['Cache-Control']), /no-store/);
      assert.ok(!JSON.stringify(res.body).includes('RFU-'));
    }
    const res = response();
    await handler({ method:'POST' }, res);
    assert.equal(res.statusCode, 405);
  });
}
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
