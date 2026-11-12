import React, {useEffect,useState} from 'react';
import {AlertCircle, FileText, ShieldCheck} from 'lucide-react';

const txt=v=>v===null||v===undefined||v===''?'Sin registro':typeof v==='object'?JSON.stringify(v,null,2):String(v);
const safeUrl=url=>typeof url==='string'&&/^https:\/\//i.test(url)?url:null;

function Note({label,value}) {
  return <div className="institutional-note"><strong>{label}</strong><p>{txt(value)}</p></div>;
}
function LinkedDocument({item,onNavigate}) {
  const id=item.document_id||item.id;
  const url=safeUrl(item.document_url||item.url);
  return <div className="institutional-linked">
    {id&&<button className="outline-btn" onClick={()=>onNavigate('document',id)}>{item.document_title||item.title||'Ver documento'}</button>}
    {url&&<a className="doc-link" href={url} target="_blank" rel="noopener noreferrer">Abrir fuente original</a>}
    {item.rationale&&<Note label="Justificación documental" value={item.rationale}/>}
    {item.confidence&&<p className="mini">Confianza: {item.confidence}</p>}
  </div>;
}
function Assessment({item,onNavigate}) {
  return <details className="institutional-assessment">
    <summary><b>{item.sdo_code||item.criterion||'Evaluación'}</b> · {item.coverage||'Sin cobertura'} · {item.review_level||'Sin nivel'} · {item.document_title||''}</summary>
    {item.document_id&&<button className="outline-btn" onClick={()=>onNavigate('document',item.document_id)}>Ver documento relacionado</button>}
    {item.sdo_code&&<button className="outline-btn" onClick={()=>onNavigate('sdo',item.sdo_code)}>Ver requisito SDO</button>}
    <Note label="Criterio" value={item.criterion}/>
    <Note label="Hallazgo" value={item.finding}/>
    <Note label="Validación pendiente" value={item.missing_validation}/>
    <Note label="Fuente y localizador" value={item.source_detail}/>
    {safeUrl(item.document_url)&&<a className="doc-link" target="_blank" rel="noopener noreferrer" href={item.document_url}>Abrir evidencia</a>}
  </details>;
}

