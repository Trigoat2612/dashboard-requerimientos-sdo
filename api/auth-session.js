import { verifyInstitutionalToken, protectedHeaders, authErrorResponse, AuthenticationError } from '../lib/institutional-auth.js';

export default async function handler(req,res) {
  protectedHeaders(res);
  if (req.method!=='POST') {res.setHeader('Allow','POST');return res.status(405).json({error:'Método no permitido'});}
  try {
    const credential=req.body?.credential;
    if (typeof credential !== 'string' || credential.length>12000) throw new AuthenticationError('Credencial inválida');
    const identity=await verifyInstitutionalToken(credential);
    return res.status(200).json({authenticated:true,email:identity.email,role:'institutional_reader',expiresAt:identity.expiresAt});
  } catch(error) { return authErrorResponse(error,res); }
}
