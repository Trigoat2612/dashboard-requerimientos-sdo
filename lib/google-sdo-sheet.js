import { sign } from 'node:crypto';
import { SHEET_ID } from './sdo-document-model.js';
const encode = obj=>Buffer.from(JSON.stringify(obj)).toString('base64url');
export async function readMasterSheet(env=process.env,fetchImpl=fetch) {
  const email=String(env.GOOGLE_SERVICE_ACCOUNT_EMAIL||'').trim();
  const key=String(env.GOOGLE_PRIVATE_KEY||'').replace(/\\n/g,'\n');
  if (!email || !key) throw new Error('Falta configurar la cuenta de servicio de Google Sheets');
  const now=Math.floor(Date.now()/1000);
  const claim={iss:email,scope:'https://www.googleapis.com/auth/spreadsheets.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600};
  const body=encode({alg:'RS256',typ:'JWT'})+'.'+encode(claim);
  const jwt=body+'.'+sign('RSA-SHA256',Buffer.from(body),key).toString('base64url');
  const tokenResponse=await fetchImpl('https://oauth2.googleapis.com/token',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt}),
    signal:AbortSignal.timeout(12000)
  });
  if (!tokenResponse.ok) throw new Error('Autenticación de Google Sheets falló: HTTP '+tokenResponse.status);
  const token=await tokenResponse.json();
  if (!token.access_token) throw new Error('Google no entregó token de lectura');
  const sheetId=String(env.GOOGLE_SHEET_ID||SHEET_ID);
  const endpoint='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(sheetId)+'/values/Catalogo_83%21A1%3AZ84';
  const response=await fetchImpl(endpoint,{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Google Sheets devolvió HTTP '+response.status+'; revisar permiso de lectura de la cuenta de servicio');
  const result=await response.json();
  return result.values||[];
}
