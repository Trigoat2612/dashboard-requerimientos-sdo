import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSheet,qaCategory,toPublic,safeGoogleUrl,EXPECTED_HEADERS } from '../lib/sdo-document-model.js';
function fixture(){
 const header=Array(26).fill('');for(const [idx,name] of Object.entries(EXPECTED_HEADERS))header[Number(idx)]=name;
 return [header,...Array.from({length:83},(_,i)=>{const x=Array(26).fill('');x[0]=(Math.floor(i/15)+1)+'.'+(i%15+1);x[1]=''+(Math.floor(i/15)+1);x[2]='Documento '+i;x[4]='A03';x[24]=i<35?'https://docs.google.com/document/d/a'+i+'/edit':'';return x;})];
}
test('83 codes unique, 35 proposed, exact source and no hardcoded state',()=>{
 const docs=normalizeSheet(fixture());
 assert.equal(docs.length,83);assert.equal(new Set(docs.map(x=>x.code)).size,83);
 assert.equal(docs.filter(d=>d.proposal_url).length,35);
 assert.equal(docs[0].source_row,2);assert.equal(docs[82].source_row,84);
});
test('duplicate or missing code and changed header fail closed',()=>{
 const duplicate=fixture();duplicate[2][0]=duplicate[1][0];
 assert.throws(()=>normalizeSheet(duplicate),/duplicado/i);
 const short=fixture().slice(0,83);assert.throws(()=>normalizeSheet(short),/83 documentos/);
 const header=fixture();header[0][24]='Estado distinto';assert.throws(()=>normalizeSheet(header),/Encabezado/);
});
test('QA delta is not full compliance and observations take precedence',()=>{
 assert.equal(qaCategory('QA A11 OBSERVADO NO BLOQUEANTE'),'observado');
 assert.equal(qaCategory('QA A11 DELTA CONFORME LIMITADO 3/3'),'conforme_delta');
 assert.equal(qaCategory('QA INTEGRAL CONFORME'),'conforme_integral');
 assert.equal(qaCategory('PROPUESTA_EDITABLE_PARCIAL | QA PENDIENTE'),'pendiente');
});
test('only secure Google links pass through',()=>{
 assert.equal(safeGoogleUrl('javascript:alert(1)'),'');
 assert.equal(safeGoogleUrl('https://evil.google.com/file'),'');
 assert.equal(safeGoogleUrl('https://docs.google.com/document/d/abc/edit'),'https://docs.google.com/document/d/abc/edit');
 const doc=normalizeSheet(fixture())[0];const pub=toPublic({...doc,version:1,changed_at:'2026-11-19T10:00:00Z'});
 assert.equal(pub.proposal_url,doc.proposal_url);assert.equal(pub.qa_category,'pendiente');
 assert.equal(pub.technical_opinion_present,false);assert.ok(!('raw_cells' in pub));assert.ok(!('snapshot' in pub));
});
