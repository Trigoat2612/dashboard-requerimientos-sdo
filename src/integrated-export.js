// Exportadores sin dependencias de CDN: XLSX y PPTX reales mediante ZIP/OOXML.
// No trasladan credenciales ni cadenas de conexión al cliente.
import { exportColumns, exportHeaders, summarize, fmtHours, number } from './integrated-model.js';

const enc=new TextEncoder();
const xml=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,' ');
const pad=(n,len=2)=>String(n).padStart(len,'0');
const u16=(a,p,v)=>{a[p]=v&255;a[p+1]=(v>>>8)&255;};
const u32=(a,p,v)=>{a[p]=v&255;a[p+1]=(v>>>8)&255;a[p+2]=(v>>>16)&255;a[p+3]=(v>>>24)&255;};
let crcTable;
function crc32(bytes) {
 if(!crcTable)crcTable=Array.from({length:256},(_,n)=>{for(let j=0;j<8;j++)n=(n&1)?(0xEDB88320^(n>>>1)):(n>>>1);return n>>>0;});
 let c=0xffffffff;for(let x of bytes)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;
}
function zipEntries(entries) {
 const local=[],central=[];let offset=0;
 for(const [name,body] of entries){
  const n=enc.encode(name),b=enc.encode(body),crc=crc32(b);
  const header=new Uint8Array(30+n.length);u32(header,0,0x04034b50);u16(header,4,20);u16(header,6,0x0800);u16(header,8,0);u32(header,14,crc);u32(header,18,b.length);u32(header,22,b.length);u16(header,26,n.length);header.set(n,30);
  local.push(header,b);
  const c=new Uint8Array(46+n.length);u32(c,0,0x02014b50);u16(c,4,20);u16(c,6,20);u16(c,8,0x0800);u32(c,16,crc);u32(c,20,b.length);u32(c,24,b.length);u16(c,28,n.length);u32(c,42,offset);c.set(n,46);central.push(c);
  offset+=header.length+b.length;
 }
 const size=central.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22);u32(end,0,0x06054b50);u16(end,8,entries.length);u16(end,10,entries.length);u32(end,12,size);u32(end,16,offset);
 const parts=[...local,...central,end],out=new Uint8Array(offset+size+end.length);let pos=0;for(const p of parts){out.set(p,pos);pos+=p.length;}return out;
}
function download(bytes,name,type){
 const blob=new Blob([bytes],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const now=()=>new Date().toISOString().slice(0,10);
const cell=(v,r,c)=> {
 const letter=n=>{let s='';for(let i=n+1;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;};
 const ref=letter(c)+r;
 // Las entradas se escriben como texto literal para neutralizar fórmulas importadas.
 return '<c r="'+ref+'"'+(r===1?' s="1"':'')+' t="inlineStr"><is><t xml:space="preserve">'+xml(v)+'</t></is></c>';
};
export function buildAuditXlsx(rows) {
 const all=[exportHeaders,...rows.map(exportColumns)];
 let colIndex=exportHeaders.length,lastCol='';
 while(colIndex>0){colIndex--;lastCol=String.fromCharCode(65+colIndex%26)+lastCol;colIndex=Math.floor(colIndex/26);}

 const body=all.map((values,i)=>'<row r="'+(i+1)+'">'+values.map((v,c)=>cell(v,i+1,c)).join('')+'</row>').join('');
 const cols=all[0].map((h,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+(i===1||i===11||i===14?48:21)+'" customWidth="1"/>').join('');
 const worksheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>'+cols+'</cols><sheetData>'+body+'</sheetData><autoFilter ref="A1:'+lastCol+all.length+'"/></worksheet>';
 const ct='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
 const rel='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
 const book='<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Auditoría 318" sheetId="1" r:id="rId1"/></sheets></workbook>';
 const bookrels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
 const styles='<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF193B5A"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>';
 return zipEntries([['[Content_Types].xml',ct],['_rels/.rels',rel],['xl/workbook.xml',book],['xl/_rels/workbook.xml.rels',bookrels],['xl/worksheets/sheet1.xml',worksheet],['xl/styles.xml',styles]]);
}
export const exportAuditXlsx=rows=>download(buildAuditXlsx(rows),'auditoria_sdo_318_'+now()+'.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

const aNs='http://schemas.openxmlformats.org/drawingml/2006/main';
const pNs='http://schemas.openxmlformats.org/presentationml/2006/main';
const rNs='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
function shape(id,x,y,w,h,lines,size=2100,color='183451',bold=false,fill=null) {
 const para=lines.map(t=>'<a:p><a:pPr marL="0" algn="l"/><a:r><a:rPr lang="es-PE" sz="'+size+'" b="'+(bold?1:0)+'"><a:solidFill><a:srgbClr val="'+color+'"/></a:solidFill></a:rPr><a:t>'+xml(t)+'</a:t></a:r><a:endParaRPr lang="es-PE"/></a:p>').join('');
 return '<p:sp><p:nvSpPr><p:cNvPr id="'+id+'" name="Elemento '+id+'"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="'+x+'" y="'+y+'"/><a:ext cx="'+w+'" cy="'+h+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'+(fill?'<a:solidFill><a:srgbClr val="'+fill+'"/></a:solidFill>':'<a:noFill/>')+'<a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="140000" rIns="80000" tIns="80000" bIns="0"/><a:lstStyle/>'+para+'</p:txBody></p:sp>';
}
function slide(title,items,i,total) {
 const content=items.slice(0,9).map((item,j)=>shape(10+j,800000,1730000+j*540000,10600000,510000,[item],1700,'233B55',false,j%2?'F0F4F8':null)).join('');
 return '<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="'+aNs+'" xmlns:r="'+rNs+'" xmlns:p="'+pNs+'"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'+
 shape(2,0,0,12192000,520000,['AUDITORÍA INTEGRAL · EJE NO PENAL'],1700,'FFFFFF',true,'173652')+
 shape(3,700000,740000,11100000,710000,[title],3000,'173652',true)+content+
 shape(99,720000,6420000,10900000,250000,['Corte '+now()+' · Propuestas técnicas, no horas aprobadas · '+i+' / '+total],1100,'64748B')+
 '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
}
export function buildAuditPptx(snapshot,rows){
 const m=summarize(rows,snapshot.overlaps||[]);
 const classification=Object.entries(m.classification).sort((a,b)=>b[1]-a[1]);
 const newer=rows.filter(r=>r.final_new).sort((a,b)=>Number(b.final_pert||0)-Number(a.final_pert||0));
 const byArea=Object.entries(newer.reduce((a,r)=>(a[r.area||'Sin especialidad']=(a[r.area||'Sin especialidad']||0)+Number(r.final_pert||0),a),{})).sort((a,b)=>b[1]-a[1]);
 const cut=snapshot.sourceVersion||'Sin versión final';
 const pages=[
  ['Auditoría SDO y novedad técnica EJE',[
   'PROGRAMA EJE NO PENAL · DIAGNÓSTICO GERENCIAL',
   'Cierre técnico: '+cut,
   'Solicitudes consideradas: '+m.total+' (selección actual)',
   'Novedades EJE acreditadas: '+m.newCount,
   'PERT final reconocido: '+fmtHours(m.finalHours.pert),
   'Corte de exportación: '+now()
  ]],
  ['Objetivo y universo de la auditoría',[
   'Requisitos SDO inventariados: '+(snapshot.sdo||[]).length,
   'Registros de brechas Laboral: '+(snapshot.gaps||[]).length,
   'Solicitudes de la auditoría integral: 318 códigos únicos',
   'Novedad técnica: solo funcionalidades nuevas dentro del EJE',
   'Fuente de cierre: '+cut
  ]],
  ['Clasificación definitiva de las solicitudes',...classification.map(([k,v])=>[k+': '+v])],
  ['Nuevas funcionalidades reconocidas',...newer.map(r=>[r.code+' · '+fmtHours(r.final_pert)+' · '+String(r.description||'').slice(0,80)])],
  ['Obligaciones y exclusiones',[
   'Solicitudes sin incremento EJE: '+m.notNew,
   'Cobertura contractual SDO: '+m.sdoCovered,
   'Brechas originales: '+m.gapCovered,
   'Configuración/corrección: '+m.configuration,
   'Cambios en sistemas externos: '+m.external,
   'Duplicidades: '+m.duplicates,
   'Novedad no acreditada: '+m.notAccredited,
   'Reformulación pendiente: '+m.reformulation
  ]],
  ['Escenarios WBS / PERT finales',[
   'Optimista (O): '+fmtHours(m.finalHours.optimistic),
   'Más probable (M): '+fmtHours(m.finalHours.mostLikely),
   'Horas esperadas PERT: '+fmtHours(m.finalHours.pert),
   'Pesimista (P): '+fmtHours(m.finalHours.pessimistic),
   'Fórmula por actividad: PERT = (O + 4 × M + P) / 6',
   'Actividades WBS técnicamente admitidas: '+m.wbsAccepted
  ]],
  ['Esfuerzo incremental por especialidad',...byArea.map(([k,v])=>[k+': '+fmtHours(v)])],
  ['Estimaciones: bruto frente a incremento',[
   'PERT bruto referencial histórico: '+fmtHours(m.referenceBruteHours),
   'PERT final técnicamente reconocido: '+fmtHours(m.finalHours.pert),
   'PERT no incluido: '+fmtHours(m.notIncludedHours),
   'Solicitudes con estimación histórica: '+m.technicalHistorical,
   'Solicitudes NUEVO_EJE: '+m.newCount,
   'El bruto histórico no constituye trabajo nuevo.'
  ]],
  ['Sistemas externos y alcance original',[
   'Cambio directo SIJ/REMAJU/SERNOT/otros: '+m.external,
   'No corresponde estimar trabajo externo como desarrollo EJE.',
   'Reformular la funcionalidad para interoperar desde EJE cuando corresponda.',
   'Atender las obligaciones SDO y brechas sin reestimarlas.',
   'La existencia de obligación no demuestra su implementación.'
  ]],
  ['R48, duplicidad y solapamientos',[
   'Dictámenes R48 V4 registrados: '+(snapshot.r48?.scope||[]).length,
   'Resoluciones R48 V5 registradas: '+(snapshot.r48?.resolutions||[]).length,
   'Relaciones de solapamiento incluidas: '+m.overlaps,
   'Descuento de componentes solo con sustento verificable.',
   'Cierre de novedad V00 V9 prevalece sobre escenarios anteriores.'
  ]],
  ['Conclusiones técnicas verificables',[
   m.newCount+' funcionalidades nuevas EJE acreditadas de '+m.total+' solicitudes.',
   'Esfuerzo esperado reconocido: '+fmtHours(m.finalHours.pert),
   m.notNew+' solicitudes no integran la suma de nuevos desarrollos.',
   m.notAccredited+' no acreditan novedad técnica con evidencia suficiente.',
   'No utilizar las WBS excluidas como incremento del programa.',
   'Los resultados se derivan de registros individuales V00 V9.'
  ]],
  ['Recomendaciones y próximos controles',[
   'Softplan: atender obligaciones originalmente contratadas.',
   'GTI y sistemas satélite: coordinar cambios fuera del EJE.',
   'GSJ/PEJENP: delimitar reformulaciones exclusivamente EJE.',
   'Equipo técnico: conservar fuentes, versiones, QA y solapamientos.',
   'No presentar esta estimación técnica como aprobación financiera.',
   'Actualizar tablero desde Neon sin reconstruir dictámenes.'
  ]]
 ].map(([t,...x])=>[t,x.flat()]);

 const ct='<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'+pages.map((_,i)=>'<Override PartName="/ppt/slides/slide'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>').join('')+'</Types>';
 const rel=(target,type,id)=>'<Relationship Id="'+id+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/'+type+'" Target="'+target+'"/>';
 const wrapper=s=>'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+s+'</Relationships>';
 const entries=[
 ['[Content_Types].xml',ct],['_rels/.rels',wrapper(rel('ppt/presentation.xml','officeDocument','rId1'))],
 ['ppt/presentation.xml','<p:presentation xmlns:a="'+aNs+'" xmlns:r="'+rNs+'" xmlns:p="'+pNs+'"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>'+pages.map((_,i)=>'<p:sldId id="'+(256+i)+'" r:id="rId'+(i+2)+'"/>').join('')+'</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>'],
 ['ppt/_rels/presentation.xml.rels',wrapper(rel('slideMasters/slideMaster1.xml','slideMaster','rId1')+pages.map((_,i)=>rel('slides/slide'+(i+1)+'.xml','slide','rId'+(i+2))).join(''))],
 ['ppt/slideMasters/slideMaster1.xml','<p:sldMaster xmlns:a="'+aNs+'" xmlns:r="'+rNs+'" xmlns:p="'+pNs+'"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>'],
 ['ppt/slideMasters/_rels/slideMaster1.xml.rels',wrapper(rel('../slideLayouts/slideLayout1.xml','slideLayout','rId1')+rel('../theme/theme1.xml','theme','rId2'))],
 ['ppt/slideLayouts/slideLayout1.xml','<p:sldLayout xmlns:a="'+aNs+'" xmlns:r="'+rNs+'" xmlns:p="'+pNs+'" type="blank" preserve="1"><p:cSld name="En blanco"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'],
 ['ppt/slideLayouts/_rels/slideLayout1.xml.rels',wrapper(rel('../slideMasters/slideMaster1.xml','slideMaster','rId1'))],
 ['ppt/theme/theme1.xml','<a:theme xmlns:a="'+aNs+'" name="Institucional V09"><a:themeElements><a:clrScheme name="Azul"><a:dk1><a:srgbClr val="152F4B"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1E3A5F"/></a:dk2><a:lt2><a:srgbClr val="E9F0F7"/></a:lt2><a:accent1><a:srgbClr val="B68A43"/></a:accent1><a:accent2><a:srgbClr val="496E90"/></a:accent2><a:accent3><a:srgbClr val="4D887C"/></a:accent3><a:accent4><a:srgbClr val="BE7A4B"/></a:accent4><a:accent5><a:srgbClr val="7E6BA1"/></a:accent5><a:accent6><a:srgbClr val="B5B6B8"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Aptos"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme><a:fmtScheme name="Default"><a:fillStyleLst><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="12700"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>'],
 ...pages.flatMap(([title,items],i)=>[['ppt/slides/slide'+(i+1)+'.xml',slide(title,items,i+1,pages.length)],['ppt/slides/_rels/slide'+(i+1)+'.xml.rels',wrapper(rel('../slideLayouts/slideLayout1.xml','slideLayout','rId1'))]])
 ];
 return zipEntries(entries);
}
export const exportAuditPptx=(snap,rows)=>download(buildAuditPptx(snap,rows),'auditoria_integral_eje_no_penal_'+now()+'.pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation');