export default function InstitutionalDetailPanel({token,kind,id,onNavigate,onUnauthorized,onClose}) {
  const [state,setState]=useState({loading:true,data:null,error:''});
  useEffect(()=>{
    if(!token||!kind||!id)return;
    const controller=new AbortController();
    setState({loading:true,data:null,error:''});
    const url='/api/institutional-data?view=detail&kind='+encodeURIComponent(kind)+'&id='+encodeURIComponent(id);
    fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controller.signal})
      .then(async r=>{const body=await r.json();if(r.status===401||r.status===403){onUnauthorized?.('La sesión institucional expiró o perdió autorización. Identifícate nuevamente.');throw Error('La sesión no está autorizada para esta consulta');}if(!r.ok)throw Error(body.error||'No se pudo consultar el fundamento');return body;})
      .then(body=>{if(!controller.signal.aborted)setState({loading:false,data:body,error:''});})
      .catch(err=>{if(!controller.signal.aborted)setState({loading:false,data:null,error:err.message||'Error de consulta'});});
    return ()=>controller.abort();
  },[token,kind,id,onUnauthorized]);
  const d=state.data,r=d?.record;
  return <section className="panel institutional-detail" aria-live="polite">
    <div className="panel-heading"><div><h2>Ficha institucional completa · {id}</h2><p><ShieldCheck size={14}/> Lectura autorizada · V06/V07 son propuestas, no conformidades oficiales</p></div><button className="outline-btn" onClick={onClose}>Cerrar ficha</button></div>
    {state.loading&&<p>Consultando fundamentos y trazabilidad en Neon…</p>}
    {state.error&&<p className="error-banner"><AlertCircle size={16}/>{state.error}</p>}
    {!state.loading&&!state.error&&!r&&<p>El registro no existe o no es accesible.</p>}
    {r&&kind==='sdo'&&<>
      <h3>Obligación contractual SDO</h3>
      <Note label="Descripción original" value={r.description}/>
      <p><b>Componente:</b> {txt(r.component)} · <b>Tipo:</b> {txt(r.requirement_type)} · <b>Ciclo:</b> {txt(r.cycle)}</p>
      <h3>Situación oficial registrada</h3>
      <Note label="Estado oficial" value={r.verification_status}/>
      <Note label="Observaciones oficiales" value={r.notes}/>
      <Note label="Avance reportado / fundamento" value={[r.progress_reported,r.progress_basis].filter(Boolean).join(' · ')}/>
      <h3>Dictamen independiente V06, pendiente de validación</h3>
      <Note label="Evaluación propuesta" value={d.compliance?.proposed_evaluation}/>
      <Note label="Fundamento del análisis" value={d.compliance?.basis}/>
      <Note label="Referencias de evidencia" value={d.compliance?.evidence_references}/>
      <Note label="Comprobaciones y condiciones pendientes" value={d.compliance?.missing_validation}/>
      <Note label="Estado de propuesta" value={d.compliance?.proposal_status}/>
      <Note label="Analista V06 / fecha" value={[d.compliance?.proposed_by,d.compliance?.reviewed_at].filter(Boolean).join(' · ')}/>
    </>}
    {r&&kind==='request'&&<>
      <h3>Solicitud original</h3>
      <Note label="Descripción original" value={r.request_text}/>
      <p><b>Área:</b> {txt(r.area)} · <b>Componente:</b> {txt(r.component)} · <b>Solicitante:</b> {txt(r.requester)}</p>
      <Note label="Referencias SDO / brechas originales" value={[r.sdo_reference,r.gap_reference].filter(Boolean).join(' · ')}/>
      <Note label="Observaciones de la solicitud" value={r.comments}/>
      <h3>Evaluación independiente V07</h3>
      <Note label="Clasificación propuesta" value={d.classification?.classification}/>
      <Note label="Fundamento contractual" value={d.classification?.basis}/>
      <Note label="Evidencia contractual contrastada" value={d.classification?.contractual_evidence}/>
      <Note label="Requisitos SDO relacionados" value={d.classification?.related_sdo_codes}/>
      <Note label="Brechas referenciadas, no confirmadas" value={d.classification?.related_gap_ids}/>
      <Note label="Estado institucional de la propuesta" value={d.classification?.proposal_status}/>
      <Note label="Analista V07 / fecha" value={[d.classification?.proposed_by,d.classification?.reviewed_at].filter(Boolean).join(' · ')}/>
      <h3>Condiciones operativas y desbloqueo</h3>
      {(d.queue||[]).map((q,i)=><div key={i} className="institutional-note"><b>{q.task_type} · {q.status}</b><p>Responsable/ventana: {txt(q.assigned_window)} · Actualizado: {txt(q.updated_at)}</p><p>{txt(q.notes)}</p></div>)}
      {!d.queue?.length&&<p>No se registraron tareas adicionales de aclaración o estimación.</p>}
      <p className="muted">Las tareas de la cola son referencias operativas; solo una evaluación V08 registrada constituye una estimación independiente.</p>
      <h3>Estimaciones independientes V08</h3>
      {!d.estimates?.length&&<p>No hay estimaciones independientes registradas. El triaje histórico no constituye aprobación.</p>}
      {(d.estimates||[]).map((e,i)=><details className="institutional-assessment" key={i}><summary>{e.method} · {e.proposal_status||'Propuesta'}</summary>
        <Note label="Mínimo / esperado / máximo" value={[e.estimate_min,e.estimate_expected,e.estimate_max,e.unit].join(' / ')}/>
        <Note label="Fundamento" value={e.basis}/>
        <Note label="Fuentes" value={e.source_references}/>
        <Note label="Exclusiones contractuales" value={e.exclusions_contractual}/>
        <Note label="Supuestos" value={e.assumptions}/>
      </details>)}
      {(d.classification?.related_sdo_codes||[]).map(code=><button className="outline-btn" key={code} onClick={()=>onNavigate('sdo',code)}>Abrir SDO {code}</button>)}
    </>}
    {r&&kind==='document'&&<>
      <h3>Documento fuente</h3>
      <Note label="Título original" value={r.title}/><Note label="Última modificación registrada (no equivale a versión formal)" value={r.modified_at}/>
      <Note label="Estado y observaciones" value={[r.scan_status,r.verification_notes].filter(Boolean).join(' · ')}/>
      {safeUrl(r.url)&&<a href={r.url} target="_blank" rel="noopener noreferrer" className="doc-link">Abrir documento original</a>}
    </>}
    {r&&kind==='assessment'&&<Assessment item={r} onNavigate={onNavigate}/>}
    {r&&d?.evidence?.length>0&&<><h3>Evidencias relacionadas ({d.evidence.length})</h3><div className="institutional-links">{d.evidence.map((e,i)=><LinkedDocument key={String(e.id||e.document_id)+i} item={e} onNavigate={onNavigate}/>)}</div></>}
    {r&&d?.assessments?.length>0&&<><h3>Evaluaciones documentales ({d.assessments.length})</h3><div className="institutional-links">{d.assessments.map((a,i)=><Assessment key={String(a.id)+i} item={a} onNavigate={onNavigate}/>)}</div></>}
  </section>;
}
