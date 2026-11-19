import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { SDO_PHASES, getSdoPhaseInfo } from '../src/sdo-phases.js';

test('Las siete fases SDO tienen una denominación y explicación verificable', () => {
  assert.deepEqual(Object.keys(SDO_PHASES), ['1','2','3','4','5','6','7']);
  for (const [number, info] of Object.entries(SDO_PHASES)) {
    assert.ok(info.name.length > 8, 'Fase '+number+' necesita denominación');
    assert.ok(info.description.length > 30, 'Fase '+number+' necesita explicación');
    assert.equal(getSdoPhaseInfo(number), info);
  }
  assert.match(getSdoPhaseInfo('6').name, /Mantenimiento/);
  assert.match(getSdoPhaseInfo('7').name, /cierre/i);
});

test('El seguimiento documental muestra el glosario y nombres de fase en gráfico, filtro y detalle', () => {
  const component = readFileSync(new URL('../src/SdoTracking.jsx', import.meta.url), 'utf8');
  assert.match(component, /¿Qué significa cada fase\?/);
  assert.match(component, /getSdoPhaseInfo\(f\)\.name|const info=getSdoPhaseInfo\(f\)/);
  assert.match(component, /getSdoPhaseInfo\(p\)\.name/);
  assert.match(component, /getSdoPhaseInfo\(d\.phase\)\.name/);
});

test('El menú agrupa todas las secciones con desplazamiento independiente', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  const nav = app.match(/const navGroups=\[([\s\S]+?)\];/);
  assert.ok(nav, 'Se espera agrupación del menú');
  const tabIds = app.match(/\{id:'[^']+',label:/g).map(item => item.split("'")[1]);
  const groupIds = [...nav[1].matchAll(/items:\[([^\]]+)\]/g)]
    .flatMap(match => [...match[1].matchAll(/'([^']+)'/g)].map(item => item[1]));
  assert.deepEqual([...groupIds].sort(), [...tabIds].sort(), 'Todos los ítems deben estar agrupados una sola vez');
  assert.match(styles, /\.sidebar nav\.side-nav\{[^}]*overflow-y:auto/);
  assert.match(app, /aria-expanded=\{Boolean\(openNavGroups\[group\.id\]\)\}/);
});
