// V09 · Política de denegación por defecto (fail closed).
// No existe todavía una sesión institucional verificada por servidor.
// En particular, ni un token pasado por el navegador ni un nombre de archivo
// son pruebas de autorización para divulgar contratos, documentos o hallazgos.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Authorization, Cookie');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }
  // Nunca consultar Neon ni construir filas antes de comprobar autorización.
  // Futuro acceso: SSO/OIDC, verificación criptográfica en el servidor,
  // audiencia/emisor/expiración, rol institucional y auditoría de acceso.
  return res.status(403).json({
    code: 'INSTITUTIONAL_ACCESS_REQUIRED',
    error: 'El detalle documental, contractual y de solicitudes requiere autenticación y autorización institucional verificables.',
    access: 'restricted',
  });
}
