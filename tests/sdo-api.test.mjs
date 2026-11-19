import test from 'node:test';
import assert from 'node:assert/strict';
import catalogHandler from '../api/sdo-documents.js';
import syncHandler from '../api/sdo-sync.js';
import detailHandler from '../api/sdo-document-detail.js';
import { readMasterSheet } from '../lib/google-sdo-sheet.js';
function response(){
 return {statusCode:200,headers:{},body:null,setHeader(key,val){this.headers[key]=val;return this;},status(n){this.statusCode=n;return this;},json(value){this.body=value;return this;}};
}
test('public catalog accepts GET only',async()=>{
 const res=response();await catalogHandler({method:'POST'},res);
 assert.equal(res.statusCode,405);assert.equal(res.body.error,'Método no permitido');
});
test('sync refuses calls without bearer secret before accessing Neon',async()=>{
 const res=response();await syncHandler({method:'POST',headers:{}},res);
 assert.equal(res.statusCode,403);assert.match(res.body.error,/Autorización/);
});
test('institutional detail refuses unsupported methods',async()=>{
 const res=response();await detailHandler({method:'DELETE'},res);
 assert.equal(res.statusCode,405);
 assert.equal(res.headers['Cache-Control'],'private, no-store, max-age=0');
});
test('Google Sheets reader fails closed when service credentials missing',async()=>{
 let calls=0;
 await assert.rejects(()=>readMasterSheet({},async()=>{calls++;throw Error('Must not fetch');}),/Falta configurar/);
 assert.equal(calls,0);
});
