import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {reconcileV13,loadSnapshot,loadDetail} from '../api/report-v13.js';
import {filterReport,summarizeReport,INCREMENTAL} from '../src/report-v13-model.js';
import {buildV13Xlsx,buildV13Pptx} from '../src/report-v13-export.js';

function fixture(){
 const details=[
  ['INCREMENTAL_EVALUACION_USUARIO',122],
  ['ALCANCE_SDO',94],['ALCANCE_BRECHA',2],['DUPLICADO',8],
  ['EXTERNO_O_REFORMULACION',86],['CONFIGURACIONES_Y_AJUSTES',6]
 ];
 const rows=[];let counter=0;
 for(const [cat,count] of details)for(let i=0;i<count;i++){
  counter++;
  const external=cat==='EXTERNO_O_REFORMULACION';
  const hours=cat===INCREMENTAL?(i===121?1447.86:100):0;
  rows.push({request_id:String(counter),code:'REQ'+String(counter).padStart(5,'0'),
   descripcion:'Solicitud original '+counter,especialidad:i%2?'Civil':'Laboral',
   categoria_resumen_v13:cat,categoria_visible_v13:cat,
   subcategoria_funcional_v13:external?(i<52?'Cambio directo en sistema externo: no imputable a EJE':'Reformular como funcionalidad EJE si corresponde, contrastando SDO y brechas'):null,
   horas_pert_incrementales_propuestas:hours,
   requisitos_sdo:'RFU-ADM-03',ampliacion_funcional_analizada:'Detalle original de la nueva propuesta',
   criterio_decision_informe:'Criterio sustentado en el informe',recomendacion_final:'Revisar función'});
 }
 const manager={total_solicitudes:318,codigos_unicos:318,estimaciones_originales_conservadas:175,
  incrementales_evaluacion_usuario:122,horas_pert_incrementales:'13547.860',
  sdo:94,brechas:2,duplicados:8,sistemas_externos_y_reformulacion:86,
  modificacion_sistema_externo:52,reformular_para_eje:34,configuraciones_y_ajustes:6};
 const categories=details.map(([cat,count])=>({categoria_resumen_v13:cat,
  categoria_visible_v13:cat,solicitudes:count,horas_incrementales_propuestas:cat===INCREMENTAL?'13547.860':'0'}));
 const byCode=rows.filter(r=>r.categoria_resumen_v13===INCREMENTAL)
  .map(r=>({codigo:r.code,horas_pert:r.horas_pert_incrementales_propuestas,actividades:5}));
 const phases=[{fase:'BACKEND',actividades:635,horas:'13547.860'}];
 const wbs=[];for(const r of rows.filter(x=>x.categoria_resumen_v13===INCREMENTAL)){
  for(let i=0;i<5;i++)wbs.push({codigo:r.code,codigo_actividad:'ACT'+i,fase:'BACKEND',
   actividad:'Actividad técnica',optimistas:i===0?r.horas_pert_incrementales_propuestas:0,
   mas_probables:i===0?r.horas_pert_incrementales_propuestas:0,
   horas_pert:i===0?r.horas_pert_incrementales_propuestas:0,
   pesimistas:i===0?r.horas_pert_incrementales_propuestas:0});
 }
 for(let i=0;i<25;i++)wbs.push({codigo:rows[0].code,codigo_actividad:'EX'+i,fase:'ANALISIS',horas_pert:0});
 return {rows,manager,categories,byCode,phases,wbs};
}

