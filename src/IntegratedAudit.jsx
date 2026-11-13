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
 const counts=Object.entries(rows.reduce((a,r)=>(a[r.eligibility||'Sin clasificación']=(a[r.eligibility||'Sin clasificación']||0)+1,a),{})).sort((a,b)=>b[1]-a[1]);
 const ex=Object.entries(rows.filter(x=>x.eligibility==='EXCLUIDO').reduce((a,r)=>(a[r.v07_category||'Sin causa']=(a[r.v07_category||'Sin causa']||0)+1,a),{})).sort((a,b)=>b[1]-a[1]);
 const agents=(snapshot.agents||[]).map(a=>({...a,items:rows.filter(r=>r.v08_agent===a.agent_id)}));
 return <div className="ai-flow">
 <div className="ai-metrics">
  <Metric label="Solicitudes analizadas" value={fmt(m.total)} help="Una fila por código original"/>
  <Metric label="Obligación SDO vinculada" value={fmt(m.sdoCovered)} help="Exclusiones con SDO identificado; cumplimiento no inferido"/>
  <Metric label="Brecha contractual vinculada" value={fmt(m.gapCovered)} help="Exclusiones con brecha identificada"/>
  <Metric label="Incrementales firmes" value={fmt(m.firm)}/>
  <Metric label="Estimables condicionales" value={fmt(m.conditional)} flag="caution"/>
  <Metric label="Excluidos" value={fmt(m.excluded)} help="Sin esfuerzo incremental propio"/>
  <Metric label="Estimaciones WBS cerradas" value={fmt(m.estimated)}/>
  <Metric label="Pendientes de estimar" value={fmt(m.pending)}/>
  <Metric label="Horas firmes PERT" value={fmtHours(m.firmHours.pert)} flag="primary"/>
  <Metric label="Horas condicionadas PERT" value={fmtHours(m.conditionalHours.pert)} flag="caution"/>
  <Metric label="QA técnico pendiente" value={fmt(m.pendingQA)} help={m.qaHours===null?'Horas QA: aún sin validación':fmtHours(m.qaHours)+' aceptadas'}/>
  <Metric label="Solapamientos sin resolver" value={fmt(m.overlaps)} help="Los totales brutos pueden requerir conciliación"/>
 </div>
 <div className="ai-columns">
  <Block title="Elegibilidad actual" subtitle="Distribución de solicitudes filtradas; revisión V2 vigente">
   {counts.map(([n,v])=><Bar key={n} name={labels[n]||n} value={v} max={m.total}/>)}
  </Block>
  <Block title="Escenarios de esfuerzo" subtitle="No mezclar esfuerzo firme y condicionado; horas-persona">
   <div className="ai-scenarios">
   <h4>Incremental firme</h4>{[['Optimista','optimistic'],['Más probable','mostLikely'],['Esperado PERT','pert'],['Pesimista','pessimistic'],['Contingencia aparte','contingency']].map(([k,f])=><div key={k}><span>{k}</span><b>{fmtHours(m.firmHours[f])}</b></div>)}
   <h4>Condicional, separado</h4>{[['Optimista','optimistic'],['Más probable','mostLikely'],['Esperado PERT','pert'],['Pesimista','pessimistic']].map(([k,f])=><div key={k}><span>{k}</span><b>{fmtHours(m.conditionalHours[f])}</b></div>)}
   <h4>Autorización</h4><div><span>Horas técnicamente aceptadas</span><b>{fmtHours(m.qaHours)}</b></div><div><span>Horas contractualmente aprobadas</span><b>Sin aprobación verificada</b></div>
   </div>
  </Block>
  <Block title="Exclusiones por causa" subtitle="No toda exclusión constituye obligación contractual de Softplan">{ex.map(([n,v])=><Bar key={n} name={labels[n]||n} value={v} max={Math.max(1,m.excluded)}/>)}</Block>
  <Block title="Avance de las ventanas V08" subtitle="Estimaciones cerradas frente a asignaciones en la selección">
   {(snapshot.agents||[]).map(a=><Bar key={a.agent_id} name={a.agent_id+' · '+a.focus} value={rows.filter(r=>r.v08_agent===a.agent_id&&isEstimated(r)).length} max={Math.max(1,rows.filter(r=>r.v08_agent===a.agent_id).length)} label={rows.filter(r=>r.v08_agent===a.agent_id&&isEstimated(r)).length+' / '+rows.filter(r=>r.v08_agent===a.agent_id).length}/>)}
  </Block>
 </div>
 <Block title="Lectura ejecutiva" subtitle="Hechos, interpretaciones y decisiones pendientes sin confundirlas">
  <div className="ai-four">
   <div><b>Hechos verificados</b><p>{m.total} solicitudes en esta selección; {m.estimated} con actividades WBS cerradas. Se registran {m.overlaps} pares de solapamiento pendiente o no resuelto.</p></div>
   <div><b>Conclusión técnica</b><p>La suma PERT firme es {fmtHours(m.firmHours.pert)} y la condicional {fmtHours(m.conditionalHours.pert)}. Son propuestas, no horas aprobadas.</p></div>
   <div><b>Condiciones pendientes</b><p>{m.pendingQA} estimaciones carecen de QA técnico registrado. Las clasificaciones contractuales no demuestran por sí solas funcionamiento.</p></div>
   <div><b>Recomendación</b><p>V00 debe conciliar solapamientos y QA. GSJ/GTI deben verificar capacidades originales y supuestos; PEJENP determina la procedencia contractual.</p></div>
  </div>
 </Block>
 <div className="ai-actions"><button className="ai-btn primary" onClick={()=>onSwitch('matriz318')}>Examinar matriz integral <ChevronRight size={16}/></button><button className="ai-btn secondary" onClick={()=>onSwitch('avancev08')}>Seguimiento por agente</button></div>
 </div>;
}
function Matrix({rows,onOpen}){
 return <Tabular headers={['Código / lote','Solicitud original','Área','Evaluación V07','Elegibilidad V2','Obligación SDO / brecha','Alcance incremental','Agente / estado V08','Método','O (h)','M (h)','PERT (h)','P (h)','QA','Detalle']}>
 {rows.map(r=><tr key={r.code}>
 <td><strong>{r.code}</strong><small>{r.batch} · fila {r.source_row}</small></td>
 <td className="ai-long">{r.description}</td><td>{r.area}</td>
 <td><Chip>{labels[r.v07_category]||alt(r.v07_category)}</Chip><small>{r.qa_v07||'Sin QA'}</small></td>
 <td><Chip tone={r.eligibility==='INCREMENTAL'?'yes':r.eligibility==='CONDICIONAL'?'conditional':'no'}>{labels[r.eligibility]||alt(r.eligibility)}</Chip></td>
 <td><small>SDO: {(r.sdo_links||[]).map(s=>s.code).join(', ')||'Sin vínculo'}</small><small>Brecha: {(r.gap_links||[]).map(s=>s.id).join(', ')||'Sin vínculo'}</small></td>
 <td className="ai-long">{alt(r.incremental_delta,r.eligibility==='EXCLUIDO'?alt(r.exclusion_zero_reason,r.exclusion_reason):'Pendiente de deslinde')}</td>
 <td>{alt(r.v08_agent)}<small>{r.estimate_status||'Sin unidad'}</small></td>
 <td>{isEstimated(r)?'WBS + 3 puntos + PERT':'Sin estimación'}</td>
 {['optimistic','most_likely','pert_expected','pessimistic'].map(k=><td key={k} className="ai-num">{isEstimated(r)?fmt2(r[k]):r.eligibility==='EXCLUIDO'?'0':'Pendiente'}</td>)}
 <td>{alt(r.qa_outcome,'Pendiente QA')}</td>
 <td><button className="ai-btn small" onClick={()=>onOpen(r.code)}>Ver ficha <ChevronRight size={14}/></button></td>
 </tr>)}</Tabular>;
}
function Obligations({rows,onOpen,onSdo,sdoCatalog=[]}){
 const bySdo=new Map(sdoCatalog.map(x=>[x.code,x]));
 const excluded=rows.filter(r=>r.eligibility==='EXCLUIDO');
 return <Block title="Obligaciones contractuales y exclusiones" subtitle="La obligación contractual y su cumplimiento operativo se informan por separado. No toda exclusión corresponde a Softplan.">
 <Tabular headers={['Solicitud','Motivo de exclusión','SDO contractual identificado','Brecha vinculada','Equivalencia funcional','Estado de cumplimiento','Esfuerzo adicional','Sustento']}>
 {excluded.map(r=><tr key={r.code}><td><button className="ai-btn small" onClick={()=>onOpen(r.code)}>{r.code}</button><small>{r.description?.slice(0,120)}</small></td>
 <td>{labels[r.v07_category]||r.v07_category||'Sin causa sustentada'}<small>{r.v2_decision}</small></td>
 <td>{(r.sdo_links||[]).length?r.sdo_links.map(s=><div key={s.code}><button className="ai-link" onClick={()=>onSdo(s.code)}>{s.code}</button><small>{(bySdo.get(s.code)?.description||'Sin texto contractual localizado').slice(0,300)}</small></div>):'Sin SDO vinculado'}</td>
 <td>{(r.gap_links||[]).map(s=>s.id).join(', ')||'Sin brecha vinculada'}</td>
 <td className="ai-long">{alt(r.sdo_equivalence,r.original_covered_scope||r.exclusion_zero_reason)}</td>
 <td>Por verificar funcionalmente<small>SDO ≠ cumplimiento demostrado</small></td>
 <td><b>0 h propias</b></td><td>{alt(r.exclusion_zero_reason,r.exclusion_reason||r.estimation_exclusions)}</td>
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
 const agents=snap.agents||[];
 return <Block title="Avance por especialidad y agente V08" subtitle="Las cifras mostradas se recalculan con las solicitudes filtradas; el estado operativo global se indica debajo.">
 <Tabular headers={['Agente / especialidad','Asignadas','En curso','Estimadas','Pendientes','Bloqueadas','Horas firmes PERT','Horas condicionadas PERT','QA','Solicitudes']}>
 {agents.map(a=>{const mine=rows.filter(r=>r.v08_agent===a.agent_id),est=mine.filter(isEstimated);
 return <tr key={a.agent_id}><td><b>{a.agent_id}</b><small>{a.focus}</small></td><td>{mine.length}</td><td>{mine.filter(r=>r.estimate_status==='En curso').length}</td><td>{est.length}</td><td>{mine.filter(r=>r.estimate_status==='Pendiente').length}</td><td>{mine.filter(r=>r.estimate_status==='Bloqueado').length}</td>
 <td>{fmtHours(est.filter(r=>r.eligibility==='INCREMENTAL').reduce((s,r)=>s+Number(r.pert_expected||0),0))}</td>
 <td>{fmtHours(est.filter(r=>r.eligibility==='CONDICIONAL').reduce((s,r)=>s+Number(r.pert_expected||0),0))}</td><td>{est.filter(r=>!r.qa_outcome).length} pendiente(s)</td>
 <td><details><summary>Ver {mine.length} solicitudes</summary>{mine.map(r=><button key={r.code} className="ai-link" onClick={()=>onOpen(r.code)}>{r.code}</button>)}</details></td></tr>})}</Tabular>
 <p className="ai-note">Estado operativo Neon: {agents.reduce((s,a)=>s+Number(a.assigned||0),0)} asignadas; {agents.reduce((s,a)=>s+Number(a.estimated||0),0)} estimadas. Las horas de esta tabla corresponden únicamente a la selección filtrada.</p>
 </Block>;
}
function Exclusions({rows,onOpen,r48}){
 const source=rows.filter(r=>['CONFIGURACION_SIN_INCREMENTO','FUERA_ALCANCE_BOLSA'].includes(r.source_category||r.v07_category));
 return <Block title="Exclusiones en revisión paralela R48" subtitle="Se conserva la decisión V2 y se distingue de una revisión R48 no registrada. El universo histórico de 48 debe conciliarse con la clasificación actual.">
 <div className="ai-callout"><AlertTriangle size={19}/><span>{r48?.notice||'R48 sin resolución verificable.'} Se identifican {source.length} solicitudes según categorías actualmente registradas.</span></div>
 <Tabular headers={['Solicitud','Clasificación anterior','Dictamen V2 actual','Cobertura SDO / brecha','Equivalencia','Estado R48','Evaluación y evidencia']}>
 {source.map(r=><tr key={r.code}><td><button className="ai-btn small" onClick={()=>onOpen(r.code)}>{r.code}</button><small>{r.description.slice(0,135)}</small></td><td>{labels[r.source_category||r.v07_category]||r.source_category||r.v07_category}</td><td><Chip>{labels[r.eligibility]||r.eligibility}</Chip><small>{r.v2_decision}</small></td><td>SDO: {(r.sdo_links||[]).map(s=>s.code).join(', ')||'No localizado'}<small>Brechas: {(r.gap_links||[]).map(g=>g.id).join(', ')||'No registradas'}</small></td><td className="ai-long">{alt(r.sdo_equivalence,r.original_covered_scope)}</td><td><Chip tone="conditional">Pendiente de registro R48</Chip></td><td>{alt(r.quality_reason,r.technical_basis)}</td></tr>)}</Tabular>
 </Block>;
}
function Overlaps({snap,rows,onOpen}){
 const byId=new Map(rows.map(r=>[String(r.id),r.code]));
 return <div className="ai-flow">
 <Block title="Solapamientos y doble contabilización" subtitle="Una relación pendiente no constituye automáticamente duplicidad; V00 debe cerrar el deslinde de los paquetes WBS.">
 <Tabular headers={['Solicitud A','Solicitud B','Relación','Agentes','Situación','Sustento / resolución']}>
 {(snap.overlaps||[]).filter(o=>rows.some(r=>String(r.id)===String(o.request_a)||String(r.id)===String(o.request_b))).map((o,i)=><tr key={i}><td><button className="ai-link" onClick={()=>onOpen(o.code_a)}>{o.code_a}</button></td><td><button className="ai-link" onClick={()=>onOpen(o.code_b)}>{o.code_b}</button></td><td>{o.relation_types}</td><td>{o.agent_a} / {o.agent_b}</td><td><Chip tone={o.status==='PENDIENTE_WBS'?'conditional':'yes'}>{o.status}</Chip></td><td>{o.resolution_basis}</td></tr>)}</Tabular>
 </Block>
 <Block title="Componentes compartidos" subtitle="El costo de construcción corresponde a un solo propietario; los consumidores solo imputan adaptación adicional.">
 <Tabular headers={['Clave','Responsable único','Estado','Descripción','Solicitudes relacionadas']}>
 {(snap.components||[]).map(c=><tr key={c.component_key}><td><b>{c.component_key}</b></td><td>{c.owner_agent}</td><td>{c.status}</td><td className="ai-long">{c.description}</td><td>{(c.dependencies||[]).map(code=><button key={code} className="ai-link" onClick={()=>onOpen(code)}>{code}</button>)}</td></tr>)}</Tabular>
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
 const setView=(key)=>{closeDetail();onNavigate(key)};
 return <div className="ai-shell">
 <div className="ai-head"><div><span className="ai-eyebrow">V09 · AUDITORÍA CONTRACTUAL Y ESTIMACIÓN INCREMENTAL</span>
 <h2>{detail?'Detalle de requerimiento':view==='resumen'?'Diagnóstico ejecutivo consolidado':view==='matriz318'?'Matriz integral de 318 solicitudes':view==='obligaciones318'?'Obligaciones contractuales de Softplan':view==='brechasLaboral'?'Brechas Laboral y trazabilidad SDO':view==='avancev08'?'Avance de estimación V08':view==='exclusionesr48'?'Exclusiones R48':view==='solapamientosv08'?'Solapamientos y componentes compartidos':'Auditoría integral'}</h2>
 <p>Fuente Neon · corte dinámico {snap?.generatedAt?new Date(snap.generatedAt).toLocaleString('es-PE'):'pendiente'} · todas las horas son técnicas, no aprobaciones contractuales</p></div>
 <button className="ai-btn secondary" disabled={state.loading} onClick={()=>refresh(true)}><RefreshCw size={16} className={state.loading?'spin':''}/> Actualizar Neon</button></div>
 {state.error&&<div className="ai-error"><AlertTriangle size={19}/><div>{state.error}<small>La consulta histórica de documentos sigue disponible en el dashboard original.</small></div></div>}
 {state.loading&&!snap&&<div className="ai-loading">Consultando 318 solicitudes, brechas Laboral y estimaciones WBS en Neon…</div>}
 {snap&&<>
 {detail?<RequestDetail code={detail} onClose={closeDetail} onSdo={code=>onNavigate('sdo',code,{kind:'sdo',id:code})}/>:
 <>
 {['resumen','matriz318','obligaciones318'].includes(view)&&<FilterBar rows={all} filters={filters} setFilters={setFilters} clear={()=>setFilters({...initialFilters})}/>}
 <div className="ai-toolbar"><span><Filter size={14}/>{fmt(filtered.length)} de {fmt(all.length)} solicitudes {view==='brechasLaboral'?'· '+fmt(snap.gaps.length)+' registros Laboral':''}</span>
 <div><button className="ai-btn secondary" onClick={()=>exportAuditXlsx(filtered)}><Download size={15}/> Excel 318</button><button className="ai-btn primary" onClick={()=>exportAuditPptx(snap,filtered)}><BarChart3 size={15}/> PowerPoint gerencial</button></div></div>
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
