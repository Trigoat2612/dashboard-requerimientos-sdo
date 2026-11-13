import {zipEntries,download,xml,buildSlideDeck} from './integrated-export.js';
import {INCREMENTAL,formatCount,formatHours,numeric} from './report-v13-model.js';

const date=()=>new Date().toISOString().slice(0,10);
const colName=index=>{let n=index+1,out='';while(n){n--;out=String.fromCharCode(65+n%26)+out;n=Math.floor(n/26)}return out};
const value=x=>x===null||x===undefined?'':typeof x==='object'?JSON.stringify(x):x;
const isNumeric=x=>typeof x==='number'&&Number.isFinite(x);
const sheetXml=(rows,filename)=> {
 const len=rows[0]?.length||1,head=colName(len-1),max=rows.length;
 const lines=rows.map((values,index)=>'<row r="'+(index+1)+'">'+values.map((v,j)=>{
  const id=colName(j)+(index+1);
  if(index>0&&isNumeric(v))return '<c r="'+id+'"><v>'+v+'</v></c>';
  return '<c r="'+id+'"'+(index===0?' s="1"':'')+' t="inlineStr"><is><t xml:space="preserve">'+xml(value(v))+'</t></is></c>';
 }).join('')+'</row>').join('');
 const cols=Array.from({length:len},(_,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+(i===1?52:i===2?38:23)+'" customWidth="1"/>').join('');
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  +'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  +'<sheetViews><sheetView tabSelected="'+(filename===1?'1':'0')+'" workbookViewId="0">'
  +'<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
  +'<cols>'+cols+'</cols><sheetData>'+lines+'</sheetData><autoFilter ref="A1:'+head+max+'"/></worksheet>';
};
const shapeRel=(id,target,type)=>'<Relationship Id="'+id+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/'+type+'" Target="'+target+'"/>';
const wrapRel=x=>'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+x+'</Relationships>';
const styleSheet='<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF153C59"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>';
function makeWorkbook(sheets){
 const types='<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
  +sheets.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>';
 const book='<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
  +sheets.map(([name],i)=>'<sheet name="'+xml(name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>';
 return zipEntries([
  ['[Content_Types].xml',types],['_rels/.rels',wrapRel(shapeRel('rId1','xl/workbook.xml','officeDocument'))],
  ['xl/workbook.xml',book],
  ['xl/_rels/workbook.xml.rels',wrapRel(sheets.map((_,i)=>shapeRel('rId'+(i+1),'worksheets/sheet'+(i+1)+'.xml','worksheet')).join('')+shapeRel('rId'+(sheets.length+1),'styles.xml','styles'))],
  ['xl/styles.xml',styleSheet],
  ...sheets.map(([,rows],i)=>['xl/worksheets/sheet'+(i+1)+'.xml',sheetXml(rows,i+1)])
 ]);
}
const CATEGORY_EXPLANATIONS={
 INCREMENTAL_EVALUACION_USUARIO:['Función o ampliación propuesta para EJE','Comportamiento adicional no cubierto por el alcance base, sujeto a revisión funcional','REQ00157: síntesis asistida de escritos','Propuesta WBS/PERT','Usuario final: confirmar necesidad, alcance y prioridad'],
 ALCANCE_SDO:['Función originalmente exigible por SDO','Equivalencia contractual identificada','REQ00012: desagregación estadística y parametrización','No incrementar bolsa','Softplan: atender obligación y comprobar funcionamiento'],
 ALCANCE_BRECHA:['Función incluida en brecha del alcance','Brecha reconocida dentro de la obligación original','Brecha relacionada en la ficha individual','No incrementar bolsa','Softplan y GTI: atender y verificar su cumplimiento'],
 DUPLICADO:['Comportamiento ya solicitado','Solicitud equivalente a otra identificada','Código maestro registrado en matriz','Contabilizar una sola vez','Consolidar en requisito maestro y evitar costo doble'],
 EXTERNO_O_REFORMULACION:['Modificación a sistema satélite o pedido de reformulación','Intervención externa al EJE o alternativa EJE no delimitada','REQ00613: lógica del sistema REMAJU','Sin horas incrementales EJE en este corte','GTI: gestionar satélite; GSJ: reformular opción EJE si aplica'],
 CONFIGURACIONES_Y_AJUSTES:['Parámetros, configuración o ajuste de función existente','No hay nuevo comportamiento funcional acreditado','Solicitud registrada en esta categoría del corte','No incrementar bolsa','Softplan: revisar ajuste y demostrar configuración requerida']
};
export function buildV13Xlsx(report,exportData){
 const manager=exportData.manager,categories=exportData.categories,all=exportData.rows,wbs=exportData.wbs;
 const proposal=all.filter(r=>r.categoria_resumen_v13===INCREMENTAL);
 if(all.length!==Number(manager.total_solicitudes)||proposal.length!==Number(manager.incrementales_evaluacion_usuario)
  ||wbs.length!==635||Math.abs(wbs.reduce((s,w)=>s+numeric(w.horas_pert),0)-numeric(manager.horas_pert_incrementales))>.015)
  throw Error('Corte inconsistente: se impidió generar un libro con cifras sin conciliar');
 const summary=[
  ['Concepto','Valor','Nota'],
  ['Solicitudes analizadas',manager.total_solicitudes,'Códigos únicos del informe'],
  ['Funcionalidades incrementales propuestas',manager.incrementales_evaluacion_usuario,'Sujetos a evaluación funcional'],
  ['Horas-persona PERT propuestas',numeric(manager.horas_pert_incrementales),'Suma de la WBS de 122 solicitudes'],
  ['Otras solicitudes',Number(manager.total_solicitudes)-Number(manager.incrementales_evaluacion_usuario),'Cinco categorías adicionales'],
  ['Estimaciones técnicas conservadas',manager.estimaciones_originales_conservadas,'Registro histórico, no total de propuestas'],
  ['Actividades WBS incrementales',wbs.length,'635 actividades correspondientes a 122 solicitudes'],
  ['Cambios directos sistema externo',manager.modificacion_sistema_externo,'No suman esfuerzo EJE'],
  ['Reformulaciones sugeridas',manager.reformular_para_eje,'Pendientes de alcance'],
  ['Fecha de exportación',date(),'Corte consolidado vigente'],
  [],['Categoría','Solicitudes','Horas PERT propuestas'],
  ...categories.map(c=>[c.categoria_visible_v13,c.solicitudes,numeric(c.horas_incrementales_propuestas)])
 ];
 const baseCols=['Código','Especialidad','Descripción original','Clasificación institucional','Subcategoría externa',
  'Justificación individual de clasificación','Función originalmente exigible','Incremento funcional propuesto',
  'Fundamento de exclusión','Acción recomendada','Sistema o responsable','SDO relacionados','Brechas relacionadas',
  'Requerimiento maestro','Estado de evaluación usuario final','Estimación técnica existente',
  'Método empleado','Justificación metodológica','Horas O de estudio','Horas M de estudio',
  'Horas PERT incrementales propuestas','Horas P de estudio','Condiciones de evaluación','Observaciones'];
 const row=r=>[r.code,r.especialidad,r.descripcion,r.categoria_visible_v13,r.subcategoria_funcional_v13,
  r.criterio_decision_informe,r.funcion_originalmente_exigible,r.ampliacion_funcional_analizada,
  r.motivo_exclusion_y_recomendacion,r.recomendacion_final,r.responsable_contractual_funcional,r.requisitos_sdo,
  r.brechas_relacionadas,r.requerimiento_maestro,r.estado_evaluacion_usuario_final,r.estado_estimacion,r.metodo_empleado,
  r.justificacion_metodo,r.categoria_resumen_v13===INCREMENTAL?numeric(r.horas_optimistas):'No aplica',
  r.categoria_resumen_v13===INCREMENTAL?numeric(r.horas_mas_probables):'No aplica',
  numeric(r.horas_pert_incrementales_propuestas),r.categoria_resumen_v13===INCREMENTAL?numeric(r.horas_pesimistas):'No aplica',
  r.condiciones_pendientes,r.categoria_resumen_v13===INCREMENTAL?'Propuesta condicionada a evaluación del usuario final':'No imputable a nuevas funcionalidades EJE'];
 const wbsCols=['Solicitud','Especialidad','Actividad WBS','Fase','Descripción actividad','Fundamento incremental',
  'O h','M h','PERT h','P h','Reutilización / componente compartido','Observación / supuestos',
  'Agente estimador','Método / modalidad','Evaluación funcional pendiente','QA histórico'];
 const byCode=new Map(all.map(r=>[r.code,r]));
 const wbsRow=w=>{const r=byCode.get(w.codigo)||{};return [
  w.codigo,r.especialidad,w.codigo_actividad,w.fase,w.actividad,w.fundamento_incremental,
  numeric(w.optimistas),numeric(w.mas_probables),numeric(w.horas_pert),numeric(w.pesimistas),
  w.componente_compartido,w.observacion,w.agente,w.modalidad,w.estado_evaluacion_usuario_final,w.qa
 ]};
 const methods=[['Categoría','Definición','Criterio técnico','Ejemplo','Tratamiento','Acción recomendada'],
  ...categories.map(c=>[c.categoria_visible_v13,...(CATEGORY_EXPLANATIONS[c.categoria_resumen_v13]||Array(5).fill('Ver ficha individual'))]),
  [],['Método','Definición','Tratamiento'],
  ['WBS','Descomposición del trabajo en actividades identificables','Una actividad se cuenta una sola vez'],
  ['PERT','PERT=(O+4×M+P)/6','Se calcula por actividad; solo funciones propuestas'],
  ['Softplan / metodologías documentadas','Consultar documentos metodológicos originales registrados en el inventario','No se infieren productividades ni equivalencias automáticas']];
 const references=[['Solicitud','Categoría','SDO asociados','Brechas relacionadas','Referencia de fuente','Soporte documentado'],
  ...all.map(r=>[r.code,r.categoria_visible_v13,r.requisitos_sdo,r.brechas_relacionadas,
   r.hoja_fuente?String(r.hoja_fuente)+' / fila '+r.fila_fuente:'Sin localizador',JSON.stringify(r.evidencias??[])])];
 const risks=[['Solicitud','Especialidad','Supuestos registrados','Riesgos registrados','Condiciones de usuario final','Método/justificación'],
  ...proposal.map(r=>[r.code,r.especialidad,JSON.stringify(r.supuestos??[]),JSON.stringify(r.riesgos??[]),
    r.condiciones_pendientes,r.justificacion_metodo])];
 return makeWorkbook([
  ['Resumen gerencial',summary],['Matriz 318',[baseCols,...all.map(row)]],
  ['Incrementales 122',[baseCols,...proposal.map(row)]],
  ['WBS 635',[wbsCols,...wbs.map(wbsRow)]],
  ['Criterios y método',methods],['Trazabilidad documental',references],['Supuestos y riesgos',risks]
 ]);
}
export const exportV13Xlsx=(report,all)=>download(buildV13Xlsx(report,all),
  'evaluacion_sdo_318_incrementales_122_'+date()+'.xlsx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

export function buildV13Pptx(report){
 const manager=report.manager,cats=report.categories,rows=report.rows,phases=report.phases;
 const bySpecialty=Object.entries(rows.filter(r=>r.categoria_resumen_v13===INCREMENTAL).reduce((a,r)=>{
  const area=r.especialidad||'Sin especialidad';
  if(!a[area])a[area]={n:0,h:0};
  a[area].n++;a[area].h+=numeric(r.horas_pert_incrementales_propuestas);return a;
 },{})).sort((a,b)=>b[1].h-a[1].h);
 const topPhases=phases.slice(0,9).map(p=>p.fase+': '+formatHours(p.horas)+' ('+p.actividades+' actividades)');
 const pages=[
  ['Evaluación y estimación de funcionalidades EJE No Penal',[
   'PODER JUDICIAL · PROGRAMA EJE NO PENAL','Evaluación técnica de 318 solicitudes funcionales',
   '122 funcionalidades incrementales propuestas','PERT: '+formatHours(manager.horas_pert_incrementales),
   'Propuestas sujetas a evaluación del usuario final','Corte del informe · '+date()]],
  ['Objetivo y alcance técnico',[
   'Identificar propuestas de funcionalidades nuevas del EJE','Diferenciar alcance SDO y brechas originales',
   'Excluir duplicados, ajustes y cambios a sistemas externos','Dimensionar trabajo mediante WBS y tres puntos PERT',
   'Presentar estimaciones sujetas a evaluación funcional']],
  ['Resumen gerencial',['Solicitudes evaluadas: '+manager.total_solicitudes,
   'Propuestas incrementales: '+manager.incrementales_evaluacion_usuario,
   'Otras categorías: '+(manager.total_solicitudes-manager.incrementales_evaluacion_usuario),
   'PERT propuesto: '+formatHours(manager.horas_pert_incrementales),
   'Estimaciones técnicas conservadas: '+manager.estimaciones_originales_conservadas,
   'Actividades WBS: '+report.reconciliation.activities]],
  ['Seis categorías institucionales',...cats.map(c=>[c.categoria_visible_v13+': '+c.solicitudes])],
  ['Funcionamiento de la clasificación',[
   '122 propuestas: evaluar necesidad, alcance y prioridad',
   '94 cubiertas por SDO: exigir prestación original',
   '2 cubiertas por brechas: atender obligación original',
   '8 duplicadas: consolidar en solicitud maestra',
   '86 relacionadas con sistemas externos/reformulación: reformular o derivar',
   '6 configuraciones y ajustes: atención sin nuevas horas']],
  ['Funcionalidades incrementales por especialidad',...bySpecialty.slice(0,8).map(([area,v])=>area+': '+v.n+' propuestas')],
  ['Horas PERT por especialidad',...bySpecialty.slice(0,8).map(([area,v])=>area+': '+formatHours(v.h))],
  ['Distribución de esfuerzo por fase WBS',...topPhases],
  ['Método WBS y PERT',[
   '635 actividades WBS de 122 solicitudes incrementales',
   'Optimista (O): escenario de menor esfuerzo razonable',
   'Más probable (M): esfuerzo habitual técnico',
   'Pesimista (P): escenario de complejidad mayor',
   'PERT=(O+4×M+P)/6 por actividad',
   'Comparar metodología Softplan con fuentes verificables, sin tasas inventadas']],
  ['Sistemas externos, exclusiones y condiciones',[
   '52 cambios directos a satélites: fuera del esfuerzo EJE',
   '34 solicitudes: eventual reformulación funcional para EJE',
   '6 configuraciones y ajustes: sin incremento imputado',
   '8 duplicidades: evitar doble contabilización',
   'Usuario final evaluará las 122 propuestas antes de priorizar']],
  ['Conclusiones técnicas',[
   'La selección de las 122 propuestas procede del corte institucional',
   'PERT incremental propuesto: '+formatHours(manager.horas_pert_incrementales),
   'Suma técnica conciliada de 635 actividades WBS',
   'Las otras 196 solicitudes se clasifican separadamente',
   'Los documentos y referencias permanecen disponibles']],
  ['Recomendaciones',[
   'Usuario final: evaluar necesidad, alcance y prioridad de 122 propuestas',
   'Softplan: atender obligaciones originales SDO y brechas',
   'GTI y responsables de satélites: atender cambios externos',
   'GSJ: reformular solicitudes para EJE cuando corresponda',
   'Equipo técnico: conservar evidencia, WBS y reutilización sin doble cómputo']]
 ].map(([title,...items])=>[title,items.flat()]);
 return buildSlideDeck(pages);
}
export const exportV13Pptx=report=>download(buildV13Pptx(report),
 'informe_gerencial_sdo_incrementales_'+date()+'.pptx',
 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
