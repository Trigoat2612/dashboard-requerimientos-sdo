import { institutionalAuthConfig } from '../lib/institutional-auth.js';
export default function handler(req,res) {
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method!=='GET') return res.status(405).json({error:'Método no permitido'});
  const config=institutionalAuthConfig();
  // El Client ID de OAuth es público. Nunca enviar allowlist, secretos o cadena de Neon.
  return res.status(200).json({provider:'google_oidc',enabled:config.enabled,clientId:config.enabled?config.clientId:null,scope:'institutional_reader'});
}
