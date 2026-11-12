// El tablero se consulta sin DASHBOARD_ACCESS_KEY. Las escrituras anónimas se bloquean.
// Las evaluaciones oficiales se registran en Neon desde una sesión autorizada.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Allow', 'POST');
  return res.status(403).json({error:'Edición pública deshabilitada. Requiere autenticación institucional para modificar evaluaciones.'});
}
