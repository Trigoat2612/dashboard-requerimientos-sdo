// CSV compartido: neutraliza fórmulas interpretadas por Excel y LibreOffice.
export function escapeCsvCell(value) {
  const raw = String(value ?? '');
  const guarded = /^\s*[=+@-]/u.test(raw) ? "'" + raw : raw;
  return '"' + guarded.replaceAll('"', '""') + '"';
}
export function toSafeCsv(rows) {
  return '\uFEFF' + (Array.isArray(rows) ? rows : [])
    .map(row => (Array.isArray(row) ? row : []).map(escapeCsvCell).join(';'))
    .join('\r\n');
}