test('318 solicitudes, seis categorías, 52+34 externos, 122 propuestas y 635 WBS concilian',()=>{
 const f=fixture(),result=reconcileV13(f);
 assert.equal(result.valid,true);assert.equal(result.requests,318);assert.equal(result.proposals,122);
 assert.equal(result.activities,635);assert.equal(result.pert,13547.86);
});
test('inconsistencia en WBS individual impide publicación de indicadores',()=>{
 const f=fixture();f.byCode[0].horas_pert=0;
 assert.throws(()=>reconcileV13(f),/PERT WBS por solicitud/);
});
test('horas en categoría externa no se consideran incrementales',()=>{
 const f=fixture();f.rows.find(x=>x.categoria_resumen_v13==='EXTERNO_O_REFORMULACION').horas_pert_incrementales_propuestas=1;
 assert.throws(()=>reconcileV13(f),/Horas incrementales/);
});
test('filtros y resumen gerencial operan con el mismo universo',()=>{
 const f=fixture();
 const selected=filterReport(f.rows,{category:'ALCANCE_SDO',specialty:'Civil',q:'REQ'});
 assert.ok(selected.length>0&&selected.every(r=>r.categoria_resumen_v13==='ALCANCE_SDO'&&r.especialidad==='Civil'));
 const summary=summarizeReport(f.rows,f.phases);
 assert.equal(summary.incremental,122);assert.equal(summary.nonIncremental,196);
 assert.equal(summary.hours,13547.86);assert.equal(summary.phases[0].activities,635);
});
test('snapshot solo lee las fuentes consolidadas y conserva documentos contextuales',async()=>{
 const f=fixture();let i=0;
 const replies=[[f.manager],f.categories,f.rows,f.phases,f.byCode,[],[],[]];
 const sql=()=>Promise.resolve(replies[i++]);
 const data=await loadSnapshot(sql);
 assert.equal(i,8);assert.equal(data.rows.length,318);assert.equal(data.access,'public_readonly_report');
 assert.equal(data.reconciliation.proposals,122);
});
test('Excel multih hoja incluye 318 solicitudes, 122 incrementales, 635 WBS y metodología',()=>{
 const f=fixture(),workbook=buildV13Xlsx({},f);
 const encoded=new TextDecoder().decode(workbook);
 assert.equal(encoded.slice(0,2),'PK');
 for(const sheet of ['Resumen gerencial','Matriz 318','Incrementales 122','WBS 635','Criterios y método','Trazabilidad documental','Supuestos y riesgos'])assert.ok(encoded.includes(sheet),'Falta '+sheet);
 assert.ok(encoded.includes('worksheets/sheet7.xml'));
 assert.ok(encoded.includes('REQ00001'));
 assert.ok(workbook.byteLength>30000);
});
test('PPTX genera doce diapositivas con resultados V13 y sin reemplazar valores',()=>{
 const f=fixture(),snap={...f,reconciliation:{activities:635}};
 const slides=buildV13Pptx(snap);
 const encoded=new TextDecoder().decode(slides);
 assert.equal(encoded.slice(0,2),'PK');
 assert.ok(encoded.includes('ppt/slides/slide12.xml'));
 assert.ok(encoded.includes('13.547,86'));
 assert.ok(encoded.includes('122'));
});

test('Excel y PPTX del informe contienen XML válido y archivos ZIP íntegros',()=>{
 const f=fixture(),xlsx=buildV13Xlsx({},f),pptx=buildV13Pptx({...f,reconciliation:{activities:635}});
 const python=[
 'import sys,io,zipfile,xml.etree.ElementTree as ET',
 'raw=bytes.fromhex(sys.stdin.read().strip())',
 'z=zipfile.ZipFile(io.BytesIO(raw))',
 'assert z.testzip() is None',
 'names=set(z.namelist())',
 'assert "[Content_Types].xml" in names',
 'for name in names:',
 '    if name.endswith(".xml") or name.endswith(".rels"): ET.fromstring(z.read(name))',
 'if "xl/workbook.xml" in names:',
 '    assert all("xl/worksheets/sheet"+str(i)+".xml" in names for i in range(1,8))',
 'if "ppt/presentation.xml" in names:',
 '    assert all("ppt/slides/slide"+str(i)+".xml" in names for i in range(1,13))',
 'print("OK",len(names))'
 ].join('\n');
 for(const [type,content] of [['XLSX',xlsx],['PPTX',pptx]]){
  const result=spawnSync('python3',['-c',python],{input:Buffer.from(content).toString('hex'),encoding:'utf8',maxBuffer:1024*1024});
  assert.equal(result.status,0,type+': '+(result.stderr||result.stdout));
 }
});
