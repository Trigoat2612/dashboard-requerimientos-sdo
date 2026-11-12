import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, Filter, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { filterGaps, gapExportRows, pageGaps, GAP_KINDS, GAP_SEVERITIES, GAP_STATES } from './gap-model.js';
import { toSafeCsv } from './csv-utils.js';

const EMPTY = { rows: [], access: 'restricted', error: '' };
function exportCsv(rows) {
  const data = toSafeCsv(gapExportRows(rows));
  const blob = new Blob([data], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'brechas_v09_filtradas.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}
const text = value => String(value || '');
const unique = (list, field) => [...new Set(list.map(r => r[field]).filter(Boolean))].sort();

export default function GapExplorer({ onOpenSdo, onOpenRequest }) {
  const [store, setStore] = useState({ ...EMPTY, loading: true });
  const [filters, setFilters] = useState({ search: '', sdo: '', component: '', kind: '', severity: '', owner: '', status: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  async function refresh() {
    setStore(s => ({ ...s, loading: true, error: '' }));
    try {
      const r = await fetch('/api/gaps', { cache: 'no-store', credentials: 'same-origin' });
      const body = await r.json();
      if (r.status === 401 || r.status === 403) {
        setStore({ ...EMPTY, loading: false, access: 'restricted', error: body.error || '' });
        return;
      }
      if (!r.ok) throw new Error(body.error || 'No se pudo consultar el registro de brechas');
      if (!Array.isArray(body.rows)) throw new Error('Respuesta de datos inválida');
      if (body.access !== 'institutional_verified') {setStore({...EMPTY,loading:false,error:'La respuesta no acreditó autorización institucional.'});return;}
      setStore({ rows: body.rows, access: body.access, loading: false, error: '' });
    } catch (error) {
      setStore(s => ({ ...s, loading: false, error: error.message || 'Error de consulta' }));
    }
  }
  useEffect(() => { refresh(); }, []);
  const rows = store.rows || [];
  const filtered = useMemo(() => filterGaps(rows, filters), [rows, filters]);
  const paged = useMemo(() => pageGaps(filtered, page, 20), [filtered, page]);
  const set = (key, value) => { setFilters(f => ({ ...f, [key]: value })); setPage(1); };
  const allowed = store.access === 'institutional_verified';
  const components = useMemo(() => unique(rows, 'component'), [rows]);

  return <section>
    <div className="panel">
      <h2>Registro consolidado de brechas</h2>
      <p className="muted">Separa hallazgos sustentados, obligaciones pendientes, defectos, insuficiencia de evidencia y mejoras fuera de SDO. No genera brechas automáticamente a partir de V06.</p>
      <button className="outline-btn" onClick={refresh} disabled={store.loading}><RefreshCw size={14}/> Actualizar</button>
      {store.loading && <p className="muted">Consultando permisos y disponibilidad...</p>}
      {!store.loading && !allowed && <div className="insight"><ShieldCheck size={19}/><div>
        <b>Acceso institucional restringido</b>
        <p>{store.error || 'El registro, sus documentos, responsables y hallazgos no están disponibles en acceso anónimo.'} El modelo SQL sigue pendiente de autorización y ejecución.</p>
      </div></div>}
      {!store.loading && allowed && <>
        <div className="toolbar">
          <div className="search"><Search size={16}/><input aria-label="Buscar brechas" value={filters.search} onChange={e => set('search', e.target.value)} placeholder="Código, comportamiento, impacto..."/></div>
          <input aria-label="Filtrar requisito SDO" value={filters.sdo} onChange={e => set('sdo', e.target.value)} placeholder="Código SDO"/>
          <select aria-label="Filtrar componente" value={filters.component} onChange={e => set('component', e.target.value)}><option value="">Todos los componentes</option>{components.map(x => <option key={x}>{x}</option>)}</select>
          <select aria-label="Filtrar tipo" value={filters.kind} onChange={e => set('kind', e.target.value)}><option value="">Todos los tipos</option>{GAP_KINDS.map(x => <option key={x}>{x}</option>)}</select>
          <select aria-label="Filtrar severidad" value={filters.severity} onChange={e => set('severity', e.target.value)}><option value="">Toda severidad</option>{GAP_SEVERITIES.map(x => <option key={x}>{x}</option>)}</select>
          <input aria-label="Filtrar responsable" value={filters.owner} onChange={e => set('owner', e.target.value)} placeholder="Responsable"/>
          <select aria-label="Filtrar estado" value={filters.status} onChange={e => set('status', e.target.value)}><option value="">Todos los estados</option>{GAP_STATES.map(x => <option key={x}>{x}</option>)}</select>
          <button className="outline-btn" onClick={() => exportCsv(filtered)} disabled={filtered.length === 0}><Download size={15}/> CSV</button>
        </div>
        <div className="result-count"><Filter size={14}/>{filtered.length} brechas encontradas · {paged.page}/{paged.pages} páginas</div>
        <div className="table-panel"><div className="table-scroll"><table><thead><tr><th>Código</th><th>Tipo</th><th>Requisito SDO</th><th>Componente</th><th>Severidad</th><th>Responsable</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>
          {paged.rows.map(g => <tr key={g.gap_id}>
            <td>{g.gap_id}</td><td>{g.gap_kind}</td><td>{(g.sdo_codes || []).join(', ')}</td><td>{g.component || 'Sin asignar'}</td><td>{g.severity || 'Sin determinar'}</td><td>{g.owner_proposed || 'Pendiente'}</td><td>{g.attention_status}</td>
            <td><button className="outline-btn" onClick={() => setSelected(g)}>Ver ficha</button></td>
          </tr>)}
        </tbody></table>{paged.total === 0 && <p className="muted">No hay brechas registradas para los filtros. No implica ausencia de brechas reales.</p>}</div></div>
        <div className="pager"><span>Página {paged.page} de {paged.pages}</span><div>
          <button onClick={() => setPage(Math.max(1, paged.page - 1))} disabled={paged.page === 1}>Anterior</button>
          <button onClick={() => setPage(Math.min(paged.pages, paged.page + 1))} disabled={paged.page === paged.pages}>Siguiente</button>
        </div></div>
      </>}
    </div>
    {selected && allowed && <div className="panel">
      <h2>Ficha {selected.gap_id}</h2>
      <button className="outline-btn" onClick={() => setSelected(null)}>Cerrar ficha</button>
      <p><b>Comportamiento esperado:</b> {text(selected.expected_behavior)}</p>
      <p><b>Situación observada:</b> {text(selected.observed_behavior)}</p>
      <p><b>Impacto:</b> {text(selected.impact) || 'No documentado'}</p>
      <p><b>Causa:</b> {text(selected.cause) || 'Pendiente de análisis'}</p>
      <p><b>Acción correctiva:</b> {text(selected.corrective_action) || 'Por definir'}</p>
      <p><b>Estado institucional:</b> {text(selected.institutional_status) || 'Sin validación'}</p>
      <h3>Requisitos relacionados</h3>
      {(selected.sdo_codes || []).map(code => <button key={code} className="outline-btn" onClick={() => onOpenSdo?.(code)}>{code}</button>)}
      <h3>Documentos relacionados</h3>
      {(selected.documents || []).map(d => <div key={d.id}>{d.title || d.id} {d.url && <a href={d.url} rel="noopener noreferrer" target="_blank">Abrir fuente autorizada</a>}</div>)}
      <h3>Solicitudes relacionadas</h3>
      {(selected.requests || []).map(r => <button className="outline-btn" key={r.id} onClick={() => onOpenRequest?.(r.request_code)}>{r.request_code}</button>)}
      {!selected.documents?.length && <p className="muted">Sin evidencia documental vinculada.</p>}
    </div>}
  </section>;
}
