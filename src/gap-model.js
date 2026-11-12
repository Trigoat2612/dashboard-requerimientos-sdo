// Transformaciones puras y verificables para el módulo de brechas V09.
// No deducen brechas de evaluaciones parciales ni estados históricos.
export const GAP_KINDS = Object.freeze([
  'Brecha funcional o técnica sustentada',
  'Obligación contractual pendiente',
  'Defecto de implementación',
  'Insuficiencia de evidencia',
  'Mejora fuera de SDO'
]);

export const GAP_STATES = Object.freeze([
  'Propuesta',
  'En revisión',
  'Abierta',
  'Atendida pendiente de verificación',
  'Cerrada con evidencia validada',
  'Descartada'
]);

export const GAP_SEVERITIES = Object.freeze(['Crítica', 'Alta', 'Media', 'Baja', 'Sin determinar']);

const text = value => String(value ?? '').toLocaleLowerCase('es-PE').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const values = input => Array.isArray(input) ? input : [];

export function filterGaps(rows, filters = {}) {
  const q = text(filters.search);
  return values(rows).filter(g => {
    const links = values(g.sdo_codes);
    if (filters.sdo && !links.some(code => text(code).includes(text(filters.sdo)))) return false;
    if (filters.component && text(g.component) !== text(filters.component)) return false;
    if (filters.kind && g.gap_kind !== filters.kind) return false;
    if (filters.severity && g.severity !== filters.severity) return false;
    if (filters.owner && !text(g.owner_proposed).includes(text(filters.owner))) return false;
    if (filters.status && g.attention_status !== filters.status) return false;
    if (!q) return true;
    return [
      g.gap_id, g.expected_behavior, g.observed_behavior, g.impact,
      g.owner_proposed, g.component, g.gap_kind, ...links
    ].some(x => text(x).includes(q));
  });
}

export function pageGaps(rows, page = 1, pageSize = 20) {
  const size = Math.max(1, Number(pageSize) || 20);
  const total = values(rows).length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.max(1, Math.min(pages, Math.floor(Number(page) || 1)));
  return { rows: values(rows).slice((current - 1) * size, current * size), page: current, pages, total };
}

export function gapExportRows(rows) {
  return [['Brecha', 'Tipo', 'Requisitos SDO', 'Componente', 'Severidad', 'Responsable propuesto', 'Estado'],
    ...values(rows).map(g => [g.gap_id, g.gap_kind, values(g.sdo_codes).join(', '),
      g.component, g.severity, g.owner_proposed, g.attention_status])];
}
