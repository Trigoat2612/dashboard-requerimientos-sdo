import React, { useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, Calculator, ClipboardList, FileText, RefreshCw, ShieldCheck } from 'lucide-react';
import './audit-v2.css';

const n = value => Number(value) || 0;
const fmt = value => new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 }).format(n(value));
const pick = (rows, key, value) => n((rows || []).find(row => row[key] === value)?.total);
const categories = ['Cubierta', 'Pendiente contractual', 'Brecha existente', 'Duplicada', 'Genuinamente nueva', 'Indeterminada'];
function Section({ icon: Icon, title, note, children }) {
  return <section className="v2-group"><div className="v2-group-header"><Icon size={19}/><div><h2>{title}</h2><p>{note}</p></div></div>{children}</section>;
}
function Fact({ label, value }) {
  return <div className="v2-facts"><span>{label}</span><b>{value}</b></div>;
}
export default function V09Overview({ onNavigate }) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  async function refresh() {
    setState(s => ({ ...s, loading: true, error: '' }));
    try {
      const res = await fetch('/api/v2-summary', { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) throw Error(payload.error || 'Resumen no disponible');
      setState({ data: payload, loading: false, error: '' });
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: e.message || String(e) }));
    }
  }
  useEffect(() => { refresh(); }, []);
  const d = state.data;
  const x = d?.overview || {};
  const v = d?.v09 || {};
  const reviewed = n(v.evaluated_sdo);
  const total = n(x.sdo_total);
  const classified = n(v.classified_requests);
  const newRequests = pick(d?.classification, 'classification', 'Genuinamente nueva');
  const independent = n(v.requests_with_independent_methods);

  return <div className="v2-root">
    <div className="v2-head"><div><span className="v2-eyebrow">V09 · LECTURA GERENCIAL INTEGRADA</span>
      <h2>Decisiones basadas en propuestas, no en conformidades ficticias</h2>
      <p>Los indicadores provienen de Neon y separan cobertura documental, cumplimiento contractual, clasificación y estimaciones.</p>
    </div><button className="v2-refresh" onClick={refresh} disabled={state.loading}><RefreshCw size={15} className={state.loading ? 'spin' : ''}/> Actualizar</button></div>
    {state.error && <div className="v2-error"><AlertTriangle size={18}/>{state.error}</div>}
    {!d && !state.error && <p className="v2-muted">Consultando el corte vigente de Neon...</p>}
    {d && <>
      <div className="v2-kpis">
        <div className="v2-kpi"><BookOpen size={19}/><small>Requisitos SDO</small><strong>{fmt(total)}</strong><span>{fmt(reviewed)} dictámenes V06 propuestos · {fmt(Math.max(0,total-reviewed))} sin dictamen V06</span></div>
        <div className="v2-kpi"><ShieldCheck size={19}/><small>Cumplimiento demostrado (propuesto)</small><strong>{fmt(pick(d.compliance,'classification','Cumplimiento demostrado'))}</strong><span>No equivale a conformidad oficial</span></div>
        <div className="v2-kpi"><ClipboardList size={19}/><small>Solicitudes con dictamen V07</small><strong>{fmt(classified)} / {fmt(x.requests_total)}</strong><span>{fmt(newRequests)} potencialmente nuevas, pendientes de validación</span></div>
        <div className="v2-kpi"><Calculator size={19}/><small>Solicitudes con métodos independientes</small><strong>{fmt(independent)}</strong><span>No se deducen horas aprobadas</span></div>
      </div>
      <div className="v2-groups">
        <Section icon={BookOpen} title="1. Cumplimiento SDO" note="V06 es una evaluación independiente propuesta. No sustituye el registro oficial.">
          <Fact label="Cumplimiento demostrado (propuesto)" value={fmt(pick(d.compliance,'classification','Cumplimiento demostrado'))}/>
          <Fact label="Cumplimiento parcial (propuesto)" value={fmt(pick(d.compliance,'classification','Cumplimiento parcial'))}/>
          <Fact label="Incumplimiento sustentado (propuesto)" value={fmt(pick(d.compliance,'classification','Incumplimiento sustentado'))}/>
          <Fact label="No verificable" value={fmt(pick(d.compliance,'classification','No verificable'))}/>
          <Fact label="Sin dictamen V06" value={fmt(Math.max(0,total-reviewed))}/>
          <button className="v2-refresh" onClick={() => onNavigate?.('sdo')}>Consultar matriz SDO</button>
        </Section>
        <Section icon={AlertTriangle} title="2. Brechas" note="No convertir automáticamente el cumplimiento parcial en brecha confirmada.">
          <Fact label="Brechas consolidadas verificables" value="Sin registro consolidado"/>
          <Fact label="Solicitudes clasificadas como brecha existente (V07)" value={fmt(pick(d.classification,'classification','Brecha existente'))}/>
          <p className="v2-muted">Pendiente: catálogo con identificadores estables, evidencia, responsable y estado de subsanación. Su ausencia no significa cero brechas.</p>
        </Section>
        <Section icon={ClipboardList} title="3. Clasificación de solicitudes" note="V07 clasifica; la aprobación institucional es una decisión independiente.">
          <div className="v2-breakdown">{categories.map(label => <div key={label}><span>{label}</span><b>{fmt(pick(d.classification,'classification',label))}</b></div>)}</div>
          <button className="v2-refresh" onClick={() => onNavigate?.('nuevos')}>Ver solicitudes</button>
        </Section>
        <Section icon={Calculator} title="4. Bolsa de horas" note="No sumar métodos alternativos ni utilizar el triaje histórico como estimación.">
          <Fact label="Incrementos potencialmente nuevos (V07)" value={fmt(newRequests)}/>
          <Fact label="Solicitudes con métodos independientes (V08)" value={fmt(independent)}/>
          <Fact label="Registros de métodos independientes" value={fmt(v.independent_method_records)}/>
          <Fact label="Tareas de estimación bloqueadas" value={fmt(v.blocked_estimation_tasks)}/>
          <Fact label="Horas aprobadas institucionalmente" value="No acreditadas"/>
          <p className="v2-muted">Referencia histórica de triaje: {fmt(v.historical_triage_hours)} h. No es esfuerzo sustentado, ni saldo contractual, ni aprobación.</p>
        </Section>
        <Section icon={FileText} title="5. Auditoría documental" note="Una evaluación de archivo no acredita el cumplimiento de un requisito.">
          <Fact label="Archivos inventariados" value={fmt(x.files_total)}/>
          <Fact label="Criterios de evaluación documental registrados" value={fmt(v.document_assessments)}/>
          <Fact label="Expedientes SDO con dictamen V06" value={fmt(reviewed)}/>
          <button className="v2-refresh" onClick={() => onNavigate?.('v2')}>Ver control V00–V08</button>
        </Section>
        <Section icon={ShieldCheck} title="6. Control institucional y acceso" note="Las fuentes de detalle requieren autorización institucional individual.">
          <p className="v2-muted">Los resultados V06 y V07 son propuestas; los registros de aprobación no se infieren. La interfaz pública ofrece metadatos y agregados, no el contenido de documentos, solicitudes ni hallazgos restringidos.</p>
          <Fact label="Última consulta" value={d.generatedAt ? new Date(d.generatedAt).toLocaleString('es-PE',{timeZone:'America/Lima'}) : 'Sin fecha'}/>
          <Fact label="Estado de la consolidación de brechas" value="Pendiente de modelo validado"/>
        </Section>
      </div>
    </>}
  </div>;
}
