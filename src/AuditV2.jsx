import React, {useEffect,useState} from 'react';
import {Activity, AlertTriangle, BookOpen, Calculator, CheckCircle2, ClipboardList, FileText, GitBranch, RefreshCw, ShieldCheck} from 'lucide-react';
import './audit-v2.css';

const num = v => Number(v) || 0;
const fmt = v => new Intl.NumberFormat('es-PE',{maximumFractionDigits:0}).format(num(v));
const percent = (a,b) => b ? Math.max(0,Math.min(100,Math.round(100*num(a)/num(b)))) : 0;
const labels = {
  Cubierta: 'Cubierta por el alcance',
  'Pendiente contractual': 'Pendiente contractual',
  'Brecha existente': 'Brecha preexistente',
  'Genuinamente nueva': 'Incremento genuinamente nuevo',
  Duplicada: 'Solicitud duplicada',
  Indeterminada: 'Indeterminada'
};
function Meter({value,total,label}) {
  return <div className="v2-meter"><div className="v2-meter-top"><span>{label}</span><strong>{fmt(value)} / {fmt(total)} · {percent(value,total)}%</strong></div><div className="v2-track"><div className="v2-bar" style={{width:percent(value,total)+'%'}} /></div></div>;
}
function Group({title,description,icon:Icon,children}) {
  return <section className="v2-group"><div className="v2-group-header"><Icon size={19}/><div><h2>{title}</h2><p>{description}</p></div></div>{children}</section>;
}
export default function AuditV2() {
  const [state,setState] = useState({data:null,loading:true,error:''});
  const refresh = async () => {
    setState(s => ({...s,loading:true,error:''}));
    try {
      const r = await fetch('/api/v2-summary',{cache:'no-store'});
      const j = await r.json();
      if (!r.ok) throw Error(j.error||'No se pudieron leer los indicadores');
      setState({data:j,loading:false,error:''});
    } catch(e) {
      setState(s => ({...s,loading:false,error:String(e.message||e)}));
    }
  };
  useEffect(()=>{refresh()},[]);
  const d = state.data;
  const x = d?.overview || {};
  const available = d?.availability || {};
  const docs = num(x.files_total);
  const docTasks = d?.documental?.reduce((s,r)=>s+num(r.total),0)||0;
  const documentTreatments = num(x.files_closed_queue) + num((d?.documental||[]).find(r=>r.status==='Duplicado verificado')?.total);
  const compliance = Object.fromEntries((d?.compliance || []).map(r=>[r.classification,num(r.total)]));
  const classified = (d?.classification || []).reduce((s,r)=>s+num(r.total),0);
  const newRequests = num((d?.classification||[]).find(r=>r.classification==='Genuinamente nueva')?.total);
  const hours = d?.hours || [];
  const pendingHours = hours.reduce((s,r)=>s+num(r.total),0);
  return <div className="v2-root">
    <div className="v2-head"><div><span className="v2-eyebrow">AUDITORÍA INTEGRAL · MODELO V2</span><h2>Control por frentes independientes</h2><p>Seguimiento documental, contractual, brechas, solicitudes y estimación sin mezclar avances con aprobaciones.</p></div><button className="v2-refresh" onClick={refresh} disabled={state.loading}><RefreshCw size={15} className={state.loading?'spin':''}/> Actualizar</button></div>
    {state.error && <div className="v2-error"><AlertTriangle size={18}/>{state.error}</div>}
    {!d && !state.error && <p className="v2-muted">Consultando los indicadores agregados de Neon…</p>}
    {d && <>
      <div className="v2-kpis">
        <div className="v2-kpi"><FileText size={19}/><small>Archivos en inventario</small><strong>{fmt(docs)}</strong><span>{fmt(x.folders_total)} carpetas adicionales al conteo de archivos</span></div>
        <div className="v2-kpi"><BookOpen size={19}/><small>Requisitos SDO</small><strong>{fmt(x.sdo_total)}</strong><span>{fmt(available.sdo_ready)} habilitados para contraste inicial</span></div>
        <div className="v2-kpi"><ClipboardList size={19}/><small>Solicitudes por clasificar</small><strong>{fmt(num(x.requests_total)-classified)}</strong><span>De {fmt(x.requests_total)} solicitudes registradas</span></div>
        <div className="v2-kpi"><Calculator size={19}/><small>Estimaciones preliminares</small><strong>{fmt(pendingHours)}</strong><span>Solo incrementos genuinamente nuevos</span></div>
      </div>
      <div className="v2-groups">
        <Group title="1. Avance documental" description="La cola documental es independiente de las evidencias por requisito." icon={FileText}>
          <Meter label="Contrastadas o con duplicidad verificada en cola" value={documentTreatments} total={docTasks}/>
          <div className="v2-facts"><span>Con al menos un criterio contrastado</span><b>{fmt(available.docs_with_any_contrast)} archivos</b></div>
          <div className="v2-facts"><span>Criterios documentales contrastados</span><b>{fmt(available.assessment_criteria_contrasted)}</b></div>
          <div className="v2-facts"><span>Pendientes / en curso</span><b>{fmt(x.files_pending)} / {fmt(x.files_in_progress)}</b></div>
        </Group>
        <Group title="2. Cumplimiento individual SDO" description="La documentación asociada no equivale a conformidad contractual." icon={ShieldCheck}>
          <Meter label="Contrastes integrales cerrados en cola" value={available.sdo_closed} total={x.sdo_total}/>
          <div className="v2-facts"><span>Propuestas de evaluación emitidas</span><b>{fmt(x.compliance_proposed)}</b></div>
          <div className="v2-facts"><span>Con evidencia contrastada para iniciar</span><b>{fmt(available.sdo_ready)}</b></div>
          <div className="v2-facts"><span>Cumplimiento demostrado (propuesto)</span><b>{fmt(compliance['Cumplimiento demostrado'])}</b></div>
        </Group>
        <Group title="3. Brechas sustentadas" description="Identificadas y propuestas sin modificar el estado oficial." icon={AlertTriangle}>
          <div className="v2-figure">{fmt(num(compliance['Cumplimiento parcial'])+num(compliance['Incumplimiento sustentado']))}<span> propuestas SDO de cumplimiento parcial o incumplimiento</span></div>
          <div className="v2-facts"><span>Solicitudes clasificadas como brecha existente</span><b>{fmt((d.classification||[]).find(r=>r.classification==='Brecha existente')?.total)}</b></div>
          <div className="v2-facts"><span>Incumplimientos sustentados propuestos</span><b>{fmt(compliance['Incumplimiento sustentado'])}</b></div>
        </Group>
        <Group title="4. Clasificación de solicitudes" description="Seis categorías mutuamente excluyentes, siempre con fundamento." icon={ClipboardList}>
          <Meter label="Solicitudes con clasificación propuesta" value={classified} total={x.requests_total}/>
          <div className="v2-breakdown">{Object.entries(labels).map(([code,label])=><div key={code}><span>{label}</span><b>{fmt((d.classification||[]).find(r=>r.classification===code)?.total)}</b></div>)}</div>
        </Group>
        <Group title="5. Bolsa de horas" description="WBS, IFPUG, COSMIC, SNAP e históricos verificables: sin horas atribuidas a obligaciones previas." icon={Calculator}>
          <div className="v2-figure">{fmt(newRequests)}<span> solicitudes propuestas como genuinamente nuevas</span></div>
          <div className="v2-facts"><span>Habilitadas para estimar tras contraste</span><b>{fmt(available.estimate_ready)}</b></div>
          <div className="v2-methods">{(d.methodGuidance||[]).map(g=><details key={g.method}><summary><b>{g.method}</b><span>{fmt(hours.find(x=>x.method===g.method)?.total)} estimaciones preliminares</span></summary><p><b>Aplicación:</b> {g.applicability}</p><p><b>Datos exigibles:</b> {g.required_inputs}</p><p><b>Control:</b> {g.validation_control}</p><p><b>Límite:</b> {g.limitations}</p></details>)}</div>
          <p className="v2-muted">No se suman metodologías alternativas como si fueran trabajos adicionales. La aprobación institucional se registra por separado.</p>
        </Group>
      </div>
      <section className="v2-windows"><div className="v2-group-header"><GitBranch size={19}/><div><h2>Ventanas de trabajo V00–V08</h2><p>Compartición segura de tareas. V01–V05 consultan la misma cola documental, no cinco inventarios diferentes.</p></div></div>
        <div className="v2-window-grid">{(d.windows||[]).map(w=><div className="v2-window" key={w.window_id}><b>{w.window_id}</b><div><strong>{w.specialty}</strong><small>{w.workstream}</small></div><span className={w.enabled?'v2-ok':'v2-off'}>{w.enabled?'Habilitada':'Deshabilitada'}</span><small>{fmt(w.activeReservations)} reservas activas</small></div>)}</div>
      </section>
      <div className="v2-footnote"><CheckCircle2 size={17}/><span>Fuente: agregados de Neon. Nuevos documentos en Hito 2.2: {fmt(d.inventory?.new_identities)} identidades. Información para seguimiento, no constituye conformidad ni autorización de pago.</span></div>
      <p className="v2-muted">Corte: {d.generatedAt?new Date(d.generatedAt).toLocaleString('es-PE',{timeZone:'America/Lima'}):'Sin dato'}.</p>
    </>}
  </div>;
}
