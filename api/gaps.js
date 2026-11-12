import { neon } from '@neondatabase/serverless';

// V09: el registro consolidado no existe en Neon ni ha sido aprobado.
// Se puede consultar el conjunto de REFERENCIAS preliminares V07, separadas
// formalmente del registro de brechas, sin exponer fundamentos ni documentos.
export function buildPublicGapMetadata(candidates) {
    return {
      access: 'public_metadata_only',
      registryStatus: 'not_migrated',
      rows: [], // No registrar o inferir brechas desde V06 ni V07.
      candidates: candidates.map(c => ({
        request_code: c.request_code,
        classification: c.classification,
        sdo_codes: c.related_sdo_codes || [],
        reference_ids: c.related_gap_ids || [],
        proposal_status: c.proposal_status
      })),
      notice: 'Referencias preliminares V07: no son brechas consolidadas, verificadas ni aprobadas.',
      generatedAt: new Date().toISOString()
    };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Authorization, Cookie');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'Consulta no disponible temporalmente' });
  try {
    const sql = neon(process.env.DATABASE_URL);
    const candidates = await sql`
      SELECT r.request_code, c.classification, c.related_sdo_codes, c.related_gap_ids,
             c.proposal_status
      FROM ejenp_requerimientos_sdo.request_classification_proposals c
      JOIN ejenp_requerimientos_sdo.proposed_requirements r ON r.id=c.request_id
      WHERE c.classification='Brecha existente'
      ORDER BY r.request_code
    `;
    return res.status(200).json(buildPublicGapMetadata(candidates));
  } catch {
    console.error('V09 gap metadata query failed');
    return res.status(500).json({ error: 'No se pudo consultar la clasificación de brechas' });
  }
}
