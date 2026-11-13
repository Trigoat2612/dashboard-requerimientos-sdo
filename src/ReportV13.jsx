import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Activity,BarChart3,BookOpen,CheckCircle2,ChevronLeft,ChevronRight,ClipboardList,Download,ExternalLink,FileText,Filter,Layers,RefreshCw,Search,ShieldCheck} from 'lucide-react';
import {INCREMENTAL,CATEGORIES,filterReport,formatCount,formatHours,numeric,label,isIncremental,categoryTone,sortedReport,summarizeReport} from './report-v13-model.js';
import {exportV13Xlsx,exportV13Pptx} from './report-v13-export.js';
import './integrated-audit.css';
import './report-v13.css';

const endpoint='/api/report-v13';
const colors=['#226f82','#456dab','#8c78b8','#6e9d76','#b58c4c','#c37876'];
const emptyFilters={q:'',category:'',specialty:''};
const compact=x=>x===null||x===undefined||String(x).trim()===''?'No registrado':String(x);
const clip=(s,n=195)=>String(s||'').length>n?String(s).slice(0,n)+'…':String(s||'');
const fmt=n=>formatCount(n);
const num=n=>formatHours(n);
const date=s=>s?new Date(s).toLocaleDateString('es-PE'):'No registrada';
const valueOf=x=>typeof x==='object'?JSON.stringify(x,null,2):compact(x);
const arrayOf=x=>!x?[]:Array.isArray(x)?x:typeof x==='object'?Object.entries(x).map(([k,v])=>({title:k,value:v})):[x];
function Kpi({name,value,sub,tone=''}){return <div className={'ai-metric '+tone}><small>{name}</small><strong>{value}</strong>{sub&&<span>{sub}</span>}</div>}
function Section({title,sub,children}){return <section className="ai-block"><div className="ai-block-header"><h3>{title}</h3>{sub&&<p>{sub}</p>}</div>{children}</section>}
function Chip({category,children}){return <span className={'ai-chip '+categoryTone(category)}>{children}</span>}
function Bar({title,value,max,annotation,color}){return <div className="ai-barline"><div className="ai-bar-label"><span>{title}</span><b>{annotation||fmt(value)}</b></div><div className="ai-track"><div style={{width:(Math.max(0,Math.min(100,100*numeric(value)/Math.max(1,numeric(max)))))+'%',background:color||'#226f82'}}/></div></div>}
function Table({heads,children}){return <div className="ai-tablewrap"><table><thead><tr>{heads.map((h,i)=><th key={i}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>}
function PageBar({total,page,size,onPage}){const pages=Math.max(1,Math.ceil(total/size));return <div className="ai-pagination"><span>{fmt(total)} registros · Página {page} de {pages}</span><div><button disabled={page<=1} onClick={()=>onPage(page-1)}><ChevronLeft size={15}/> Anterior</button><button disabled={page>=pages} onClick={()=>onPage(page+1)}>Siguiente <ChevronRight size={15}/></button></div></div>}
function Reference({title,url,locator,description}){return <div className="ai-ref"><b>{url&&/^https:\/\//.test(url)?<a href={url} target="_blank" rel="noopener noreferrer">{title||url} <ExternalLink size={13}/></a>:title||url||'Referencia sin enlace'}</b>{locator&&<small>Localizador: {locator}</small>}{description&&<p>{description}</p>}</div>}
function Donut({categories,total}){let cur=0;const stops=categories.map((c,i)=>{const from=cur;cur+=100*Number(c.solicitudes||0)/Math.max(1,total);return colors[i]+' '+from+'% '+cur+'%'}).join(',');return <div className="rv-donutwrap"><div className="rv-donut" style={{background:'conic-gradient('+stops+')'}}><div><b>{fmt(total)}</b><span>solicitudes</span></div></div><div className="rv-legend">{categories.map((c,i)=><div key={c.categoria_resumen_v13}><i style={{background:colors[i]}}/><span>{c.categoria_visible_v13}</span><strong>{fmt(c.solicitudes)}</strong></div>)}</div></div>}
function Toolbar({filters,setFilters,rows,report,category=true}){
 const areas=[...new Set(rows.map(r=>r.especialidad).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
 const set=(k,v)=>setFilters(p=>({...p,[k]:v}));
 return <div className="rv-toolbar">
  <label className="rv-search"><Search size={17}/><input value={filters.q} onChange={e=>set('q',e.target.value)} placeholder="Buscar código, texto, especialidad, SDO o fundamento…"/></label>
  {category&&<label>Clasificación<select value={filters.category} onChange={e=>set('category',e.target.value)}><option value="">Todas las categorías</option>{report.categories.map(c=><option key={c.categoria_resumen_v13} value={c.categoria_resumen_v13}>{c.categoria_visible_v13}</option>)}</select></label>}
  <label>Especialidad<select value={filters.specialty} onChange={e=>set('specialty',e.target.value)}><option value="">Todas las especialidades</option>{areas.map(a=><option key={a} value={a}>{a}</option>)}</select></label>
  <button className="ai-btn secondary" onClick={()=>setFilters({...emptyFilters})}>Limpiar filtros</button>
 </div>;
}
function Summary({report,onOpen,onNavigate}){
 const {manager,categories,rows,phases}=report;
 const summary=summarizeReport(rows,phases),top=summary.specialties;
 const maxH=Math.max(1,...top.map(x=>x.hours));
 const main=categories.find(x=>x.categoria_resumen_v13===INCREMENTAL);
 const pct=100*Number(main?.solicitudes||0)/Math.max(1,Number(manager.total_solicitudes));
 const maxPhase=Math.max(1,...phases.map(x=>numeric(x.horas)));
 const actions=[
  ['Alcance original','Las funcionalidades comprendidas en SDO y brechas se atienden mediante las prestaciones originales, sin estimarlas nuevamente.'],
  ['Nuevas propuestas','Las 122 funcionalidades incrementales se someten a evaluación del usuario final para confirmar su necesidad, alcance y prioridad.'],
  ['Sistemas externos','Las 52 intervenciones directas corresponden a los responsables de esos sistemas; las otras 34 requieren posible reformulación para EJE.'],
  ['Estimación técnica','Las 13.547,86 horas-persona provienen de actividades WBS/PERT del corte consolidado; no constituyen una autorización de ejecución.']
 ];
 return <div className="ai-flow">
  <div className="rv-hero"><div className="rv-hero-head"><span>RESUMEN GERENCIAL</span><h2>Evaluación funcional y estimación de nuevos desarrollos</h2><p>Programa EJE No Penal · Resultados consolidados para evaluación y priorización funcional.</p></div><div className="rv-hero-stats"><div><strong>{fmt(manager.incrementales_evaluacion_usuario)}</strong><span>Funcionalidades propuestas</span></div><div><strong>{num(manager.horas_pert_incrementales)}</strong><span>Esfuerzo WBS/PERT propuesto</span></div></div></div>
  <div className="ai-metrics">
    <Kpi name="Solicitudes analizadas" value={fmt(manager.total_solicitudes)} sub="Clasificación individual consolidada"/>
    <Kpi name="Incrementales propuestas" value={fmt(manager.incrementales_evaluacion_usuario)} tone="primary" sub="Sujetas a evaluación del usuario final"/>
    <Kpi name="Horas-persona WBS/PERT" value={num(manager.horas_pert_incrementales)} tone="primary" sub="Estimación técnica propuesta"/>
    <Kpi name="Otras categorías" value={fmt(manager.total_solicitudes-manager.incrementales_evaluacion_usuario)} sub="Alcance original, externo, duplicados y ajustes"/>
    <Kpi name="Estimaciones realizadas" value={fmt(manager.estimaciones_originales_conservadas)} sub="Conservadas como evidencia técnica"/>
    <Kpi name="Actividades WBS propuestas" value={fmt(report.reconciliation.activities)} sub="Asociadas a 122 solicitudes"/>
  </div>
  <div className="ai-columns">
   <Section title="Distribución de las seis clasificaciones" sub="Las denominaciones y cantidades proceden del corte consolidado."><Donut categories={categories} total={manager.total_solicitudes}/></Section>
   <Section title="Funcionalidades propuestas frente a otras" sub="Participación de las nuevas funcionalidades en las 318 solicitudes.">
     <div className="rv-binary"><div><b>{fmt(main?.solicitudes)}</b><span>Incrementales propuestas</span></div><div><b>{fmt(manager.total_solicitudes-main?.solicitudes)}</b><span>Otras categorías</span></div></div>
     <div className="rv-stacked"><span style={{width:pct+'%'}}/></div><div className="rv-micro">{pct.toFixed(1).replace('.',',')} % de las solicitudes fueron clasificadas como incrementales propuestas</div>
     <div className="rv-note">La categoría incremental requiere evaluación del usuario final; las demás no aportan horas incrementales en este informe.</div>
   </Section>
   <Section title="Propuestas por especialidad" sub="Número de funcionalidades incrementales en cada especialidad.">
     {top.map((x,i)=><Bar key={x.name} title={x.name} value={x.count} max={Math.max(1,...top.map(x=>x.count))} color={colors[i%colors.length]}/>)}
   </Section>
   <Section title="Esfuerzo PERT por especialidad" sub="Horas-persona por especialidad, calculadas desde las propuestas individuales.">
     {top.map((x,i)=><Bar key={x.name} title={x.name} value={x.hours} max={maxH} annotation={num(x.hours)} color={colors[i%colors.length]}/>)}
   </Section>
   <Section title="Esfuerzo por fase WBS" sub="Fases registradas, sin mezclar horas de solicitudes no incrementales.">
     {phases.slice(0,10).map((p,i)=><Bar key={p.fase} title={p.fase+' · '+p.actividades+' actividades'} value={p.horas} max={maxPhase} annotation={num(p.horas)} color={colors[i%colors.length]}/>)}
     <p className="ai-note">Se muestran las diez fases con más horas. La sección Metodología permite consultar la distribución completa.</p>
   </Section>
   <Section title="Tratamiento del grupo de sistemas externos" sub="Las 86 solicitudes no se convierten en 86 desarrollos incrementales del EJE.">
    <div className="rv-binary"><div><b>{fmt(manager.modificacion_sistema_externo)}</b><span>Cambios directos a sistemas externos</span></div><div><b>{fmt(manager.reformular_para_eje)}</b><span>Alternativas sujetas a reformulación</span></div></div>
    <p className="rv-prose">Cuando se requiere modificar directamente SIJ, REMAJU, SERNOT u otro sistema satélite, corresponde gestionarlo con el responsable respectivo. Una alternativa dentro del EJE debe formularse y contrastarse con las obligaciones originalmente previstas.</p>
   </Section>
  </div>
  <Section title="Conclusiones y acciones de tratamiento" sub="Síntesis de las decisiones funcionales del análisis consolidado.">
   <div className="ai-four">{actions.map(([title,body])=><div key={title}><b>{title}</b><p>{body}</p></div>)}</div>
  </Section>
  <div className="ai-actions"><button className="ai-btn primary" onClick={()=>onNavigate('incrementales')}>Explorar las 122 propuestas <ChevronRight size={17}/></button><button className="ai-btn secondary" onClick={()=>onNavigate('matriz318')}>Revisar clasificación individual</button></div>
 </div>;
}

function Matrix({report,openDetail}){
 const [filters,setFilters]=useState(emptyFilters),[sort,setSort]=useState('code'),[reverse,setReverse]=useState(false),[page,setPage]=useState(1),size=25;
 const rows=useMemo(()=>sortedReport(filterReport(report.rows,filters),sort,!reverse),[report,filters,sort,reverse]);
 useEffect(()=>setPage(1),[filters,sort,reverse]);
 return <div className="ai-flow">
  <div className="rv-intro"><b>318 solicitudes con clasificación individual</b><span>Fundamento y recomendación registrados para cada código. Las horas propuestas se muestran exclusivamente para las funcionalidades incrementales.</span></div>
  <Toolbar filters={filters} setFilters={setFilters} rows={report.rows} report={report}/>
  <div className="ai-toolbar"><span><Filter size={15}/> {fmt(rows.length)} de {fmt(report.rows.length)} solicitudes</span><div><select className="rv-order" value={sort} onChange={e=>setSort(e.target.value)}><option value="code">Código</option><option value="especialidad">Especialidad</option><option value="categoria_visible_v13">Clasificación</option><option value="hours">PERT propuesto</option></select><button className="ai-btn secondary" onClick={()=>setReverse(x=>!x)}>{reverse?'Descendente':'Ascendente'}</button></div></div>
  <Table heads={['Código','Especialidad','Solicitud y descripción','Clasificación','Justificación y criterio','SDO / brecha','Componente / sistema','Estimación existente','PERT propuesto','Usuario final','Acción recomendada','Detalle']}>
  {rows.slice((page-1)*size,page*size).map(r=><tr key={r.code}>
   <td><strong>{r.code}</strong><small>{r.hoja_fuente} · {r.fila_fuente}</small></td>
   <td>{compact(r.especialidad)}</td><td className="ai-long">{r.descripcion}</td>
   <td><Chip category={r.categoria_resumen_v13}>{r.categoria_visible_v13}</Chip><small>{r.subcategoria_funcional_v13}</small></td>
   <td className="ai-long">{clip(r.motivo_exclusion_y_recomendacion||r.justificacion_metodo||r.criterio_decision_informe,310)}</td>
   <td><small>SDO: {r.requisitos_sdo||'No identificado'}</small><small>Brechas: {r.brechas_relacionadas||'No identificadas'}</small></td>
   <td>{compact(r.responsable_contractual_funcional)}</td>
   <td>{compact(r.estado_estimacion)}<small>{r.estimacion_id?'Ref. '+r.estimacion_id:''}</small></td>
   <td className="ai-num"><strong>{num(r.horas_pert_incrementales_propuestas)}</strong></td>
   <td>{isIncremental(r)?<span className="rv-pending">Pendiente de evaluación</span>:'No aplica'}</td>
   <td className="ai-long">{clip(r.recomendacion_final||r.criterio_decision_informe,240)}</td>
   <td><button className="ai-btn small" onClick={()=>openDetail(r.code)}>Abrir ficha <ChevronRight size={14}/></button></td>
  </tr>)}</Table>
  <PageBar total={rows.length} page={page} size={size} onPage={setPage}/>
 </div>;
}
function Incrementals({report,openDetail}){
 const [filters,setFilters]=useState(emptyFilters),[page,setPage]=useState(1),[expanded,setExpanded]=useState({}),[tasks,setTasks]=useState(null),[loadingTasks,setLoadingTasks]=useState(false),[taskError,setTaskError]=useState('');
 const records=useMemo(()=>filterReport(report.rows.filter(isIncremental),filters),[report,filters]);
 useEffect(()=>setPage(1),[filters]);
 const loadTasks=async()=>{
  if(tasks||loadingTasks)return tasks;
  setLoadingTasks(true);setTaskError('');
  try{
   const res=await fetch(endpoint+'?view=wbs',{cache:'no-store'}),obj=await res.json();
   if(!res.ok||obj.access!=='public_readonly_report'||obj.rows?.length!==report.reconciliation.activities)throw Error('La WBS consultada no concilia con el corte institucional');
   const group=new Map();
   for(const w of obj.rows){if(!group.has(w.codigo))group.set(w.codigo,[]);group.get(w.codigo).push(w)}
   if(group.size!==report.manager.incrementales_evaluacion_usuario||Math.abs(obj.rows.reduce((s,w)=>s+numeric(w.horas_pert),0)-numeric(report.manager.horas_pert_incrementales))>.015)throw Error('La suma de actividades WBS no concilia');
   setTasks(group);return group;
  }catch(e){setTaskError(e.message);return null}finally{setLoadingTasks(false)}
 };
 const toggle=async code=>{if(expanded[code]){setExpanded(s=>({...s,[code]:false}));return}const available=await loadTasks();if(available)setExpanded(s=>({...s,[code]:true}))};
 const total=records.reduce((s,r)=>s+numeric(r.horas_pert_incrementales_propuestas),0),size=20;
 return <div className="ai-flow">
  <div className="rv-intro"><b>Funcionalidades incrementales propuestas para evaluación del usuario final</b><span>Las horas WBS/PERT representan escenarios de esfuerzo por requerimiento. La confirmación de necesidad, alcance y prioridad corresponde al usuario final.</span></div>
  <div className="ai-metrics">
   <Kpi name="Propuestas en esta selección" value={fmt(records.length)} sub="De 122 propuestas originales"/>
   <Kpi name="PERT de la selección" value={num(total)} tone="primary" sub="No incluye SDO, brechas ni sistemas externos"/>
   <Kpi name="Actividades WBS del universo" value={fmt(report.reconciliation.activities)} sub="635 actividades conciliadas"/>
   <Kpi name="Evaluación funcional" value="Pendiente" sub="Confirmación de necesidad, alcance y prioridad"/>
  </div>
  <Toolbar filters={filters} setFilters={setFilters} rows={report.rows.filter(isIncremental)} report={report} category={false}/>
  {taskError&&<div className="ai-error">{taskError}</div>}
  <Table heads={['Solicitud','Especialidad','Incremento funcional propuesto','Estimación / método','O h','M h','PERT h','P h','Componente y reutilización','Evaluación del usuario final','Ficha WBS']}>
  {records.slice((page-1)*size,page*size).map(r=><React.Fragment key={r.code}>
    <tr><td><b>{r.code}</b></td><td>{r.especialidad}</td>
     <td className="ai-long">{clip(r.ampliacion_funcional_analizada||r.descripcion,360)}</td>
     <td>{r.estado_estimacion}<small>{r.metodo_empleado}</small></td>
     <td className="ai-num">{num(r.horas_optimistas)}</td><td className="ai-num">{num(r.horas_mas_probables)}</td>
     <td className="ai-num"><b>{num(r.horas_pert_incrementales_propuestas)}</b></td><td className="ai-num">{num(r.horas_pesimistas)}</td>
     <td className="ai-long">{clip(r.justificacion_metodo,230)}</td>
     <td><span className="rv-pending">Sujeta a evaluación</span><small>{clip(r.condiciones_pendientes,120)}</small></td>
     <td><button className="ai-btn small" disabled={loadingTasks} onClick={()=>toggle(r.code)}>{expanded[r.code]?'Ocultar WBS':'Ver actividades'}</button><button className="ai-link" onClick={()=>openDetail(r.code)}>Ficha completa</button></td>
    </tr>
    {expanded[r.code]&&<tr className="rv-expand"><td colSpan={11}>
      <div className="rv-wbs"><h4>Actividades WBS · {r.code}</h4>
       {(tasks?.get(r.code)||[]).map((w,i)=><div className="rv-wbsline" key={w.codigo_actividad+i}><div><strong>{w.codigo_actividad} · {w.fase}</strong><p>{w.actividad}</p><small>Reutilización: {w.componente_compartido||'No identificada'} · {w.fundamento_incremental}</small></div><b>{num(w.horas_pert)}</b></div>)}
       <p className="rv-note">Total propuesto: <b>{num(r.horas_pert_incrementales_propuestas)}</b>. PERT = (O + 4M + P) / 6.</p>
      </div></td></tr>}
   </React.Fragment>)}</Table>
  <PageBar total={records.length} page={page} size={size} onPage={setPage}/>
 </div>;
}
function Criteria({report,openDetail,onNavigate}){
 const example=code=>report.rows.find(r=>r.categoria_resumen_v13===code);
 const definitions={
  INCREMENTAL_EVALUACION_USUARIO:['Función o ampliación que se propone incorporar al EJE','Se identifica un comportamiento adicional que debe contrastarse con SDO y brechas','Somete a evaluación del usuario final','Usuario final: confirmar necesidad, alcance y prioridad'],
  ALCANCE_SDO:['Funcionalidad comprendida en los requerimientos originales SDO','Existe correspondencia documentada con una obligación inicialmente prevista','No incrementar bolsa; verificar implementación','Softplan: atender el alcance original'],
  ALCANCE_BRECHA:['Funcionalidad asociada a brechas del alcance original','La brecha forma parte de los compromisos funcionales existentes','No incrementar bolsa; atender la brecha','Responsable contractual: resolver y validar'],
  DUPLICADO:['Solicitud cuya función ya está representada por otra','Existe requerimiento maestro o función equivalente identificada','Evitar doble conteo','Consolidar y asociar a la solicitud principal'],
  EXTERNO_O_REFORMULACION:['Cambio directo a satélite o alternativa para el EJE por delimitar','52 cambios directos externos y 34 reformulaciones posibles','Fuera de horas EJE mientras no exista nueva propuesta definida','GTI/GSJ: gestionar sistema externo o reformular'],
  CONFIGURACIONES_Y_AJUSTES:['Ajuste o parametrización sobre una funcionalidad contratada','No se identifica funcionalidad incremental propia','Resolver sin sumar horas incrementales','Verificar configuración y ajuste con responsable']
 };
 const methods=report.methods||[];
 const namedSources=methods.filter(x=>x.supplier_proposed);
 const rawPhase=report.phases;
 return <div className="ai-flow">
  <Section title="Criterios técnicos de clasificación" sub="Cada clasificación se apoya en la justificación y documentos de la solicitud; los ejemplos se obtienen de la matriz consolidada.">
   <Table heads={['Categoría','Definición','Criterio de decisión','Ejemplo concreto','Tratamiento','Acción recomendada']}>
   {report.categories.map(c=>{const d=definitions[c.categoria_resumen_v13]||[];const x=example(c.categoria_resumen_v13);
    return <tr key={c.categoria_resumen_v13}><td><Chip category={c.categoria_resumen_v13}>{c.categoria_visible_v13}</Chip><small>{c.solicitudes} solicitudes</small></td>
      <td className="ai-long">{d[0]}</td><td className="ai-long">{d[1]}</td>
      <td><button className="ai-link" onClick={()=>openDetail(x.code)}>{x.code}</button><small>{clip(x.descripcion,140)}</small></td>
      <td>{d[2]}</td><td>{d[3]}</td>
    </tr>})}</Table>
  </Section>
  <Section title="Metodología WBS / PERT" sub="La estimación descompone el desarrollo adicional en actividades con tres escenarios de esfuerzo.">
   <div className="rv-formula"><strong>PERT = (O + 4 × M + P) / 6</strong><span>O: optimista · M: más probable · P: pesimista · Unidad: horas-persona</span></div>
   <p className="rv-prose">El esfuerzo esperado se calcula por actividad WBS y luego se suma por requerimiento. Las actividades identifican análisis, diseño, desarrollo, integración, pruebas, documentación y despliegue según lo realmente registrado. Los componentes reutilizados no deben presupuestarse dos veces.</p>
   <div className="ai-mini-metrics"><Kpi name="Actividades WBS" value={fmt(report.reconciliation.activities)}/><Kpi name="Funcionalidades" value={fmt(report.manager.incrementales_evaluacion_usuario)}/><Kpi name="PERT propuesto" value={num(report.manager.horas_pert_incrementales)}/><Kpi name="Evaluación funcional" value="Pendiente"/></div>
   <Table heads={['Fase WBS registrada','Actividades','Horas PERT']}>
   {rawPhase.map(p=><tr key={p.fase}><td>{p.fase}</td><td>{fmt(p.actividades)}</td><td className="ai-num">{num(p.horas)}</td></tr>)}</Table>
  </Section>
  <Section title="Comparación con métodos documentados del proveedor" sub="Las técnicas se contrastan según su ámbito; ninguna invalida a otra por sí sola y no se aplican tasas inventadas.">
   <Table heads={['Método documentado','Enfoque y alcance','Fortalezas','Precauciones','Tratamiento técnico','Documento de referencia']}>
   {methods.map(m=><tr key={m.name}><td><b>{m.name}</b><small>{m.supplier_proposed?'Método del proveedor':'Método de referencia'}</small></td>
    <td className="ai-long">{m.description}</td><td>{m.strengths}</td><td>{m.risks}</td><td>{m.decision}</td>
    <td>{/^https:\/\//.test(m.source_document_id||'')?<a href={m.source_document_id} target="_blank" rel="noopener noreferrer">Abrir documento <ExternalLink size={13}/></a>:compact(m.source_document_id)}</td></tr>)}</Table>
   {!namedSources.length&&<p className="ai-note">No hay método marcado explícitamente como propuesta del proveedor en el inventario. Se muestra lo que consta documentalmente, sin inferir equivalencias.</p>}
  </Section>
  <Section title="Condición de evaluación del usuario final" sub="La clasificación y el esfuerzo son propuestas técnicas, no una decisión automática de implementación.">
   <p className="rv-prose">Antes de comprometer un desarrollo incremental, el usuario final debe evaluar pertinencia, necesidad, alcance funcional, casos de uso y prioridad. Cuando la solicitud implique un sistema externo, corresponde distinguir la modificación directa del satélite de una funcionalidad que pueda reformularse dentro del EJE No Penal.</p>
   <button className="ai-btn primary" onClick={()=>onNavigate('incrementales')}>Examinar propuestas y sus supuestos <ChevronRight size={16}/></button>
  </Section>
 </div>;
}
function Obligations({report,openDetail}){
 const [search,setSearch]=useState(''),[page,setPage]=useState(1),size=30;
 const rows=report.rows.filter(r=>['ALCANCE_SDO','ALCANCE_BRECHA'].includes(r.categoria_resumen_v13)&&[r.code,r.descripcion,r.requisitos_sdo,r.brechas_relacionadas].join(' ').toLowerCase().includes(search.toLowerCase()));
 return <Section title="Funcionalidades comprendidas en obligaciones originales" sub="Se separa el alcance originalmente exigible de la evidencia de funcionamiento real.">
  <div className="rv-intro"><b>{fmt(rows.length)} solicitudes bajo cobertura contractual identificada</b><span>Las obligaciones originales corresponden a las categorías SDO y brechas; no incluyen automáticamente solicitudes externas.</span></div>
  <div className="ai-inline"><input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="Buscar código, requisito SDO o brecha…"/></div>
  <Table heads={['Solicitud','Clasificación','Funcionalidad','Referencias SDO','Brechas','Cobertura original y fundamento','Acción','Horas incrementales']}>
  {rows.slice((page-1)*size,page*size).map(r=><tr key={r.code}><td><button className="ai-link" onClick={()=>openDetail(r.code)}>{r.code}</button></td><td>{r.categoria_visible_v13}</td><td className="ai-long">{r.descripcion}</td><td>{r.requisitos_sdo||'No especificado'}</td>
   <td>{r.brechas_relacionadas||'No especificado'}</td><td className="ai-long">{clip(r.funcion_originalmente_exigible||r.motivo_exclusion_y_recomendacion,420)}</td><td>{r.recomendacion_final||r.criterio_decision_informe}</td><td><b>0 h</b></td></tr>)}</Table><PageBar page={page} onPage={setPage} size={size} total={rows.length}/>
 </Section>;
}
function Exclusions({report,openDetail}){
 const [filters,setFilters]=useState({...emptyFilters,category:''}),[page,setPage]=useState(1),size=25;
 const all=report.rows.filter(r=>!isIncremental(r)),rows=filterReport(all,filters);
 useEffect(()=>setPage(1),[filters]);
 return <div className="ai-flow"><div className="rv-intro"><b>{fmt(all.length)} solicitudes clasificadas en otras categorías</b><span>Las 86 relacionadas con sistemas externos mantienen su desglose: 52 cambios directos y 34 solicitudes para eventual reformulación.</span></div>
 <Toolbar rows={all} filters={filters} setFilters={setFilters} report={report}/>
 <Table heads={['Solicitud','Clasificación','Caso particular','Sistema afectado','Motivo individual de exclusión','Recomendación','Horas incrementales','Detalle']}>
 {rows.slice((page-1)*size,page*size).map(r=><tr key={r.code}><td><b>{r.code}</b></td><td><Chip category={r.categoria_resumen_v13}>{r.categoria_visible_v13}</Chip></td>
  <td>{r.subcategoria_funcional_v13||'No aplica'}</td><td>{r.responsable_contractual_funcional||'No identificado'}</td>
  <td className="ai-long">{clip(r.motivo_exclusion_y_recomendacion||r.funcion_originalmente_exigible,440)}</td><td className="ai-long">{r.recomendacion_final||r.criterio_decision_informe}</td><td className="ai-num">0 h</td>
  <td><button className="ai-btn small" onClick={()=>openDetail(r.code)}>Ficha</button></td></tr>)}</Table><PageBar page={page} size={size} total={rows.length} onPage={setPage}/>
 </div>;
}
function Gaps({report,onNavigate,openDetail}){
 const [text,setText]=useState(''),[page,setPage]=useState(1),size=35;
 const rows=report.gaps.filter(x=>[x.id,x.gap_code,x.sdo_code,x.description,x.source_final_status].join(' ').toLowerCase().includes(text.toLowerCase()));
 return <Section title="Brechas Laboral y referencias originales" sub="La fuente documental se mantiene separada del universo de 318 solicitudes y de su clasificación institucional.">
 <div className="ai-inline"><input value={text} onChange={e=>{setText(e.target.value);setPage(1)}} placeholder="Filtrar brecha, SDO o descripción…"/><span>{fmt(rows.length)} registros</span></div>
 <Table heads={['Brecha','Requisito SDO','Descripción original','Estado de fuente','Solicitud vinculada']}>
 {rows.slice((page-1)*size,page*size).map(x=><tr key={x.id}><td>#{x.id} · {x.gap_code}</td><td>{x.sdo_code?<button className="ai-link" onClick={()=>onNavigate('sdo',x.sdo_code,{kind:'sdo',id:x.sdo_code})}>{x.sdo_code}</button>:'Sin código'}</td>
  <td className="ai-long">{x.description}</td><td>{x.source_final_status||'Sin registro'}</td>
  <td>{x.request_code&&/^REQ\d{5,7}$/.test(x.request_code)?<button className="ai-link" onClick={()=>openDetail(x.request_code)}>{x.request_code}</button>:x.request_code||'Sin vínculo'}</td></tr>)}</Table><PageBar page={page} size={size} total={rows.length} onPage={setPage}/>
 </Section>;
}
function Detail({code,onBack,onNavigate}){
 const [data,setData]=useState({pending:true,error:'',value:null});
 useEffect(()=>{let live=true;setData({pending:true,error:'',value:null});
  fetch(endpoint+'?view=detail&code='+encodeURIComponent(code),{cache:'no-store'})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo abrir la ficha');return d})
   .then(value=>{if(live)setData({pending:false,error:'',value})})
   .catch(e=>{if(live)setData({pending:false,error:e.message,value:null})});
  return()=>{live=false};
 },[code]);
 const d=data.value,r=d?.record,wbs=d?.wbs||[];
 return <div className="ai-flow">
  <div className="ai-detailhead"><button className="ai-btn secondary" onClick={onBack}><ChevronLeft size={16}/> Volver</button><h2>{code} · Ficha de análisis funcional</h2></div>
  {data.pending&&<div className="ai-loading">Recuperando análisis, metodología y referencias desde Neon…</div>}
  {data.error&&<div className="ai-error">{data.error}</div>}
  {d&&<>
   <Section title="1. Solicitud original" sub="Descripción y procedencia de la matriz consolidada.">
    <p className="ai-prose">{r.descripcion}</p><div className="ai-facts"><span>Código: <b>{r.code}</b></span><span>Especialidad: <b>{r.especialidad}</b></span><span>Origen: <b>{r.hoja_fuente} · fila {r.fila_fuente}</b></span><span>Lote: <b>{r.lote}</b></span></div>
   </Section>
   <Section title="2. Clasificación y fundamento individual" sub="No se sustituye el fundamento registrado por una explicación genérica.">
    <Chip category={r.categoria_resumen_v13}>{r.categoria_visible_v13}</Chip>
    {r.subcategoria_funcional_v13&&<p><b>Detalle de clasificación:</b> {r.subcategoria_funcional_v13}</p>}
    <p><b>Comportamiento originalmente exigible:</b> {compact(r.funcion_originalmente_exigible)}</p>
    <p><b>Funcionalidad o comportamiento adicional:</b> {compact(r.ampliacion_funcional_analizada)}</p>
    <p><b>Fundamento y motivo individual:</b> {compact(r.motivo_exclusion_y_recomendacion)}</p>
    <p><b>Criterio de decisión registrado:</b> {compact(r.criterio_decision_informe)}</p>
    <p><b>Responsable y sistema:</b> {compact(r.responsable_contractual_funcional)}</p>
    <p><b>Solicitud maestra cuando aplica:</b> {compact(r.requerimiento_maestro)}</p>
    <p><b>Acción recomendada:</b> {compact(r.recomendacion_final)}</p>
   </Section>
   <Section title="3. Alcance de estimación y evaluación" sub="Las horas presentadas pertenecen exclusivamente a las 122 propuestas que figuran en el corte institucional.">
    <div className="ai-mini-metrics"><Kpi name="PERT incremental propuesto" value={num(r.horas_pert_incrementales_propuestas)} tone={isIncremental(r)?'primary':''}/>
     <Kpi name="Actividades WBS" value={isIncremental(r)?fmt(d.totals?.activities):'No aplica'}/>
     <Kpi name="Estado de evaluación" value={isIncremental(r)?'Pendiente':'No aplica'}/>
     <Kpi name="Método técnico" value={isIncremental(r)?'WBS / PERT':'Sin incremento'}/></div>
    {isIncremental(r)?<>
     <p><b>Justificación metodológica individual:</b> {compact(r.justificacion_metodo)}</p>
     <p><b>Condiciones para evaluación por usuario final:</b> {compact(r.condiciones_pendientes)}</p>
     <p><b>Alcance, supuestos y fuentes:</b> {compact(r.ampliacion_funcional_analizada)}</p>
     <p><b>Nota:</b> el usuario final debe confirmar la necesidad, delimitar el alcance y priorizar la solicitud.</p>
     <div className="rv-formula">PERT = (O + 4 × M + P) / 6</div>
     <div className="ai-mini-metrics"><Kpi name="Optimista (O)" value={num(d.totals?.o)}/><Kpi name="Más probable (M)" value={num(d.totals?.m)}/><Kpi name="Esperado PERT" value={num(d.totals?.pert)} tone="primary"/><Kpi name="Pesimista (P)" value={num(d.totals?.p)}/></div>
    </>:<div className="rv-note">Esta solicitud no se incluye como nuevo desarrollo EJE. Se conserva la justificación y recomendación, sin trasladar horas preliminares al indicador incremental.</div>}
   </Section>
   {isIncremental(r)&&<Section title="4. Desglose WBS / PERT por actividad" sub="Actividades técnicas reales vinculadas al código y conciliadas con la estimación de la solicitud.">
    <Table heads={['Código','Fase','Actividad','Justificación incremental','O h','M h','PERT h','P h','Reutilización / componente','Supuestos y notas']}>
     {wbs.map((w,i)=><tr key={i}><td><b>{w.codigo_actividad}</b></td><td>{w.fase}</td><td className="ai-long">{w.actividad}</td>
      <td className="ai-long">{w.fundamento_incremental}</td><td className="ai-num">{num(w.optimistas)}</td><td className="ai-num">{num(w.mas_probables)}</td>
      <td className="ai-num"><b>{num(w.horas_pert)}</b></td><td className="ai-num">{num(w.pesimistas)}</td>
      <td>{w.componente_compartido||'No identificado'}</td><td className="ai-long">{w.observacion}</td></tr>)}
    </Table>
    <div className="rv-note"><b>Total PERT conciliado de {code}: {num(d.totals?.pert)}</b> · {wbs.length} actividades.</div>
   </Section>}
   <Section title="5. Contraste contractual SDO y brechas" sub="Referencias originales con descripción y vínculo documental cuando exista.">
    <p><b>Códigos SDO indicados en la matriz:</b> {compact(r.requisitos_sdo)}</p>
    <p><b>Brechas relacionadas:</b> {compact(r.brechas_relacionadas)}</p>
    {d.sdoLinks.map((s,i)=><div className="ai-ref" key={i}><button className="ai-link" onClick={()=>onNavigate('sdo',s.code,{kind:'sdo',id:s.code})}>{s.code}</button><p>{s.description||s.contractual_basis}</p>{s.document_url&&<a target="_blank" rel="noopener noreferrer" href={s.document_url}>Documento SDO original <ExternalLink size={13}/></a>}</div>)}
    {d.gapLinks.map((g,i)=><div className="ai-ref" key={i}><b>{g.code||'Brecha '+g.id}</b><p>{g.description||g.basis}</p></div>)}
   </Section>
   <Section title="6. Evidencias, referencias y documentos" sub="Los documentos disponibles conservan sus enlaces originales.">
    {(d.sources||[]).map((x,i)=><Reference key={i} title={x.title} url={x.url} locator={x.locator} description={x.claim}/>)}
    {d.evidence.map((x,i)=><div className="ai-ref" key={'e'+i}><b>{x.document_ref||'Fuente documental'}</b><small>Localizador: {x.locator||'No consignado'}</small><p>{x.claim}</p></div>)}
    {arrayOf(r.evidencias).map((x,i)=><pre key={'m'+i} className="rv-evidence">{valueOf(x)}</pre>)}
    {!d.sources?.length&&!d.evidence?.length&&!arrayOf(r.evidencias).length&&<p>No existe referencia documental enlazada en las fuentes examinadas. La matriz conserva el fundamento registrado.</p>}
    <button className="ai-btn secondary" onClick={()=>onNavigate('documentos')}>Abrir inventario documental <ExternalLink size={15}/></button>
   </Section>
   <Section title="7. Supuestos, riesgos y recomendaciones" sub="Información registrada; no se incorporan riesgos o descartes inventados.">
    <p><b>Condiciones pendientes:</b> {compact(r.condiciones_pendientes)}</p>
    <p><b>Recomendación funcional:</b> {compact(r.recomendacion_final)}</p>
    {arrayOf(r.supuestos).map((x,i)=><pre className="rv-evidence" key={'a'+i}>{valueOf(x)}</pre>)}
    {arrayOf(r.riesgos).map((x,i)=><pre className="rv-evidence" key={'r'+i}>{valueOf(x)}</pre>)}
    {(d.assessments||[]).map((x,i)=><details key={i}><summary>Fundamentos técnicos y contractuales de soporte</summary><p>{x.technical_basis}</p><p>{x.contractual_basis}</p><p>{x.reusable_summary}</p></details>)}
   </Section>
  </>}
 </div>;
}
export default function ReportV13({view='resumen',onNavigate=()=>{}}){
 const [status,setStatus]=useState({loading:true,data:null,error:''}),[exportBusy,setExportBusy]=useState(false),[exportError,setExportError]=useState('');
 const [detail,setDetail]=useState(()=>new URLSearchParams(window.location.search).get('req'));
 const load=useCallback(async()=>{
  setStatus(s=>({...s,loading:true,error:''}));
  try{const r=await fetch(endpoint+'?view=snapshot',{cache:'no-store'}),d=await r.json();
   if(!r.ok||d.access!=='public_readonly_report'||!d.reconciliation?.valid)throw Error(d.error||'Informe consolidado no disponible');
   setStatus({loading:false,error:'',data:d});
  }catch(e){setStatus(s=>({...s,loading:false,error:e.message||'No fue posible consultar Neon'}))}
 },[]);
 useEffect(()=>{load()},[load]);
 useEffect(()=>{const pop=()=>setDetail(new URLSearchParams(window.location.search).get('req'));window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop)},[]);
 const open=code=>{setDetail(code);const u=new URL(window.location.href);u.searchParams.set('req',code);window.history.pushState({},'',u.pathname+u.search+u.hash);window.scrollTo({top:0,behavior:'smooth'})};
 const close=()=>{setDetail(null);const u=new URL(window.location.href);u.searchParams.delete('req');window.history.pushState({},'',u.pathname+u.search+u.hash)};
 const navigate=(...args)=>{close();onNavigate(...args)};
 const exportExcel=async()=>{setExportBusy(true);setExportError('');try{const r=await fetch(endpoint+'?view=export',{cache:'no-store'}),d=await r.json();
  if(!r.ok||d.access!=='public_readonly_report')throw Error(d.error||'No se pudo recuperar la matriz completa');
  exportV13Xlsx(status.data,d);
 }catch(e){setExportError(e.message)}finally{setExportBusy(false)}};
 const report=status.data;
 const pageTitle={resumen:'Resumen gerencial',matriz318:'Análisis de requerimientos',incrementales:'Funcionalidades incrementales',criterios:'Criterios y metodología',
  obligaciones318:'Obligaciones originales',brechasLaboral:'Brechas Laboral',avancev08:'Estimación por especialidad',exclusionesr48:'Exclusiones y reformulación',solapamientosv08:'Reutilización y trazabilidad'};
 return <div className="ai-shell">
  <div className="ai-head"><div><span className="ai-eyebrow">EJE NO PENAL · EVALUACIÓN Y ESTIMACIÓN FUNCIONAL</span>
   <h2>{detail?'Ficha técnica del requerimiento':pageTitle[view]||'Evaluación funcional'}</h2>
   <p>Resultados consolidados del análisis técnico · Propuestas incrementales sujetas a evaluación del usuario final</p></div>
   <button className="ai-btn secondary" disabled={status.loading} onClick={load}><RefreshCw size={16}/> Actualizar resultados</button></div>
  {status.error&&<div className="ai-error"><ShieldCheck size={18}/>{status.error}</div>}
  {status.loading&&!report&&<div className="ai-loading">Recuperando resultados consolidados, WBS y referencias documentales…</div>}
  {report&&<>
   {detail?<Detail code={detail} onBack={close} onNavigate={navigate}/>:
   <>
    <div className="ai-toolbar"><span><CheckCircle2 size={16}/> Datos conciliados: {fmt(report.reconciliation.requests)} solicitudes · {fmt(report.reconciliation.proposals)} propuestas · {fmt(report.reconciliation.activities)} actividades WBS</span>
    <div><button className="ai-btn secondary" disabled={exportBusy} onClick={exportExcel}><Download size={16}/>{exportBusy?'Preparando libro…':'Exportar Excel completo'}</button>
     <button className="ai-btn primary" onClick={()=>exportV13Pptx(report)}><BarChart3 size={16}/> Exportar PowerPoint</button></div></div>
    {exportError&&<div className="ai-error">{exportError}</div>}
    {view==='resumen'&&<Summary report={report} onOpen={open} onNavigate={navigate}/>}
    {view==='matriz318'&&<Matrix report={report} openDetail={open}/>}
    {view==='incrementales'&&<Incrementals report={report} openDetail={open}/>}
    {view==='criterios'&&<Criteria report={report} openDetail={open} onNavigate={navigate}/>}
    {view==='obligaciones318'&&<Obligations report={report} openDetail={open}/>}
    {view==='brechasLaboral'&&<Gaps report={report} onNavigate={navigate} openDetail={open}/>}
    {view==='avancev08'&&<Summary report={report} onOpen={open} onNavigate={navigate}/>}
    {view==='exclusionesr48'&&<Exclusions report={report} openDetail={open}/>}
    {view==='solapamientosv08'&&<Criteria report={report} openDetail={open} onNavigate={navigate}/>}
   </>}
   <p className="ai-footer">Fuente: matrices de evaluación y estimación consolidadas en Neon. No se modifican dictámenes, WBS ni documentos originales. La cifra PERT representa esfuerzo propuesto y no aprobación contractual.</p>
  </>}
 </div>;
}
