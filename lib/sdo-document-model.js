import { createHash } from 'node:crypto';
export const EXPECTED_HEADERS = {0:'ID SDO',1:'Fase',2:'Documento / producto',4:'Agente asignado',22:'CIERRE_DE_OPINION_TECNICA · V1.1',23:'VALIDACION_EXTERNA_PENDIENTE · V1.1',24:'DOCUMENTO_CORREGIDO_PROPUESTO_URL',25:'ESTADO_CORRECCION_Y_QA'};
export const SHEET_ID = '1VG0Hawz_HZKPBdDAwPuznagJ47MTaFJwJjNTqOAFRww';
export function safeGoogleUrl(value) {
  if (typeof value !== 'string') return '';
  try { const url = new URL(value.trim());return url.protocol === 'https:' && ['docs.google.com','drive.google.com'].includes(url.hostname) ? url.href : ''; }
  catch { return ''; }
}
export function extractGoogleUrl(value) {
  const match = String(value || '').match(/https:\/\/(?:docs|drive)\.google\.com\/[^\s|)>,;]+/i);
  return match ? safeGoogleUrl(match[0]) : '';
}
export function qaCategory(raw) {
  const value = String(raw || '').toUpperCase();
  if (/\bOBSERVADO\b|\bOBSERVACIONES? QA\b/.test(value) && !/SIN OBSERVACIONES/.test(value)) return 'observado';
  if (/DELTA CONFORME|CONFORME LIMITADO|CONFORMIDAD PARCIAL/.test(value)) return 'conforme_delta';
  if (/QA (?:A11 )?(?:INTEGRAL )?CONFORME|QA INTEGRAL APROBADO/.test(value)) return value.includes('INTEGRAL') ? 'conforme_integral' : 'conforme_delta';
  return 'pendiente';
}
export function normalizeSheet(values) {
  if (!Array.isArray(values) || values.length !== 84) throw new Error('Se esperaban encabezados y 83 documentos exactos');
  const headers = values[0] || [];
  for (const [position,label] of Object.entries(EXPECTED_HEADERS)) if (String(headers[position]||'').trim() !== label) throw new Error('Encabezado incompatible en columna '+(Number(position)+1));
  const codes = new Set();
  return values.slice(1).map((row,index)=>{
    const cells = Array.from({length:26},(_,i)=>String(row?.[i]??'').trim());
    const code=cells[0];
    if (!/^\d+(?:\.\d+)*$/.test(code)||codes.has(code)||!cells[2]) throw new Error('Código inválido, duplicado o sin título en fila '+(index+2));
    codes.add(code);
    const snapshot={
      code, phase:cells[1], title:cells[2], agent:cells[4], audit_state:cells[5],
      inventory_state:cells[6], source_note:cells[8], original_reference:cells[11],
      technical_opinion:cells[22], external_validation:cells[23],
      proposal_url:safeGoogleUrl(cells[24]), correction_qa:cells[25], raw_cells:cells
    };
    return {...snapshot,source_row:index+2,content_hash:createHash('sha256').update(JSON.stringify(cells)).digest('hex'),snapshot};
  });
}
export function toPublic(row) {
  const opinion=String(row.technical_opinion||'').trim();
  const original=String(row.original_reference||'');
  const sourceNote=String(row.source_note||'');
  return {
    code:row.code,source_row:row.source_row,phase:row.phase,title:row.title,agent:row.agent,
    audit_state:row.audit_state,inventory_state:row.inventory_state,
    source_url:safeGoogleUrl(sourceNote),original_url:extractGoogleUrl(original),
    original_identified:/(?:\bPDF\b|\bDOCX\b|\bXLSX\b|\bV\d+\b|\b1[A-Za-z0-9_-]{20,})/i.test(original) && !/INVENTARIO_METADATOS_PARCIAL_VALIDACION/i.test(original),
    technical_opinion_present:/^(?:OPINION|OPINIÓN|DICTAMEN_TECNICO|PROPUESTA_TECNICA|https:\/\/docs\.google\.com\/document\/d\/)/i.test(opinion),
    technical_opinion_url:extractGoogleUrl(row.technical_opinion),
    external_validation_pending:/PENDIENTE|CONSULTA|CONFIRMAR|POR_DETERMINAR/i.test(row.external_validation||''),
    proposal_url:safeGoogleUrl(row.proposal_url),
    qa_category:qaCategory(row.correction_qa),
    integrated_in_original:/\b(INTEGRAD[OA] EN (EL )?ORIGINAL|INTEGRACI[ÓO]N ACREDITADA EN ORIGINAL)\b/i.test(row.correction_qa||'') && !/PENDIENTE/i.test(row.correction_qa||''),
    version:row.version,changed_at:row.changed_at,
    sheet_url:'https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/edit#gid=1444731181&range=A'+row.source_row+':Z'+row.source_row
  };
}
