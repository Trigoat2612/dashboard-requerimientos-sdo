import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {completeCategories} from '../api/report-v13.js';

test('categorías con cero solicitudes se muestran sin intentar leer una ficha inexistente',()=>{
 const categories=completeCategories([
  {categoria_resumen_v13:'ALCANCE_SDO',categoria_visible_v13:'Obligaciones SDO',solicitudes:94}
 ]);
 const category=categories.find(c=>c.categoria_resumen_v13==='ALCANCE_BRECHA');
 assert.equal(category.solicitudes,0);
 const rows=[{code:'REQ00001',categoria_resumen_v13:'ALCANCE_SDO'}];
 assert.equal(rows.find(r=>r.categoria_resumen_v13===category.categoria_resumen_v13),undefined);
 const jsx=readFileSync(new URL('../src/ReportV13.jsx',import.meta.url),'utf8');
 assert.match(jsx,/x\?<><button className="ai-link" onClick=\{\(\)=>openDetail\(x\.code\)\}/);
 assert.match(jsx,/Sin solicitudes registradas en esta categoría \(0 casos\)/);
 assert.doesNotMatch(jsx,/<td><button className="ai-link" onClick=\{\(\)=>openDetail\(x\.code\)\}/);
});
