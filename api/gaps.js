// Vista institucional de brechas. No se publica el registro sin autorización.
// Aunque la tabla se cree posteriormente, nunca se devolverán hallazgos
// ni relaciones documentales a visitantes anónimos.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Authorization, Cookie');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }
  return res.status(403).json({
    code: 'INSTITUTIONAL_ACCESS_REQUIRED',
    error: 'El registro de brechas, sus documentos y sus responsables requieren acceso institucional autorizado.',
    access: 'restricted',
  });
}
