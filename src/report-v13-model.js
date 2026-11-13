// Modelo de consulta y presentación exclusivo del informe institucional consolidado.
export const INCREMENTAL='INCREMENTAL_EVALUACION_USUARIO';
export const CATEGORIES=[
 'INCREMENTAL_EVALUACION_USUARIO','ALCANCE_SDO','ALCANCE_BRECHA','DUPLICADO','EXTERNO_O_REFORMULACION','CONFIGURACIONES_Y_AJUSTES'
];
export const asNum=x=>x===null||x===undefined||x===''?null:Number(x);
export const numeric=x=>Number(x??0)||0;
export const formatCount=x=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(numeric(x));
export const formatHours=x=>asNum(x)===null||!Number.isFinite(Number(x))?'Sin dato':
 new Intl.NumberFormat('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(x))+' h';
export const label=(snapshot,id)=>snapshot?.categories?.find(c=>c.categoria_resumen_v13===id)?.categoria_visible_v13||id||'Sin clasificación';
export const isIncremental=r=>r?.categoria_resumen_v13===INCREMENTAL;
export const isOther=r=>r?.categoria_resumen_v13!==INCREMENTAL;
export const noData=x=>x===null||x===undefined||String(x).trim()==='';
export function filterReport(rows=[],filters={}){
 const query=String(filters.q||'').trim().toLocaleLowerCase('es-PE');
 return rows.filter(r=>{
  if(filters.category&&r.categoria_resumen_v13!==filters.category)return false;
  if(filters.specialty&&r.especialidad!==filters.specialty)return false;
  if(filters.onlyIncremental&&!isIncremental(r))return false;
  if(query){
   const searchable=[r.code,r.descripcion,r.especialidad,r.categoria_visible_v13,r.ampliacion_funcional_analizada,
    r.funcion_originalmente_exigible,r.criterio_decision_informe,r.motivo_exclusion_y_recomendacion,
    r.recomendacion_final,r.requisitos_sdo,r.brechas_relacionadas,r.responsable_contractual_funcional].join(' ').toLocaleLowerCase('es-PE');
   if(!searchable.includes(query))return false;
  }
  return true;
 });
}
export function summarizeReport(rows=[],phases=[]){
 const proposals=rows.filter(isIncremental),other=rows.filter(isOther);
 const categories=CATEGORIES.map(id=>({id,count:rows.filter(x=>x.categoria_resumen_v13===id).length}));
 const specialtyCounts=new Map(),specialtyHours=new Map();
 for(const r of proposals){
  const k=r.especialidad||'Sin especialidad';
  specialtyCounts.set(k,(specialtyCounts.get(k)||0)+1);
  specialtyHours.set(k,(specialtyHours.get(k)||0)+numeric(r.horas_pert_incrementales_propuestas));
 }
 return {
  total:rows.length,incremental:proposals.length,nonIncremental:other.length,
  hours:proposals.reduce((s,r)=>s+numeric(r.horas_pert_incrementales_propuestas),0),
  categories, specialties:[...specialtyCounts].map(([name,count])=>({name,count,hours:specialtyHours.get(name)})).sort((a,b)=>b.hours-a.hours),
  phases:phases.map(p=>({phase:p.fase,activities:numeric(p.actividades),hours:numeric(p.horas)})),
  hasFullUniverse:rows.length===318
 };
}
export const sortedReport=(rows,key='code',ascending=true)=>[...rows].sort((a,b)=>{
 const x=key==='hours'?numeric(a.horas_pert_incrementales_propuestas):String(a[key]??'');
 const y=key==='hours'?numeric(b.horas_pert_incrementales_propuestas):String(b[key]??'');
 return (ascending?1:-1)*(typeof x==='number'?x-y:x.localeCompare(y,'es'));
});
export const categoryTone=id=>id===INCREMENTAL?'yes':
 id==='EXTERNO_O_REFORMULACION'?'conditional':'no';
export const csvEscape=v=>{
 // Sólo para salida CSV de respaldo; las exportaciones principales son XLSX OOXML.
 const s=String(v??'');return '"'+s.replaceAll('"','""')+'"';
};
