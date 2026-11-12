import { neon } from '@neondatabase/serverless';
const states=['Pendiente de análisis','En evaluación','Cubierto por SDO','Brecha confirmada','Validado para estimación','Descartado'];
const compliance=['Por verificar','Cumple','Cumple parcialmente','No cumple','No aplica'];
const short=(value,n)=>String(value??'').trim().slice(0,n);
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});
    if(!process.env.DASHBOARD_ACCESS_KEY)return res.status(503).json({error:'Control de acceso pendiente de configurar'});
  if(req.headers?.authorization!==`Bearer ${process.env.DASHBOARD_ACCESS_KEY}`)return res.status(401).json({error:'Acceso no autorizado'});
  if(!process.env.DATABASE_URL)return res.status(503).json({error:'Base de datos no configurada'});
  try{
    const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
    const id=Number(b.id);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'ID inválido'});
    if(!states.includes(b.status)||!compliance.includes(b.compliance_status))return res.status(400).json({error:'Estado de evaluación no válido'});
    const numbers=[b.hours_min,b.hours_expected,b.hours_max].map(x=>x===''||x==null?null:Number(x));
    if(numbers.some(x=>x!==null&&(!Number.isFinite(x)||x<0||x>100000)))return res.status(400).json({error:'Rango de horas inválido'});
    if(numbers.every(x=>x!==null)&&(numbers[0]>numbers[1]||numbers[1]>numbers[2]))return res.status(400).json({error:'Ordena horas mínima, probable y máxima'});
    const sql=neon(process.env.DATABASE_URL);
    const component=short(b.component,500),sdo=short(b.sdo_reference,1200),gap=short(b.gap_reference,6000),comments=short(b.comments,10000),evidence=short(b.evidence_status,400),confidence=short(b.estimate_confidence,200);
    const rows=await sql`UPDATE ejenp_requerimientos_sdo.proposed_requirements SET component=${component},sdo_reference=${sdo},gap_reference=${gap},comments=${comments},status=${b.status},compliance_status=${b.compliance_status},evidence_status=${evidence},hours_min=${numbers[0]},hours_expected=${numbers[1]},hours_max=${numbers[2]},estimate_confidence=${confidence},updated_at=now() WHERE id=${id} RETURNING *`;
    if(!rows.length)return res.status(404).json({error:'Requerimiento no encontrado'});
    await sql`INSERT INTO ejenp_requerimientos_sdo.activity_log(entity_type,entity_ref,action,detail) VALUES ('proposed_requirement',${String(id)},'Evaluación actualizada',${'Estado: '+b.status+'; Cumplimiento: '+b.compliance_status})`;
    return res.status(200).json({record:rows[0]});
  }catch(e){console.error('Update failed',e?.message);return res.status(500).json({error:'No se pudo registrar la evaluación en Neon'})}
}