import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {AlertTriangle,BookOpen,CheckCircle2,ChevronLeft,ChevronRight,ClipboardList,Download,ExternalLink,FileText,Filter,RefreshCw,Search,ShieldCheck,GitMerge,BarChart3} from 'lucide-react';
import {uniqueRequests,filteredRequests,summarize,fmtHours,labels,isEstimated,stateLabel,text,number} from './integrated-model.js';
import {exportAuditXlsx,exportAuditPptx} from './integrated-export.js';
import './integrated-audit.css';

let cache=null,cacheAt=0,requestInFlight=null;
async function fetchSnapshot(force=false){
 if(!force&&cache&&Date.now()-cacheAt<120000)return cache;
 if(!force&&requestInFlight)return requestInFlight;
 const job=(async()=>{
  const r=await fetch('/api/integrated-audit?view=snapshot',{cache:'no-store'});
  const data=await r.json();
  if(!r.ok)throw Error(data.error||'No se pudieron recuperar las fuentes de auditoría');
  if(data.access!=='read_only_audit')throw Error('Origen de datos incompatible');
  if(uniqueRequests(data.requests).length!==data.requests.length)throw Error('La fuente contiene códigos duplicados: requiere revisión antes de presentar resultados');
  cache=data;cacheAt=Date.now();return data;
 })();
 requestInFlight=job;
 try{return await job;}finally{requestInFlight=null;}
}
const fmt=n=>number(n)===null?'Sin dato':new Intl.NumberFormat('es-PE',{maximumFractionDigits:0}).format(Number(n));
const fmt2=n=>number(n)===null?'Sin estimación':new Intl.NumberFormat('es-PE',{maximumFractionDigits:2}).format(Number(n));
function Chip({children,tone=''}){return <span className={'ai-chip '+tone}>{children??'Sin dato'}</span>}
function Metric({label,value,help,flag}){return <div className={'ai-metric '+(flag||'')}><small>{label}</small><strong>{value}</strong>{help&&<span>{help}</span>}</div>}
function Block({title,subtitle,children}){return <section className="ai-block"><div className="ai-block-header"><h3>{title}</h3>{subtitle&&<p>{subtitle}</p>}</div>{children}</section>}
function Bar({name,value,max,label}){return <div className="ai-barline"><div className="ai-bar-label"><span>{name}</span><b>{label||fmt(value)}</b></div><div className="ai-track"><div style={{width:Math.min(100,100*Number(value||0)/Math.max(1,Number(max||1)))+'%'}}/></div></div>}
function Empty({children}){return <div className="ai-empty"><Search size={25}/><p>{children}</p></div>}
const alt=(v,otherwise='Sin registro')=>text(v)||otherwise;
function Reference({refValue,locator,claim}){
 const url=typeof refValue==='string'&&/^https:\/\//.test(refValue)?refValue:null;
 return <div className="ai-ref"><b>{url?<a href={url} target="_blank" rel="noopener noreferrer">{refValue} <ExternalLink size={12}/></a>:alt(refValue,'Referencia sin enlace')}</b>{locator&&<small>Localizador: {locator}</small>}{claim&&<p>{claim}</p>}</div>;
}
const initialFilters={search:'',eligibility:'',area:'',category:'',agent:'',status:'',confidence:'',batch:'',qa:'',minHours:'',maxHours:'',onlySdo:false,onlyGap:false,onlyEstimated:false,onlyExcluded:false};
function SelectField({label,value,values,onChange}){return <label>{label}<select value={value} onChange={e=>onChange(e.target.value)}><option value="">Todos</option>{values.map(v=><option key={v} value={v}>{v}</option>)}</select></label>}
function FilterBar({rows,filters,setFilters,clear}) {
 const options=field=>[...new Set(rows.map(r=>r[field]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'es'));
 const update=(name,val)=>setFilters(p=>({...p,[name]:val}));
 return <div className="ai-filters">
  <label className="ai-search"><Search size={17}/> <input value={filters.search} placeholder="Buscar código, texto, SDO, brecha, fundamento…" onChange={e=>update('search',e.target.value)}/></label>
  <SelectField label="Elegibilidad V2" value={filters.eligibility} values={options('eligibility')} onChange={v=>update('eligibility',v)}/>
  <SelectField label="Área" value={filters.area} values={options('area')} onChange={v=>update('area',v)}/>
  <SelectField label="Categoría V07" value={filters.category} values={options('v07_category')} onChange={v=>update('category',v)}/>
  <SelectField label="Agente V08" value={filters.agent} values={options('v08_agent')} onChange={v=>update('agent',v)}/>
  <SelectField label="Estado V08" value={filters.status} values={options('estimate_status')} onChange={v=>update('status',v)}/>
  <SelectField label="Confianza" value={filters.confidence} values={options('estimate_confidence')} onChange={v=>update('confidence',v)}/>
  <SelectField label="QA técnico" value={filters.qa} values={options('qa_outcome')} onChange={v=>update('qa',v)}/>
  <SelectField label="Lote" value={filters.batch} values={options('batch')} onChange={v=>update('batch',v)}/>
  <label>PERT mínimo (h)<input type="number" min="0" value={filters.minHours} onChange={e=>update('minHours',e.target.value)}/></label>
  <label>PERT máximo (h)<input type="number" min="0" value={filters.maxHours} onChange={e=>update('maxHours',e.target.value)}/></label>
  <label className="ai-check"><input type="checkbox" checked={filters.onlySdo} onChange={e=>update('onlySdo',e.target.checked)}/> Con SDO</label>
  <label className="ai-check"><input type="checkbox" checked={filters.onlyGap} onChange={e=>update('onlyGap',e.target.checked)}/> Con brecha</label>
  <label className="ai-check"><input type="checkbox" checked={filters.onlyEstimated} onChange={e=>update('onlyEstimated',e.target.checked)}/> Estimados</label>
  <label className="ai-check"><input type="checkbox" checked={filters.onlyExcluded} onChange={e=>update('onlyExcluded',e.target.checked)}/> Excluidos</label>
  <button className="ai-btn secondary" onClick={clear}>Restablecer filtros</button>
 </div>;
}
function Tabular({headers,children}){return <div className="ai-tablewrap"><table><thead><tr>{headers.map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{children}</tbody></table></div>}
function Pagination({page,total,pageSize,setPage}) {
 const pages=Math.max(1,Math.ceil(total/pageSize));
 return <div className="ai-pagination"><span>{fmt(total)} registros · Página {page} de {pages}</span><div><button disabled={page<=1} onClick={()=>setPage(Math.max(1,page-1))}><ChevronLeft size={16}/> Anterior</button><button disabled={page>=pages} onClick={()=>setPage(Math.min(pages,page+1))}>Siguiente <ChevronRight size={16}/></button></div></div>;
}

function Overview({rows,snapshot,m,onOpen,onSwitch}){
 const divisions=Object.entries(m.classification).sort((a,b)=>b[1]-a[1]);
 const newRows=rows.filter(r=>r.final_new).sort((a,b)=>Number(b.final_pert||0)-Number(a.final_pert||0));
 const byArea=Object.entries(newRows.reduce((a,r)=>(a[r.area||'Sin especialidad']=(a[r.area||'Sin especialidad']||0)+Number(r.final_pert||0),a),{})).sort((a,b)=>b[1]-a[1]);
 const perAgent=(snapshot.agents||[]).map(a=>({agent:a.agent_id,total:rows.filter(r=>r.v08_agent===a.agent_id&&r.final_new).reduce((n,r)=>n+Number(r.final_pert||0),0)}));
 const max=Math.max(1,...byArea.map(x=>x[1]),...perAgent.map(x=>x.total));
 return <div className="ai-flow">
 <div className="ai-callout"><CheckCircle2 size={21}/><span><b>Cierre técnico definitivo: {snapshot.sourceVersion}</b>. Las cifras reconocidas como nuevas se calculan sobre las 318 decisiones individuales V00 V9. Las WBS preliminares excluidas permanecen en el historial, no en la bolsa incremental.</span></div>
 <div className="ai-metrics">
  <Metric label="Requisitos SDO" value={fmt(snapshot.sdo?.length)} help="Universo contractual"/>
  <Metric label="Brechas Laboral" value={fmt(snapshot.gaps?.length)} help="Registros de análisis"/>
  <Metric label="Solicitudes evaluadas" value={fmt(m.total)} help="Una decisión vigente por código"/>
  <Metric label="Funcionalidades nuevas EJE" value={fmt(m.newCount)} flag="primary" help="Novedad técnica acreditada"/>
  <Metric label="Alcance SDO existente" value={fmt(m.sdoCovered)} help="No se suma a bolsa"/>
  <Metric label="Alcance brecha original" value={fmt(m.gapCovered)} help="No se suma a bolsa"/>
  <Metric label="Cambios en sistemas externos" value={fmt(m.external)} help="Reformular si se desea intervenir el EJE"/>
  <Metric label="Novedad no acreditada" value={fmt(m.notAccredited)} help="No cargar a bolsa sin sustento"/>
  <Metric label="Configuración y ajustes" value={fmt(m.configuration)} help="No incrementales"/>
  <Metric label="Duplicados" value={fmt(m.duplicates)} help="Esfuerzo una sola vez"/>
  <Metric label="Horas finales PERT EJE" value={fmtHours(m.finalHours.pert)} flag="primary" help="Sólo nuevas funcionalidades acreditadas"/>
  <Metric label="Horas preliminares no incluidas" value={fmtHours(m.notIncludedHours)} flag="caution" help="Referencia histórica, no financiar"/>
 </div>
 <div className="ai-columns">
  <Block title="Clasificación técnica final" subtitle="Exactamente la clasificación V00 V9, no la elegibilidad histórica V2">
   {divisions.map(([k,v])=><Bar key={k} name={labels[k]||k} value={v} max={m.total}/>)}
  </Block>
  <Block title="Escenarios WBS / PERT reconocidos" subtitle="Horas-persona de las nuevas funcionalidades EJE; escenarios propios de la misma muestra">
   <div className="ai-scenarios">
    {Object.entries({Optimista:m.finalHours.optimistic,'Más probable':m.finalHours.mostLikely,'Esperada PERT':m.finalHours.pert,Pesimista:m.finalHours.pessimistic})
     .map(([k,v])=><div key={k}><span>{k}</span><b>{fmtHours(v)}</b></div>)}
    <h4>Conciliación histórica</h4>
    <div><span>PERT técnico bruto antes del cierre</span><b>{fmtHours(m.referenceBruteHours)}</b></div>
    <div><span>PERT no admitido para nuevas funciones</span><b>{fmtHours(m.notIncludedHours)}</b></div>
    <div><span>Solicitudes con WBS histórica</span><b>{fmt(m.technicalHistorical)}</b></div>
    <div><span>Actividades WBS finales admitidas</span><b>{fmt(m.wbsAccepted)}</b></div>
   </div>
  </Block>
  <Block title="Horas admitidas por área" subtitle="Sólo las solicitudes NUEVO_EJE, sin sumar intervenciones a satélites">
   {byArea.map(([k,v])=><Bar key={k} name={k} value={v} max={max} label={fmtHours(v)}/>)}
  </Block>
  <Block title="Riesgos y exclusiones" subtitle="Razonamiento técnico V00 V9 y resolución de conflictos">
   <div className="ai-scenarios">
    <div><span>Reformulación pendiente para EJE</span><b>{fmt(m.reformulation)}</b></div>
    <div><span>Solapamientos identificados</span><b>{fmt(m.overlaps)}</b></div>
    <div><span>Revisiones R48 registradas</span><b>{fmt((snapshot.r48?.scope||[]).length+(snapshot.r48?.resolutions||[]).length)}</b></div>
    <div><span>Novedad no acreditada</span><b>{fmt(m.notAccredited)}</b></div>
   </div>
   <p className="ai-note">Una coincidencia con SDO no prueba cumplimiento funcional; una WBS preliminar tampoco acredita novedad técnica.</p>
  </Block>
 </div>
 <Block title="Seis funcionalidades nuevas acreditadas" subtitle="Detalle técnico revisable, con horas realmente admitidas por V00">
  <Tabular headers={['Solicitud','Descripción','Área','PERT final','Corte','Abrir ficha']}>
   {newRows.map(r=><tr key={r.code}><td><b>{r.code}</b></td><td className="ai-long">{r.description}</td><td>{r.area}</td><td className="ai-num"><b>{fmtHours(r.final_pert)}</b></td><td><small>{r.final_version}</small></td><td><button className="ai-btn small" onClick={()=>onOpen(r.code)}>WBS <ChevronRight size={14}/></button></td></tr>)}
  </Tabular>
 </Block>
 <Block title="Conclusiones para dirección" subtitle="Distingue hechos verificados, interpretación y medidas necesarias">
  <div className="ai-four">
   <div><b>Hechos</b><p>{m.newCount} de {m.total} solicitudes tienen novedad EJE acreditada. Sus {fmt(m.wbsAccepted)} actividades suman {fmtHours(m.finalHours.pert)} PERT.</p></div>
   <div><b>Alcance original</b><p>{m.sdoCovered} están clasificadas en SDO original y {m.gapCovered} en brechas originales. Deben atenderse sin contabilizar nuevos incrementos.</p></div>
   <div><b>Exclusiones y reformulación</b><p>{m.external} afectan directamente sistemas externos y {m.reformulation} requieren reformulación; no suman horas EJE.</p></div>
   <div><b>Recomendación técnica</b><p>Implementar exclusivamente deltas EJE sustentados. Mantener separados incumplimientos, defectos, configuraciones, duplicidades y solicitudes sin novedad acreditada.</p></div>
  </div>
 </Block>
 <div className="ai-actions"><button className="ai-btn primary" onClick={()=>onSwitch('matriz318')}>Ver las 318 decisiones <ChevronRight size={16}/></button><button className="ai-btn secondary" onClick={()=>onSwitch('solapamientosv08')}>Solapamientos y duplicidades</button></div>
 </div>;
}
function Matrix({rows,onOpen}){
 return <Tabular headers={['Solicitud','Descripción original','Área','Decisión técnica final V00 V9','SDO / brecha','Originalmente exigible','Incremento y fundamento','Sistema / responsable','Agente y estimación histórica','O final','M final','PERT final','P final','Horas no incluidas','Método','QA / revisión','Detalle']}>
 {rows.map(r=><tr key={r.code}>
  <td><b>{r.code}</b><small>{r.batch} · fila {r.source_row}</small></td>
  <td className="ai-long">{r.description}</td>
  <td>{r.area}</td>
  <td><Chip tone={r.final_new?'yes':r.final_decision==='NOVEDAD_NO_ACREDITADA'?'conditional':'no'}>{labels[r.final_decision]||r.final_decision}</Chip><small>{r.final_version}</small></td>
  <td><small>SDO: {r.requisitos_sdo||(r.sdo_links||[]).map(l=>l.code).join(', ')||'Sin registro'}</small><small>Brecha: {r.brechas_relacionadas||(r.gap_links||[]).map(l=>l.id).join(', ')||'Sin registro'}</small></td>
  <td className="ai-long">{r.funcion_originalmente_exigible||'No se identificó obligación específica'}</td>
  <td className="ai-long">{r.final_reason||r.motivo_exclusion_y_recomendacion||'Ver detalle'}</td>
  <td>{r.final_system||'Sin responsable definido'}<small>{r.final_master?'Maestro: '+r.final_master:''}</small></td>
  <td>{r.agente_estimador||r.v08_agent||'No asignado'}<small>{r.estimate_id?'WBS preliminar histórica':'Sin WBS preliminar'}</small></td>
  {['final_o','final_m','final_pert','final_p'].map(k=><td key={k} className="ai-num">{fmt2(r[k])}</td>)}
  <td className="ai-num">{fmt2(r.final_excluded_hours)}</td>
  <td>{r.final_new?'WBS / 3 puntos / PERT':'No aplica bolsa'}</td>
  <td>{r.qa_resultado||'No consignado'}<small>{r.revision_secundaria||''}</small></td>
  <td><button className="ai-btn small" onClick={()=>onOpen(r.code)}>Ver sustento <ChevronRight size={14}/></button></td>
 </tr>)}</Tabular>;
}

function Obligations({rows,onOpen,onSdo,sdoCatalog=[]}){
 const bySdo=new Map(sdoCatalog.map(x=>[x.code,x]));
 const eligible=rows.filter(r=>['ALCANCE_ORIGINAL_SDO','ALCANCE_ORIGINAL_BRECHA'].includes(r.final_decision));
 return <Block title="Obligaciones originales exigibles a Softplan" subtitle="Únicamente solicitudes clasificadas por V00 V9 como funcionalidad original SDO o brecha original. Otras exclusiones no se imputan automáticamente a Softplan.">
 <p className="ai-note">{eligible.length} obligaciones originales identificadas. Su implementación y funcionamiento deben verificarse por separado; no se financian por segunda vez con horas adicionales.</p>
 <Tabular headers={['Solicitud','Decisión final','SDO contractual','Brecha original','Alcance ya contratado','Fundamento técnico','Responsable / sistema','Implementación','Incremento admitido','Detalle']}>
 {eligible.map(r=><tr key={r.code}>
  <td><button className="ai-btn small" onClick={()=>onOpen(r.code)}>{r.code}</button><small>{r.description?.slice(0,150)}</small></td>
  <td><Chip>{labels[r.final_decision]}</Chip></td>
  <td>{(r.sdo_links||[]).length?r.sdo_links.map(l=><div key={l.code}>
   <button className="ai-link" onClick={()=>onSdo(l.code)}>{l.code}</button><small>{(bySdo.get(l.code)?.description||'Sin texto contractual localizado').slice(0,350)}</small>
   </div>):r.requisitos_sdo||'Sin referencia específica'}</td>
  <td>{r.brechas_relacionadas||(r.gap_links||[]).map(x=>x.id).join(', ')||'Sin brecha vinculada'}</td>
  <td className="ai-long">{alt(r.funcion_originalmente_exigible)}</td>
  <td className="ai-long">{alt(r.final_reason)}</td>
  <td>{alt(r.final_system)}</td>
  <td>Verificar funcionalmente<small>La SDO no prueba cumplimiento real</small></td>
  <td className="ai-num"><b>0 h</b></td>
  <td><button className="ai-btn small" onClick={()=>onOpen(r.code)}>Ver evidencia</button></td>
 </tr>)}</Tabular>
 </Block>;
}
function GapTable({gaps,rows,onOpen,onSdo}){
 const [search,setSearch]=useState(''),[page,setPage]=useState(1),pageSize=35;
 const filtered=gaps.filter(g=>[g.gap_code,g.sdo_code,g.description,g.verdict,g.source_solution,g.id].join(' ').toLowerCase().includes(search.toLowerCase()));
 const visible=filtered.slice((page-1)*pageSize,page*pageSize);
 return <Block title="331 evaluaciones de brechas Laboral" subtitle="Se presenta la evaluación Laboral disponible, sin asumir que un vínculo documental acredite incumplimiento funcional.">
 <div className="ai-inline"><input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="Filtrar brecha, SDO o conclusión…"/><span>{fmt(filtered.length)} resultados</span></div>
 <Tabular headers={['Registro / código','Requisito SDO','Descripción de la brecha','Última evaluación','Vínculos con solicitudes','Fuente / verificación']}>
 {visible.map(g=>{const related=rows.filter(r=>(r.gap_links||[]).some(l=>String(l.id)===String(g.id)));return <tr key={g.id}>
 <td><strong>#{g.id}</strong><small>{g.gap_code||'Sin código'}</small><small>{g.source_sheet} · {g.source_row}</small></td>
 <td>{g.sdo_code&&<button className="ai-link" onClick={()=>onSdo(g.sdo_code)}>{g.sdo_code}</button>}</td>
 <td className="ai-long">{g.description}</td><td><Chip>{g.verdict||'Sin evaluación'}</Chip><small>{g.evaluation_technical||g.evaluation_contractual||'Sin fundamento registrado'}</small></td>
 <td>{related.map(r=><button className="ai-link" key={r.code} onClick={()=>onOpen(r.code)}>{r.code}</button>)}{!related.length&&'Sin relación registrada'}</td>
 <td>{g.source_final_status||'Sin estado fuente'}<small>{g.missing_evidence||''}</small></td>
 </tr>})}</Tabular><Pagination page={page} setPage={setPage} total={filtered.length} pageSize={pageSize}/>
 </Block>;
}

function AgentProgress({snap,rows,onOpen}){
 return <div className="ai-flow">
 <Block title="Estimaciones por ventana y especialidad" subtitle="La WBS histórica no implica novedad. El esfuerzo reconocido se suma solo si la solicitud es NUEVO_EJE en V00 V9.">
 <Tabular headers={['Agente / especialidad','Asignadas','WBS históricas','Novedades reconocidas V9','PERT final EJE','PERT bruto histórico','QA / observaciones','Solicitudes']}>
 {(snap.agents||[]).map(a=>{
  const mine=rows.filter(r=>r.v08_agent===a.agent_id);
  const newRows=mine.filter(r=>r.final_new);
  const total=newRows.reduce((n,r)=>n+Number(r.final_pert||0),0);
  const brute=mine.reduce((n,r)=>n+Number(r.horas_pert_brutas||0),0);
  return <tr key={a.agent_id}>
   <td><b>{a.agent_id}</b><small>{a.focus}</small></td>
   <td>{fmt(mine.length)}</td><td>{fmt(mine.filter(isEstimated).length)}</td>
   <td><b>{newRows.length}</b></td><td className="ai-num"><b>{fmtHours(total)}</b></td>
   <td className="ai-num">{fmtHours(brute)}</td>
   <td><small>{mine.filter(x=>x.final_decision==='NOVEDAD_NO_ACREDITADA').length} sin novedad acreditada</small><small>{mine.filter(x=>x.final_decision==='CAMBIO_EXTERNO').length} externos</small></td>
   <td><details><summary>{mine.length} solicitudes</summary>{mine.map(r=><button key={r.code} className="ai-link" onClick={()=>onOpen(r.code)}>{r.code}</button>)}</details></td>
  </tr>;
 })}</Tabular>
 </Block>
 <p className="ai-note">Las asignaciones y trabajos originales permanecen visibles como historial V08. El cierre de novedad técnica prevalece para totalización y presentación ejecutiva.</p>
 </div>;
}
function Exclusions({rows,onOpen,r48}){
 const [search,setSearch]=useState(''),[choice,setChoice]=useState(''),[page,setPage]=useState(1);
 const decisionMap=new Map((r48?.scope||[]).map(x=>[x.source_code,x]));
 const resolutionMap=new Map((r48?.resolutions||[]).map(x=>[x.source_code,x]));
 const all=rows.filter(r=>!r.final_new);
 const selected=all.filter(r=>(!choice||r.final_decision===choice)&&[r.code,r.description,r.final_reason,r.final_decision,r.final_system].join(' ').toLowerCase().includes(search.toLowerCase()));
 const list=selected.slice((page-1)*30,page*30);
 const decisionOptions=[...new Set(all.map(r=>r.final_decision).filter(Boolean))].sort();
 return <div className="ai-flow">
  <Block title="Exclusiones y decisiones R48" subtitle="Se recuperan las revisiones R48 V4/V5 y se conserva la decisión técnica V00 V9 como autoridad final de novedad.">
   <div className="ai-facts"><span>Dictámenes R48 V4: <b>{(r48?.scope||[]).length}</b></span>
     <span>Resoluciones R48 V5: <b>{(r48?.resolutions||[]).length}</b></span>
     <span>Solicitudes sin novedad acreditada: <b>{all.length}</b></span>
     <span>Versiones: <b>V00 final V9 + R48 V4/V5</b></span></div>
   <div className="ai-inline"><input placeholder="Buscar código, sistema, exclusión o fundamento…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/>
   <select className="ai-order" value={choice} onChange={e=>{setChoice(e.target.value);setPage(1)}}><option value="">Todas las categorías</option>{decisionOptions.map(c=><option value={c} key={c}>{labels[c]||c}</option>)}</select></div>
   <Tabular headers={['Solicitud','Decisión final V00 V9','Sistema / propietario','Obligación base / exclusión','PERT bruto no admitido','Dictamen R48 (si existe)','Fundamento','Abrir']}>
   {list.map(r=>{
    const v4=decisionMap.get(r.code),v5=resolutionMap.get(r.code);
    return <tr key={r.code}>
     <td><b>{r.code}</b><small>{r.description?.slice(0,120)}</small></td>
     <td><Chip>{labels[r.final_decision]||r.final_decision}</Chip></td>
     <td>{r.final_system||v5?.target_system||v4?.target_system||'No consignado'}</td>
     <td className="ai-long">{r.funcion_originalmente_exigible||'Sin cobertura original específica'}<small>{r.motivo_exclusion_y_recomendacion||''}</small></td>
     <td className="ai-num">{fmtHours(r.final_excluded_hours)}</td>
     <td>{v4&&<div><Chip>{v4.final_decision}</Chip><small>{v4.decided_at}</small></div>}
       {v5&&<div><Chip>{v5.decision}</Chip><small>{v5.decided_at}</small></div>}
       {!v4&&!v5&&'Sin resolución R48 específica'}</td>
     <td className="ai-long">{r.final_reason}</td>
     <td><button className="ai-btn small" onClick={()=>onOpen(r.code)}>Ficha</button></td>
    </tr>;
   })}</Tabular><Pagination page={page} setPage={setPage} total={selected.length} pageSize={30}/>
  </Block>
 </div>;
}
function Overlaps({snap,rows,onOpen}){
 const selected=(snap.overlaps||[]).filter(o=>rows.some(r=>r.code===o.code_a||r.code===o.code_b));
 return <div className="ai-flow">
 <Block title="49 relaciones de solapamiento V00" subtitle="Los descuentos solo se reconocen cuando están cuantificados y verificados por V00; una coincidencia no constituye duplicación de horas.">
 <Tabular headers={['Solicitud A','Solicitud B','Tipo','Estado / deslinde','Propietario','Descuento demostrado','Fundamento / condiciones']}>
 {selected.map((o,i)=><tr key={i}>
  <td><button className="ai-link" onClick={()=>onOpen(o.code_a)}>{o.code_a}</button></td>
  <td><button className="ai-link" onClick={()=>onOpen(o.code_b)}>{o.code_b}</button></td>
  <td>{o.tipo||o.relation_types}</td>
  <td><Chip>{o.dictamen||o.status}</Chip><small>{o.tipo_deslinde||''}</small></td>
  <td>{o.propietario_componente||'Sin asignación'}</td>
  <td className="ai-num">{fmtHours(o.descuento_demostrado)}</td>
  <td className="ai-long">{o.resolution_basis}<small>{o.condiciones||''}</small><small>{o.fuente_version||''}</small></td>
 </tr>)}</Tabular>
 </Block>
 <Block title="Componentes reutilizables" subtitle="La propiedad y sus consumidores se presentan sin sumar dos veces el costo de construcción.">
 <Tabular headers={['Componente','Agente propietario','Estado','Descripción','Solicitudes']}>
 {(snap.components||[]).map(c=><tr key={c.component_key}>
  <td><b>{c.component_key}</b></td><td>{c.owner_agent}</td><td>{c.status}</td>
  <td className="ai-long">{c.description}</td>
  <td>{(c.dependencies||[]).map(code=><button className="ai-link" key={code} onClick={()=>onOpen(code)}>{code}</button>)}</td>
 </tr>)}</Tabular>
 </Block></div>;
}
function RequestDetail({code,onClose,onSdo}){
 const [state,setState]=useState({loading:true,data:null,error:''});
 useEffect(()=>{let stopped=false;setState({loading:true,data:null,error:''});
  fetch('/api/integrated-audit?view=detail&code='+encodeURIComponent(code),{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Ficha no disponible');return d;})
   .then(data=>{if(!stopped)setState({loading:false,data,error:''})}).catch(e=>{if(!stopped)setState({loading:false,data:null,error:e.message})});
  return()=>{stopped=true};
 },[code]);
 const d=state.data, v2=d?.v2?.at(-1),u=d?.units?.find(u=>u.estimate_id)||d?.units?.[0], sdo=d?.sdoLinks||[],gaps=d?.gapLinks||[],wbs=d?.wbs||[];
 const totals=names=>wbs.length?wbs.reduce((s,w)=>s+Number(w[names]||0),0):null;
 return <div className="ai-flow">
 <div className="ai-detailhead"><button className="ai-btn secondary" onClick={onClose}><ChevronLeft size={16}/> Volver</button><h2>{code} · Ficha completa de auditoría</h2><span>URL directa · solo lectura</span></div>
 {state.loading&&<p>Cargando contrato, WBS y trazabilidad…</p>}
 {state.error&&<div className="ai-error">{state.error}</div>}
 {d&&<>
 <Block title="A. Solicitud original" subtitle="Procedencia íntegra del registro 318"><p className="ai-prose">{d.request.request_text}</p>
 <div className="ai-facts"><span>Área: <b>{d.request.area}</b></span><span>Lote: <b>{d.request.batch_code}</b></span><span>Origen: <b>{d.request.source_sheet}, fila {d.request.source_row}</b></span><span>Fecha: <b>{alt(d.request.created_at)}</b></span></div>
 </Block>
 <Block title="B. Análisis funcional V07" subtitle="La solicitud no implica por sí sola desarrollo facturable">
 {(d.assessments||[]).map(a=><details key={a.id} open={a.id===d.assessments.at(-1)?.id}><summary>Revisión {a.revision_no} · {a.category} · {a.author_agent}</summary>
 <p><b>Función base:</b> {alt(a.base_functionality)}</p><p><b>Comportamiento nuevo:</b> {alt(a.additional_capacity)}</p>
 <p><b>Delta genuino:</b> {alt(a.genuine_delta,'No identificado')}</p><p><b>Fundamento técnico:</b> {alt(a.technical_basis)}</p><p><b>Exclusiones:</b> {alt(a.estimation_exclusions)}</p></details>)}
 </Block>
 <Block title="C. Obligación contractual SDO y brechas" subtitle="Vínculo ≠ cumplimiento demostrado; las obligaciones originales no se financian dos veces">
 <p><b>Equivalencia:</b> {alt(v2?.sdo_equivalence)}</p><p><b>Alcance original:</b> {alt(v2?.original_covered_scope)}</p><p><b>Adicional:</b> {alt(v2?.additional_behavior)}</p><p><b>Decisión V2:</b> {alt(v2?.decision)} / {alt(v2?.effort_mode)}</p>
 {(sdo||[]).map((s,i)=><div className="ai-ref" key={i}><button className="ai-link" onClick={()=>onSdo(s.sdo_code)}>{s.sdo_code}</button><p>{s.sdo_description||s.contractual_basis}</p><small>Verificación funcional: {s.verification_status||'No contrastada'}</small></div>)}
 {(gaps||[]).map((g,i)=><div className="ai-ref" key={i}><strong>Brecha #{g.gap_item_id} · {g.source_gap_code||'Sin código'}</strong><p>{g.source_description}</p><small>{g.basis}</small></div>)}
 <p><b>Sustento de exclusión:</b> {alt(v2?.exclusions,u?.exclusions_snapshot)}</p>
 </Block>
 <Block title="D. Método de estimación" subtitle="WBS + estimación de tres puntos + PERT + juicio experto; contrastes funcionales solo cuando estén medidos">
 {u?.estimate_id?<><p><b>Metodología:</b> {u.methodology}</p><p><b>Justificación experta:</b> {u.expert_justification}</p><p><b>Confianza:</b> {u.estimate_confidence}</p><p><b>Alcance:</b> {u.scope_basis}</p><p><b>Exclusiones:</b> {u.exclusions_basis}</p><p><b>Estado contractual:</b> {u.contractual_status} (sin aprobación automática)</p></>:<div className="ai-callout">Sin estimación WBS persistida. {v2?.decision||'Revisión pendiente'}.</div>}
 {(d.methods||[]).map(m=><p key={m.id}><b>{m.method}:</b> {m.size_units} {m.unit_name} · {m.measurement_boundary}; contraste, no suma adicional de horas</p>)}
 </Block>
 <Block title="E. Horas por actividad WBS" subtitle="O ≤ M ≤ P. PERT calculado desde cada actividad; no se suma con métodos IFPUG/COSMIC/SNAP.">
 {wbs.length?<><div className="ai-mini-metrics">{[['O','o'],['Más probable','m'],['PERT','pert'],['P','p']].map(([k,key])=><Metric key={key} label={k} value={fmtHours(totals(key))}/>)}</div>
 <Tabular headers={['Código','Fase','Actividad / descripción','Por qué es incremental','O','M','PERT','P','Componente']}>
 {wbs.map(w=><tr key={w.id}><td>{w.activity_code}</td><td>{w.phase}</td><td className="ai-long">{w.description}<small>{w.notes}</small></td><td className="ai-long">{w.incremental_basis}</td><td className="ai-num">{fmt2(w.o)}</td><td className="ai-num">{fmt2(w.m)}</td><td className="ai-num">{fmt2(w.pert)}</td><td className="ai-num">{fmt2(w.p)}</td><td>{w.effort_scope}{w.component_key&&<small>{w.component_key}</small>}</td></tr>)}</Tabular></>:<Empty>No corresponde sumar horas sin WBS aprobada para registro técnico.</Empty>}
 </Block>
 <Block title="F. Riesgos, hipótesis, dependencias y contingencias" subtitle="Incertidumbre incluida en P no puede contabilizarse otra vez como contingencia">
 {(u?.conditional_assumptions||[]).length>0&&<div className="ai-callout"><b>Estimación condicionada</b><pre>{JSON.stringify(u.conditional_assumptions,null,2)}</pre></div>}
 {(d.risks||[]).map(r=><div className="ai-ref" key={r.id}><b>{r.risk_code} · {r.probability} / {r.impact}</b><p>{r.description}</p><small>Mitigación: {r.mitigation} · Incluido en WBS/P: {r.wbs_covered?'Sí':'No'}</small></div>)}
 {(d.assumptions||[]).map(a=><p key={a.id}><b>{a.source_kind} · {a.validation_owner}:</b> {a.assumption_text}<small> Si cambia: {a.impact_if_false}</small></p>)}
 {(d.deps||[]).map(a=><p key={a.id}><b>{a.dependency_type} · {a.reference}:</b> {a.basis} ({a.status})</p>)}
 {(d.contingencies||[]).map(c=><p key={c.id}>Contingencia {c.risk_code}: {fmtHours(c.contingency_hours)} · {c.basis}</p>)}
 </Block>
 <Block title="G. Evidencias y documentos" subtitle="Se presentan las referencias realmente registradas sin ocultar los enlaces disponibles">
 {(d.documents||[]).map(x=><Reference key={x.id} refValue={x.document_ref} locator={x.locator} claim={x.claim}/>)}
 {(u?.technical_sources||[]).map((x,i)=><Reference key={'e'+i} refValue={x.document_ref} locator={x.locator} claim={x.claim}/>)}
 {(v2?.document_references||[]).map((x,i)=><Reference key={'v'+i} refValue={x.reference||x.document_ref} locator={x.locator} claim={x.claim}/>)}
 {!(d.documents||[]).length&&!(u?.technical_sources||[]).length&&!(v2?.document_references||[]).length&&<p>Sin documento trazable registrado.</p>}
 </Block>
 <Block title="H. Historia de revisiones, QA y decisiones" subtitle="No se borran dictámenes anteriores al aplicar la revisión V2">
 {(d.qa||[]).map(q=><p key={q.id}><b>QA V07 · {q.result}</b> · {q.reviewer} · {q.created_at}<small>{q.reason}</small></p>)}
 {(d.v2||[]).map(v=><p key={v.id}><b>V2 rev. {v.review_version} · {v.decision}</b> · {v.reviewed_by} · {v.reviewed_at}<small>{v.quality_reason}</small></p>)}
 {(d.peerReviews||[]).map(p=><p key={p.id}><b>Revisión secundaria · {p.result}</b> · {p.reviewer_agent} · {p.created_at}<small>{p.basis}</small></p>)}
 {(d.qualityChecks||[]).map(q=><p key={q.id}><b>QA V08 · {q.outcome}</b> · {q.reviewer} · {q.created_at}<small>{q.basis}</small></p>)}
 {(d.events||[]).slice(-15).map(ev=><p key={ev.id}><b>V08 · {ev.action}</b> · {ev.actor} · {ev.created_at}</p>)}
 <p><b>R48:</b> No consta resolución individual registrada en la fuente R48 a la fecha de consulta.</p>
 </Block>
 </>}
 </div>;
}
export default function IntegratedAudit({view='resumen',onNavigate=()=>{}}){
 const [state,setState]=useState({loading:true,snapshot:null,error:''});
 const [exportBusy,setExportBusy]=useState(false),[exportError,setExportError]=useState('');
 const [filters,setFilters]=useState(initialFilters),[page,setPage]=useState(1),[orderBy,setOrderBy]=useState('code'),[ascending,setAscending]=useState(true),[detail,setDetail]=useState(()=>new URLSearchParams(window.location.search).get('req'));
 const pageSize=25;
 const refresh=useCallback(async(force=false)=>{setState(p=>({...p,loading:true,error:''}));try{const snapshot=await fetchSnapshot(force);setState({loading:false,snapshot,error:''})}catch(e){setState(p=>({...p,loading:false,error:e.message||'Error de conexión'}))}},[]);
 useEffect(()=>{refresh(false)},[refresh]);
 useEffect(()=>{const onPop=()=>setDetail(new URLSearchParams(window.location.search).get('req'));window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop)},[]);
 useEffect(()=>{setPage(1)},[filters,view]);
 const openDetail=code=>{setDetail(code);const url=new URL(window.location.href);url.searchParams.set('req',code);window.history.pushState({req:code},'',url.pathname+url.search+url.hash);window.scrollTo({top:0,behavior:'smooth'})};
 const closeDetail=()=>{setDetail(null);const url=new URL(window.location.href);url.searchParams.delete('req');window.history.pushState({},'',url.pathname+url.search+url.hash)};
 const snap=state.snapshot,all=snap?.requests||[],filtered=useMemo(()=>filteredRequests(all,filters),[all,filters]);
 const matched=useMemo(()=>{
   const source=view==='obligaciones318'?filtered.filter(r=>r.eligibility==='EXCLUIDO'):filtered;
   return [...source].sort((a,b)=>{const x=orderBy==='hours'?Number(a.pert_expected||0):String(a[orderBy]||'');const y=orderBy==='hours'?Number(b.pert_expected||0):String(b[orderBy]||'');return (ascending?1:-1)*(typeof x==='number'?x-y:x.localeCompare(y,'es'))});
 },[view,filtered,orderBy,ascending]);
 const metrics=useMemo(()=>summarize(filtered,snap?.overlaps||[]),[filtered,snap]);
 const visible=matched.slice((page-1)*pageSize,page*pageSize);
 const exportFull=async()=>{setExportBusy(true);setExportError('');
  try{
   const res=await fetch('/api/integrated-audit?view=export',{cache:'no-store'});
   const payload=await res.json();if(!res.ok||payload.access!=='read_only_audit_export')throw Error(payload.error||'No se pudo preparar la matriz de exportación');
   const index=new Map(payload.rows.map(r=>[r.code,r]));
   if(index.size!==318)throw Error('La exportación no contiene los 318 requisitos originales');
   if(filtered.some(r=>!index.has(r.code)))throw Error('Faltan referencias al contrastar el Excel con la matriz visible');
   exportAuditXlsx(filtered.map(r=>({...r,...index.get(r.code)})));
  }catch(e){setExportError(e.message||'No se pudo exportar')}finally{setExportBusy(false)}
 };
 const setView=(key)=>{closeDetail();onNavigate(key)};
 return <div className="ai-shell">
 <div className="ai-head"><div><span className="ai-eyebrow">V09 · AUDITORÍA CONTRACTUAL Y ESTIMACIÓN INCREMENTAL</span>
 <h2>{detail?'Detalle de requerimiento':view==='resumen'?'Diagnóstico ejecutivo consolidado':view==='matriz318'?'Matriz integral de 318 solicitudes':view==='obligaciones318'?'Obligaciones contractuales de Softplan':view==='brechasLaboral'?'Brechas Laboral y trazabilidad SDO':view==='avancev08'?'Avance de estimación V08':view==='exclusionesr48'?'Exclusiones R48':view==='solapamientosv08'?'Solapamientos y componentes compartidos':'Auditoría integral'}</h2>
 <p>Fuente Neon · corte dinámico {snap?.generatedAt?new Date(snap.generatedAt).toLocaleString('es-PE'):'pendiente'} · todas las horas son técnicas, no aprobaciones contractuales</p></div>
 <button className="ai-btn secondary" disabled={state.loading} onClick={()=>refresh(true)}><RefreshCw size={16} className={state.loading?'spin':''}/> Actualizar Neon</button></div>
 {exportError&&<div className="ai-error" role="alert">Error de exportación: {exportError}</div>}
 {state.error&&<div className="ai-error"><AlertTriangle size={19}/><div>{state.error}<small>La consulta histórica de documentos sigue disponible en el dashboard original.</small></div></div>}
 {state.loading&&!snap&&<div className="ai-loading">Consultando 318 solicitudes, brechas Laboral y estimaciones WBS en Neon…</div>}
 {snap&&<>
 {detail?<RequestDetail code={detail} onClose={closeDetail} onSdo={code=>onNavigate('sdo',code,{kind:'sdo',id:code})}/>:
 <>
 {['resumen','matriz318','obligaciones318'].includes(view)&&<FilterBar rows={all} filters={filters} setFilters={setFilters} clear={()=>setFilters({...initialFilters})}/>}
 <div className="ai-toolbar"><span><Filter size={14}/>{fmt(filtered.length)} de {fmt(all.length)} solicitudes {view==='brechasLaboral'?'· '+fmt(snap.gaps.length)+' registros Laboral':''}</span>
 <div><button className="ai-btn secondary" disabled={exportBusy} onClick={exportFull}><Download size={15}/> {exportBusy?"Preparando Excel…":"Excel 318 completo"}</button><button className="ai-btn primary" onClick={()=>exportAuditPptx(snap,filtered)}><BarChart3 size={15}/> PowerPoint gerencial</button></div></div>
 {view==='resumen'&&<Overview rows={filtered} snapshot={snap} m={metrics} onOpen={openDetail} onSwitch={setView}/>}
 {view==='matriz318'&&<><div className="ai-toolbar"><span>Orden de la matriz</span><div><select className="ai-order" value={orderBy} onChange={e=>setOrderBy(e.target.value)}><option value="code">Código</option><option value="area">Área</option><option value="eligibility">Elegibilidad</option><option value="v08_agent">Agente V08</option><option value="estimate_status">Estado V08</option><option value="hours">Horas PERT</option></select><button className="ai-btn secondary" onClick={()=>setAscending(p=>!p)}>{ascending?'Ascendente':'Descendente'}</button></div></div><Matrix rows={visible} onOpen={openDetail}/><Pagination page={page} setPage={setPage} total={matched.length} pageSize={pageSize}/></>}
 {view==='obligaciones318'&&<Obligations rows={filtered} sdoCatalog={snap.sdo||[]} onOpen={openDetail} onSdo={code=>onNavigate('sdo',code,{kind:'sdo',id:code})}/>}
 {view==='brechasLaboral'&&<GapTable gaps={snap.gaps||[]} rows={all} onOpen={openDetail} onSdo={code=>onNavigate('sdo',code,{kind:'sdo',id:code})}/>}
 {view==='avancev08'&&<AgentProgress snap={snap} rows={all} onOpen={openDetail}/>}
 {view==='exclusionesr48'&&<Exclusions rows={all} onOpen={openDetail} r48={snap.r48}/>}
 {view==='solapamientosv08'&&<Overlaps snap={snap} rows={all} onOpen={openDetail}/>}
 <p className="ai-footer">Consulta de solo lectura. Las solicitudes sin estimación no tienen horas inventadas. El escenario condicionado no se suma al firme; las aprobaciones contractuales requieren resolución institucional verificable.</p>
 </>}
 </>}
 </div>;
}
