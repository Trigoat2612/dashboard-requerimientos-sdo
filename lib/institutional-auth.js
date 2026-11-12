import { createPublicKey, verify as verifySignature } from 'node:crypto';

const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';
const MAX_TOKEN_LENGTH = 12000;
let jwksCache = { expires: 0, keys: [] };

export class AuthenticationError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = 'AuthenticationError';
    this.status = status;
  }
}

export function institutionalAuthConfig(env = process.env) {
  const clientId = String(env.GOOGLE_OIDC_CLIENT_ID || '').trim();
  const allowed = String(env.INSTITUTIONAL_ALLOWED_EMAILS || '').split(',')
    .map(v => v.trim().toLowerCase()).filter(Boolean);
  return { enabled: Boolean(clientId && allowed.length), clientId, allowedEmails: new Set(allowed) };
}

function decodeSegment(encoded) {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length > MAX_TOKEN_LENGTH) throw new AuthenticationError('Credencial inválida');
  try { return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); }
  catch { throw new AuthenticationError('Credencial inválida'); }
}

async function googleKeys(fetchImpl = fetch, nowMs = Date.now()) {
  if (fetchImpl === fetch && jwksCache.keys.length && jwksCache.expires > nowMs) return jwksCache.keys;
  const response = await fetchImpl(GOOGLE_JWKS, { method:'GET', signal: AbortSignal.timeout(4500) });
  if (!response.ok) throw new AuthenticationError('No se pudo validar la identidad', 503);
  const body = await response.json();
  if (!Array.isArray(body.keys)) throw new AuthenticationError('No se pudo validar la identidad', 503);
  const keys = body.keys.filter(k => k && k.kty === 'RSA' && k.use === 'sig' && k.alg === 'RS256' && typeof k.kid === 'string');
  if (!keys.length) throw new AuthenticationError('No se pudo validar la identidad', 503);
  if (fetchImpl === fetch) jwksCache = { keys, expires: nowMs + 10 * 60 * 1000 };
  return keys;
}

export async function verifyInstitutionalToken(raw, options = {}) {
  const { env = process.env, nowMs = Date.now(), fetchImpl = fetch } = options;
  const config = institutionalAuthConfig(env);
  if (!config.enabled) throw new AuthenticationError('Acceso institucional no configurado', 503);
  if (typeof raw !== 'string' || raw.length > MAX_TOKEN_LENGTH || raw.length < 100) throw new AuthenticationError('Credencial inválida');
  const parts = raw.split('.');
  if (parts.length !== 3) throw new AuthenticationError('Credencial inválida');
  const header = decodeSegment(parts[0]);
  const payload = decodeSegment(parts[1]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) throw new AuthenticationError('Firma no válida');
  let keys;
  try { keys = await googleKeys(fetchImpl, nowMs); }
  catch (error) { if (error instanceof AuthenticationError) throw error; throw new AuthenticationError('No se pudo validar la identidad', 503); }
  const key = keys.find(k => k.kid === header.kid);
  if (!key) throw new AuthenticationError('Clave de firma no reconocida');
  try {
    const publicKey = createPublicKey({ key, format:'jwk' });
    if (!verifySignature('RSA-SHA256', Buffer.from(parts[0]+'.'+parts[1]), publicKey, Buffer.from(parts[2],'base64url'))) throw new AuthenticationError('Firma no válida');
  } catch(error) {
    if (error instanceof AuthenticationError) throw error;
    throw new AuthenticationError('Firma no válida');
  }
  if (!ISSUERS.has(payload.iss) || payload.aud !== config.clientId || typeof payload.sub !== 'string' || !payload.sub) throw new AuthenticationError('Identidad no autorizada');
  const now = Math.floor(nowMs / 1000);
  if (!Number.isInteger(payload.exp) || payload.exp <= now || !Number.isInteger(payload.iat) || payload.iat > now + 60) throw new AuthenticationError('Credencial vencida o inválida');
  if (payload.nbf !== undefined && (!Number.isInteger(payload.nbf) || payload.nbf > now)) throw new AuthenticationError('Credencial aún no válida');
  if (payload.email_verified !== true || typeof payload.email !== 'string') throw new AuthenticationError('Correo no verificado');
  const email = payload.email.trim().toLowerCase();
  if (!config.allowedEmails.has(email)) throw new AuthenticationError('Usuario sin autorización institucional', 403);
  return { subject: payload.sub, email, roles: ['institutional_reader'], expiresAt: payload.exp };
}

export function extractBearer(req) {
  const header = req.headers?.authorization;
  if (typeof header !== 'string' || !/^Bearer [^\s]+$/i.test(header)) throw new AuthenticationError('Sesión institucional requerida');
  return header.slice(7);
}

export function protectedHeaders(res) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Pragma','no-cache');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Authorization');
}

export function authErrorResponse(error, res) {
  const status = error instanceof AuthenticationError ? error.status : 500;
  return res.status(status).json({
    code: status===403?'FORBIDDEN':status===401?'UNAUTHENTICATED':status===503?'AUTH_UNAVAILABLE':'SERVER_ERROR',
    error: status===403?'El usuario no tiene autorización institucional':status===401?'Identificación institucional necesaria':status===503?'Autenticación institucional no disponible':'No se pudo procesar la solicitud'
  });
}
