import React,{useCallback,useEffect,useMemo,useState} from 'react';
import { toSafeCsv } from './csv-utils.js';
import { getSdoPhaseInfo } from './sdo-phases.js';
import { RefreshCw, Download, ExternalLink, Search, Clock3, FileCheck2, FileWarning, ShieldCheck, ChevronDown, X } from 'lucide-react';
import './sdo-tracking.css';
const labelQa={pendiente:'QA pendiente',observado:'QA observado',conforme_delta:'QA conforme parcial / delta',conforme_integral:'QA conforme integral'};
const qaOrder=['pendiente','observado','conforme_delta','conforme_integral'];
const dateValue=value=>value?new Date(value).toLocaleString('es-PE',{dateStyle:'short',timeStyle:'short'}):'No disponible';
const text=(v,def='No informado')=>String(v||'').trim()||def;
function Link({href,children}) {return href?<a className="sdo-link" href={href} target="_blank" rel="noopener noreferrer">{children} <ExternalLink size={13}/></a>:<span className="sdo-muted">Sin enlace</span>;}
function Stat({name,value,subtitle}) {return <div className="sdo-stat"><span>{name}</span><strong>{value}</strong><small>{subtitle}</small></div>;}
function safeCsvDownload(rows,name) {
  const csv=toSafeCsv(rows);
  const objectUrl=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=objectUrl;a.download=name;a.click();URL.revokeObjectURL(objectUrl);
}
export default function SdoTracking({token}) {
  const [snapshot,setSnapshot]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [query,setQuery]=useState(''),[phase,setPhase]=useState('Todas'),[agent,setAgent]=useState('Todos'),[qa,setQa]=useState('Todos'),[proposal,setProposal]=useState('Todos');
  const [order,setOrder]=useState('source'),[page,setPage]=useState(1),[selected,setSelected]=useState(''),[detail,setDetail]=useState(null),[detailError,setDetailError]=useState(''),[syncing,setSyncing]=useState(false),[syncMessage,setSyncMessage]=useState('');
  const load=useCallback(async()=>{
    try{
      const response=await fetch('/api/sdo-documents',{cache:'no-store'});
      if(!response.ok)throw new Error('No fue posible recuperar el espejo documental (HTTP '+response.status+')');
      const result=await response.json();
      if(!Array.isArray(result.documents))throw new Error('Respuesta documental inválida');
      setSnapshot(result);setError('');
    }catch(e){setError(e.message||'No disponible');}finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();const timer=setInterval(load,120000);return()=>clearInterval(timer);},[load]);
  useEffect(()=>{
    if(!selected||!token){setDetail(null);setDetailError('');return;}
    const controller=new AbortController();
    setDetail(null);setDetailError('');
    fetch('/api/sdo-document-detail?code='+encodeURIComponent(selected),{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controller.signal})
      .then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error||'Ficha no disponible');return body;})
      .then(setDetail).catch(e=>{if(!controller.signal.aborted)setDetailError(e.message);});
    return()=>controller.abort();
  },[selected,token]);
  useEffect(()=>setPage(1),[query,phase,agent,qa,proposal,order]);
  const docs=snapshot?.documents||[];
  const phases=useMemo(()=>[...new Set(docs.map(d=>d.phase))].sort((a,b)=>Number(a)-Number(b)),[docs]);
  const agents=useMemo(()=>[...new Set(docs.map(d=>d.agent))].sort(),[docs]);
  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase('es');
    return docs.filter(d=>{
      const match=!q||[d.code,d.title,d.agent,d.audit_state].some(v=>String(v||'').toLocaleLowerCase('es').includes(q));
      return match&&(phase==='Todas'||d.phase===phase)&&(agent==='Todos'||d.agent===agent)&&(qa==='Todos'||d.qa_category===qa)
        &&(proposal==='Todos'||(proposal==='Con propuesta')===Boolean(d.proposal_url));
    }).sort((a,b)=>order==='name'?a.title.localeCompare(b.title,'es'):order==='updated'?new Date(b.changed_at)-new Date(a.changed_at):order==='phase'?Number(a.phase)-Number(b.phase)||a.source_row-b.source_row:a.source_row-b.source_row);
  },[docs,query,phase,agent,qa,proposal,order]);
  const pageSize=15,numberOfPages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const visible=filtered.slice((Math.min(page,numberOfPages)-1)*pageSize,Math.min(page,numberOfPages)*pageSize);
  const proposed=docs.filter(d=>d.proposal_url).length;
  const qaCounts=Object.fromEntries(qaOrder.map(v=>[v,docs.filter(d=>d.qa_category===v).length]));
  const opinion=docs.filter(d=>d.technical_opinion_present).length;
  const originals=docs.filter(d=>d.original_identified).length;
  const integrated=docs.filter(d=>d.integrated_in_original).length;
  const lastSuccess=snapshot?.lastSuccessfulSync?.executed_at||null;
  const ageMinutes=lastSuccess?Math.floor((Date.now()-new Date(lastSuccess).getTime())/60000):null;
  function exportCsv(){
    safeCsvDownload([['ID SDO','Fase','Documento','Agente','Auditoría','Inventario','Original identificado','Opinión técnica','Propuesta URL','QA','Último cambio','Referencia Matriz'],...filtered.map(d=>[d.code,d.phase,d.title,d.agent,d.audit_state,d.inventory_state,d.original_identified?'Sí':'Sin acreditar',d.technical_opinion_present?'Sí':'No',d.proposal_url,labelQa[d.qa_category],d.changed_at,d.sheet_url])],'seguimiento_documental_sdo.csv');
  }
  async function manualSync(){
    if(!token)return;
    setSyncing(true);setSyncMessage('');
    try{
      const response=await fetch('/api/sdo-sync',{method:'POST',headers:{Authorization:'Bearer '+token}});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||'No se pudo sincronizar');
      setSyncMessage('Sincronizado: '+body.source_count+' documentos; '+body.changed_count+' cambios.');
      await load();
    }catch(e){setSyncMessage(e.message||'Error de sincronización');}
    finally{setSyncing(false);}
  }
  return <div className="sdo-tracking">
    <div className="sdo-actions">
      <span className="sdo-muted">Fuente oficial de seguimiento: Catalogo_83. Refresco visual cada 2 minutos.</span>
      <button className="outline-btn" onClick={load} disabled={loading}><RefreshCw size={15}/> Actualizar vista</button>
      {token&&<button className="outline-btn" onClick={manualSync} disabled={syncing}><RefreshCw size={15}/> {syncing?'Sincronizando':'Sincronizar Sheets'}</button>}
      <button className="outline-btn" onClick={exportCsv} disabled={!docs.length}><Download size={15}/> Exportar CSV / Excel</button>
    </div>
    {syncMessage&&<div className="sdo-alert" role="status">{syncMessage}</div>}
    {error&&<div className="error-banner" role="alert">{error}. Se conserva en pantalla el último corte consultado.</div>}
    {loading&&!snapshot&&<div className="panel sdo-placeholder">Cargando seguimiento documental…</div>}
    {snapshot&&<><div className="sdo-timestamp"><Clock3 size={15}/><span>Última sincronización: <b>{dateValue(lastSuccess)}</b> · Antigüedad: <b>{ageMinutes==null?'Desconocida':ageMinutes+' min'}</b> · Última consulta: {dateValue(snapshot.generatedAt)}</span></div>
      {!snapshot.sync?.success&&<div className="sdo-alert">Última sincronización fallida o no registrada. Los datos mostrados pertenecen al último corte disponible.</div>}
      {docs.length!==83&&<div className="error-banner">Inconsistencia: Neon contiene {docs.length} registros. Se requieren 83 códigos únicos.</div>}
      <div className="sdo-kpi">
        <Stat name="Documentos SDO" value={docs.length} subtitle="Universo documental, no requisitos"/>
        <Stat name="Originales identificados" value={originals} subtitle="ID o enlace citado, requiere contraste"/>
        <Stat name="Opinión técnica" value={opinion} subtitle="Registro de opinión, no aprobación"/>
        <Stat name="Con propuesta" value={proposed} subtitle="URL de versión corregida"/>
        <Stat name="Sin propuesta" value={docs.length-proposed} subtitle="Pendiente de documento corregido"/>
        <Stat name="QA pendiente" value={qaCounts.pendiente} subtitle="Incluye documentos sin propuesta"/>
        <Stat name="QA observado" value={qaCounts.observado} subtitle="Observación explícita en Z"/>
        <Stat name="QA conforme delta" value={qaCounts.conforme_delta} subtitle="Conformidad parcial, no integral"/>
        <Stat name="QA conforme integral" value={qaCounts.conforme_integral} subtitle="Solo si se declara explícitamente"/>
        <Stat name="Integrados en originales" value={integrated} subtitle="Solo integración explícitamente acreditada"/>
      </div>
      <div className="sdo-chartrow">
        <section className="panel sdo-panel"><h2>Avance de propuestas por fase</h2><p className="sdo-muted">Las propuestas no equivalen a subsanaciones, QA o conformidades.</p>
          {phases.map(f=>{const set=docs.filter(d=>d.phase===f);const n=set.filter(d=>d.proposal_url).length;const info=getSdoPhaseInfo(f);return <div key={f} className="sdo-phase" title={info.description}><span className="sdo-phase-name"><b>Fase {f}</b><small>{info.name}</small></span><div className="sdo-track" aria-label={n+' propuestas de '+set.length+' documentos'}><div style={{width:(100*n/Math.max(1,set.length))+'%'}}/></div><b>{n}/{set.length}</b></div>;})}
        </section>
        <section className="panel sdo-panel"><h2>Evolución de modificaciones</h2><p className="sdo-muted">Historial del espejo Neon, no fecha de edición de Google Drive.</p>
          {(snapshot.changes||[]).length===0?<p>No hay historial disponible.</p>:<div className="sdo-evolution">{snapshot.changes.map((d,i)=><div key={i} className="sdo-trend" title={d.day+': '+d.changes+' versiones'}><div style={{height:(12+88*Number(d.changes)/Math.max(1,...snapshot.changes.map(x=>Number(x.changes))))+'%'}}/><span>{String(d.day).slice(5)}</span></div>)}</div>}
        </section>
      </div>
      <section className="panel sdo-panel sdo-phase-glossary" aria-labelledby="sdo-phase-guide-title">
        <h2 id="sdo-phase-guide-title">¿Qué significa cada fase?</h2>
        <p className="sdo-muted">Denominaciones descriptivas basadas en los productos del catálogo de 83 documentos. No sustituyen las denominaciones contractuales ni indican conformidad.</p>
        <div className="sdo-phase-cards">{phases.map(f=>{const info=getSdoPhaseInfo(f);const total=docs.filter(d=>d.phase===f).length;return <article key={f} className="sdo-phase-card">
          <div className="sdo-phase-card-heading"><strong>Fase {f}</strong><span>{total} {total===1?'documento':'documentos'}</span></div>
          <h3>{info.name}</h3><p>{info.description}</p>
        </article>;})}</div>
      </section>
      <section className="sdo-filters">
        <label><Search size={15}/><input aria-label="Buscar documentos" placeholder="Buscar código, documento, agente o QA" value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <select aria-label="Filtrar fase" value={phase} onChange={e=>setPhase(e.target.value)}><option>Todas</option>{phases.map(p=><option key={p} value={p}>Fase {p} · {getSdoPhaseInfo(p).name}</option>)}</select>
        <select aria-label="Filtrar agente" value={agent} onChange={e=>setAgent(e.target.value)}><option>Todos</option>{agents.map(a=><option key={a}>{a}</option>)}</select>
        <select aria-label="Filtrar QA" value={qa} onChange={e=>setQa(e.target.value)}><option>Todos</option>{qaOrder.map(k=><option key={k} value={k}>{labelQa[k]}</option>)}</select>
        <select aria-label="Filtrar propuestas" value={proposal} onChange={e=>setProposal(e.target.value)}><option>Todos</option><option>Con propuesta</option><option>Sin propuesta</option></select>
        <select aria-label="Ordenar" value={order} onChange={e=>setOrder(e.target.value)}><option value="source">Orden matriz</option><option value="name">Nombre A-Z</option><option value="phase">Fase</option><option value="updated">Cambio reciente</option></select>
      </section>
      <p className="sdo-muted">{filtered.length} de {docs.length} documentos · Datos derivados, sin modificar estados contractuales de la matriz.</p>
      <section className="table-panel"><div className="table-scroll"><table className="sdo-table"><thead><tr><th>SDO / Documento</th><th>Fase / Agente</th><th>Original</th><th>Opinión técnica</th><th>Corregido</th><th>QA</th><th>Último cambio</th><th>Detalle</th></tr></thead>
      <tbody>{visible.map(d=><React.Fragment key={d.code}><tr><td><b>{d.code}</b><p>{d.title}</p></td><td><b>Fase {d.phase} · {getSdoPhaseInfo(d.phase).name}</b><br/>{d.agent}</td><td><Link href={d.original_url||d.source_url}>{d.original_url?'Archivo citado':'Fuente / carpeta'}</Link></td><td>{d.technical_opinion_present?<Link href={d.technical_opinion_url}>Opinión técnica</Link>:<span className="sdo-muted">Sin registro</span>}</td><td><Link href={d.proposal_url}>Propuesta</Link></td><td><span className={'sdo-qa '+d.qa_category}>{labelQa[d.qa_category]}</span></td><td>{dateValue(d.changed_at)}</td><td><button className="outline-btn" onClick={()=>setSelected(selected===d.code?'':d.code)} aria-expanded={selected===d.code}>{selected===d.code?'Cerrar':'Ver ficha'} <ChevronDown size={13}/></button></td></tr>
      {selected===d.code&&<tr className="sdo-expanded"><td colSpan={8}>
        <div className="sdo-detail"><div><h3>SDO {d.code} · {d.title}</h3><p><b>Fase {d.phase}: {getSdoPhaseInfo(d.phase).name}.</b> {getSdoPhaseInfo(d.phase).description}</p><p><b>Estado auditoría:</b> {text(d.audit_state)} · <b>Inventario:</b> {text(d.inventory_state)}</p><p><b>Resultado de QA:</b> {text(labelQa[d.qa_category])}. Observaciones detalladas disponibles con acceso institucional.</p><p><b>Fuente:</b> <Link href={d.sheet_url}>Fila {d.source_row} de matriz maestra</Link></p><p><b>Última variación observada:</b> {dateValue(d.changed_at)} · Versión del espejo: {d.version}</p>
          {!token&&<p className="sdo-alert">Inicia sesión institucional para consultar el detalle de opinión, pendientes y versiones anteriores.</p>}
          {detailError&&<p className="error-banner">{detailError}</p>}
        </div>{token&&detail?.document?.code===d.code&&<div className="sdo-protected"><h3>Detalle técnico con acceso institucional</h3><p><b>Original / localizador:</b> {text(detail.document.original_reference)}</p><p><b>Problemas y opinión técnica:</b> {text(detail.document.technical_opinion)}</p><p><b>Validación adicional:</b> {text(detail.document.external_validation)}</p><p><b>Observaciones y estado QA:</b> {text(detail.document.correction_qa)}</p><p><b>Solución / documento corregido:</b> <Link href={d.proposal_url}>Abrir propuesta</Link></p><h3>Versiones y campos modificados</h3>{detail.changes.map((v,i)=><p key={i}>V{v.version} · {dateValue(v.changed_at)} · {v.changed_fields?.join(', ')||'Sin desglose'}</p>)}</div>}
        </div>
      </td></tr>}</React.Fragment>)}</tbody></table>
      {visible.length===0&&<div className="sdo-placeholder">Sin documentos que coincidan con los filtros.</div>}</div></section>
      <div className="sdo-pager"><span>Página {Math.min(page,numberOfPages)} de {numberOfPages}</span><div><button className="outline-btn" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</button><button className="outline-btn" disabled={page>=numberOfPages} onClick={()=>setPage(p=>p+1)}>Siguiente</button></div></div>
      <p className="sdo-muted">Agentes A00, A01/A02, G1, A09/A10 y A11: no se presentan ejecuciones sin una fuente de registros técnicos verificable. La matriz documenta responsabilidades, no prueba ejecución automática.</p>
    </>}
  </div>;
}
