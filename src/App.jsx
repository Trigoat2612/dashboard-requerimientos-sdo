import React, {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import InstitutionalLogin from './InstitutionalLogin.jsx';
import InstitutionalDetailPanel from './InstitutionalDetailPanel.jsx';
import AuditV2 from './AuditV2.jsx';
import V09Overview from './V09Overview.jsx';
import GapExplorer from './GapExplorer.jsx';
import { toSafeCsv } from './csv-utils.js';
import {Activity,BookOpen,ClipboardList,FileText,Layers,Calculator,Search,RefreshCw,ExternalLink,ChevronRight,CheckCircle2,AlertCircle,Menu,X,Save,Download,Database,Filter,ShieldCheck,Clock3} from 'lucide-react';

const tabs=[
  {id:'resumen',label:'Resumen ejecutivo V09',icon:Activity},
  {id:'v2',label:'Auditoría y control V00–V08',icon:ShieldCheck},
  {id:'sdo',label:'Cumplimiento SDO · V06',icon:BookOpen},
  {id:'nuevos',label:'Clasificación de solicitudes · V07',icon:ClipboardList},
  {id:'brechas',label:'Brechas consolidadas',icon:AlertCircle},
  {id:'documentos',label:'Bitácora documental',icon:FileText},
  {id:'cobertura',label:'Contraste SDO y evidencias',icon:ShieldCheck},
  {id:'auditoria',label:'Auditoría de cobertura',icon:Filter},
  {id:'metodos',label:'Bolsa de horas · V08',icon:Calculator},
  {id:'historico',label:'Resumen histórico de triaje',icon:Clock3}
];
const states=['Cubierta','Pendiente contractual','Brecha existente','Duplicada','Genuinamente nueva','Indeterminada','Sin evaluación V07'];
const compliance=['Por verificar','Cumple','Cumple parcialmente','No cumple','No aplica'];
const format=n=>new Intl.NumberFormat('es-PE',{maximumFractionDigits:0}).format(Number(n)||0);
const trim=(v,n=210)=>String(v||'').length>n?String(v).slice(0,n)+'…':String(v||'');
function pill(v){const val=String(v||'');if(/confirmada|no cumple|error/i.test(val))return 'pill danger';if(/cumple|validado|leído|contrastad/i.test(val))return 'pill success';if(/pendiente|por verificar|inventariado/i.test(val))return 'pill muted';return 'pill amber';}
function csv(rows,name){const blob=new Blob([toSafeCsv(rows)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
function Stat({icon:Icon,label,value,desc}){return <div className="stat"><div className="stat-top"><span>{label}</span><Icon size={18}/></div><strong>{value}</strong><small>{desc}</small></div>;}
function Field({label,children}){return <label className="field"><span>{label}</span>{children}</label>;}
function Empty({children}){return <div className="empty"><Search size={30}/><p>{children}</p></div>;}
export default function App(){
  const [data,setData]=useState({requests:[],sdo:[],documents:[],methods:[],evidence:[],suggestions:[],assessments:[]});
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[restricted,setRestricted]=useState(false),[publicRedacted,setPublicRedacted]=useState(false);
  const [active,setActive]=useState('resumen'),[query,setQuery]=useState(''),[typeFilter,setTypeFilter]=useState('Todos'),[areaFilter,setAreaFilter]=useState('Todas'),[statusFilter,setStatusFilter]=useState('Todos'),[levelFilter,setLevelFilter]=useState('Todos los niveles'),[page,setPage]=useState(1);
  const [mobile,setMobile]=useState(false),[navSearch,setNavSearch]=useState(''),[selectedDetail,setSelectedDetail]=useState(null);
  const [institutionalToken,setInstitutionalToken]=useState(null),[identity,setIdentity]=useState(null),[sessionNotice,setSessionNotice]=useState('');
  const loadEpoch=useRef(0);
  const emptyData=()=>({requests:[],sdo:[],documents:[],methods:[],evidence:[],suggestions:[],assessments:[]});
  async function refresh(token=institutionalToken){
    const epoch=++loadEpoch.current;
    setLoading(true);setError('');
    try{
      const authenticated=Boolean(token);
      const r=await fetch(authenticated?'/api/institutional-data?view=dashboard':'/api/data',{
        cache:'no-store',headers:authenticated?{Authorization:'Bearer '+token}:{}
      });
      const body=await r.json();
      if(epoch!==loadEpoch.current)return;
      if(authenticated&&(r.status===401||r.status===403)){
        setSessionNotice('Tu sesión institucional terminó o dejó de estar autorizada. Inicia sesión nuevamente.');setIdentity(null);setInstitutionalToken(null);setData(emptyData());setSelectedDetail(null);return;
      }
      if(!r.ok)throw Error(body.error||'Consulta no disponible');
      if(body.access!==(authenticated?'institutional_verified':'public_metadata_only'))throw Error('Respuesta no corresponde al nivel de autorización');
      setData(body);setRestricted(false);setPublicRedacted(!authenticated);
    }catch(e){
      if(epoch!==loadEpoch.current)return;
      setData(emptyData());setRestricted(true);setPublicRedacted(false);setError(e.message||'Error de consulta');
    }finally{if(epoch===loadEpoch.current)setLoading(false);}
  }
  useEffect(()=>{refresh(institutionalToken);},[institutionalToken]);
  useEffect(()=>{setQuery(navSearch);setTypeFilter('Todos');setAreaFilter('Todas');setStatusFilter('Todos');setLevelFilter('Todos los niveles');setPage(1);setMobile(false)},[active,navSearch]);
  const onCredential=useCallback(async credential=>{
    const r=await fetch('/api/auth-session',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential}),cache:'no-store'
    });
    const result=await r.json();
    if(!r.ok||!result.authenticated)throw Error(result.error||'Acceso institucional no autorizado');
    setSessionNotice('');setSelectedDetail(null);setIdentity({email:result.email,expiresAt:result.expiresAt});setInstitutionalToken(credential);
  },[]);
  const signOut=useCallback((notice='')=>{
    setSessionNotice(typeof notice==='string'?notice:'');
    ++loadEpoch.current;
    setInstitutionalToken(null);setIdentity(null);setData(emptyData());setSelectedDetail(null);
    setPublicRedacted(false);setRestricted(false);
  },[]);
  useEffect(()=>{
    if(!identity?.expiresAt || !institutionalToken)return;
    const remaining=identity.expiresAt*1000-Date.now();
    if(remaining<=0){signOut('Tu sesión institucional expiró. Vuelve a identificarte para consultar los análisis.');return;}
    const timeout=setTimeout(()=>signOut('Tu sesión institucional expiró. Vuelve a identificarte para consultar los análisis.'),remaining);
    return ()=>clearTimeout(timeout);
  },[identity,institutionalToken,signOut]);
  const [assessmentFetch,setAssessmentFetch]=useState({loading:false,loaded:0,total:0});
  useEffect(()=>{
    if(!institutionalToken||!['cobertura','auditoria'].includes(active))return;
    const controller=new AbortController();
    const load=async()=>{
      setAssessmentFetch({loading:true,loaded:0,total:0});
      const pageFetch=async(page)=>{
        const r=await fetch('/api/institutional-data?view=assessments&page='+page,{
          headers:{Authorization:'Bearer '+institutionalToken},cache:'no-store',signal:controller.signal
        });
        const body=await r.json();
        if(r.status===401||r.status===403){
          signOut('Sesión institucional vencida o sin autorización. Inicia sesión nuevamente.');
          throw Error('La sesión requiere nueva autenticación');
        }
        if(!r.ok||body.access!=='institutional_verified'||!Array.isArray(body.rows))throw Error(body.error||'Evaluaciones documentales no disponibles');
        return body;
      };
      try {
        const first=await pageFetch(1);
        if(!Number.isSafeInteger(first.total)||first.total<0||first.pageSize!==200)throw Error('Metadatos de paginación inválidos');
        const pages=Math.ceil(first.total/first.pageSize);
        if(pages>100)throw Error('Volumen excede el límite de consulta actual');
        const accumulated=[...first.rows];
        setAssessmentFetch({loading:true,loaded:accumulated.length,total:first.total});
        for(let n=2;n<=pages;n+=4){
          const batch=await Promise.all(Array.from({length:Math.min(4,pages-n+1)},(_,i)=>pageFetch(n+i)));
          for(const result of batch)accumulated.push(...result.rows);
          if(controller.signal.aborted)return;
          setAssessmentFetch({loading:true,loaded:accumulated.length,total:first.total});
        }
        if(controller.signal.aborted)return;
        setData(prev=>prev.access==='institutional_verified'?{...prev,assessments:accumulated}:prev);
      } catch(e) {
        if(!controller.signal.aborted)setError(e.message||'Consulta de evaluaciones no disponible');
      } finally {if(!controller.signal.aborted)setAssessmentFetch(prev=>({...prev,loading:false}));}
    };
    load();
    return ()=>controller.abort();
  },[active,institutionalToken,signOut]);
  const areas=useMemo(()=>[...new Set(data.requests.map(x=>x.area).filter(Boolean))].sort(),[data.requests]);
  const sdoReviewStates=useMemo(()=>[...new Set(data.sdo.map(r=>r.verification_status).filter(Boolean))].sort(),[data.sdo]);
  const v06ReviewStates=useMemo(()=>[...new Set(data.sdo.map(r=>r.v06_evaluation).filter(Boolean))].sort(),[data.sdo]);
  const sdoWithEvidence=new Set(data.evidence.map(e=>e.sdo_code).filter(Boolean)).size;
  const sdoWithGap=data.sdo.filter(r=>/brecha|riesgo|incidencia|observado|pendiente en v1|no cerrado/i.test(r.verification_status||'')).length;
  const actasReportadas=data.sdo.filter(r=>r.progress_reported==='Atendido').length;
  const actasPendientes=data.sdo.filter(r=>r.progress_reported==='Pendiente').length;
  const sdoTypes=useMemo(()=>Object.entries(data.sdo.reduce((a,r)=>(a[String(r.requirement_type||'').trim()]=(a[String(r.requirement_type||'').trim()]||0)+1,a),{})),[data.sdo]);
  const filteredAssessments=useMemo(()=>data.assessments.filter(a=>(statusFilter==='Todos'||a.coverage===statusFilter)&&(levelFilter==='Todos los niveles'||a.review_level===levelFilter)&&[a.sdo_code,a.document_title,a.criterion,a.coverage,a.finding,a.missing_validation].join(' ').toLowerCase().includes(query.toLowerCase())),[data.assessments,statusFilter,levelFilter,query]);
  const assessmentsStates=useMemo(()=>[...new Set(data.assessments.map(a=>a.coverage))].sort(),[data.assessments]);
  const assessmentLevels=useMemo(()=>[...new Set(data.assessments.map(a=>a.review_level).filter(Boolean))].sort(),[data.assessments]);
  const docsReviewed=data.documents.filter(x=>/le[ií]do|contrastad|verificad|inspeccionad|examinad/i.test(x.scan_status)).length;
  const reviewedByDoc=useMemo(()=>{const m=new Map();data.assessments.forEach(a=>{const k=String(a.document_id);const x=m.get(k)||{count:0,levels:new Set(),coverage:new Set(),finding:''};x.count++;x.levels.add(a.review_level||'Sin nivel');x.coverage.add(a.coverage);if(!x.finding||a.review_level==='Análisis documental contrastado')x.finding=a.finding;m.set(k,x)});return m},[data.assessments]);
  const visibleDocumentIds=useMemo(()=>new Set(data.documents.map(d=>String(d.id))),[data.documents]);
  const detailedCount=[...reviewedByDoc.entries()].filter(([id,x])=>visibleDocumentIds.has(id)&&x.levels.has('Análisis documental contrastado')).length;
  const assessedCount=[...reviewedByDoc.keys()].filter(id=>visibleDocumentIds.has(id)).length;
  const auditRows=useMemo(()=>{const linked=new Set(data.evidence.map(e=>String(e.document_id)));return data.documents.map(d=>{const a=reviewedByDoc.get(String(d.id));const level=!a?'Sin evaluación':a.levels.has('Análisis documental contrastado')?'Contraste detallado':a.levels.has('Análisis documental preliminar')?'Análisis preliminar':'Inspección preliminar';return {...d,assessment_count:a?.count||0,linked:linked.has(String(d.id)),review_level_display:level,review_finding:a?.finding||'',not_verifiable:a?.coverage.size===1&&a.coverage.has('No verificable')}}).filter(d=>(statusFilter==='Todos'||(statusFilter==='Con contraste detallado'&&d.review_level_display==='Contraste detallado')||(statusFilter==='Con análisis preliminar'&&d.review_level_display==='Análisis preliminar')||(statusFilter==='Solo inspección preliminar'&&d.review_level_display==='Inspección preliminar')||(statusFilter==='Sin registro'&&d.assessment_count===0)||(statusFilter==='No verificable'&&d.not_verifiable)||(statusFilter==='Con vínculo SDO'&&d.linked))&&[d.title,d.scan_status,d.verification_notes,d.category,d.review_finding].join(' ').toLowerCase().includes(query.toLowerCase()))},[data.documents,reviewedByDoc,data.evidence,statusFilter,query]);
  const withSDO=data.requests.filter(x=>String(x.sdo_reference||'').trim().length>0).length;
  const filteredRequests=useMemo(()=>data.requests.filter(r=>(areaFilter==='Todas'||r.area===areaFilter)&&(statusFilter==='Todos'||(r.v07_classification||r.status)===statusFilter)&&[r.request_code,r.request_text,r.area,r.component,r.sdo_reference,r.gap_reference,r.comments,r.v07_classification,r.v07_basis,r.v07_contractual_evidence].join(' ').toLowerCase().includes(query.toLowerCase())),[data.requests,areaFilter,statusFilter,query]);
  const filteredSdo=useMemo(()=>data.sdo.filter(r=>(typeFilter==='Todos'||String(r.requirement_type||'').trim()===typeFilter)&&(statusFilter==='Todos'||(statusFilter.startsWith('V06: ')?r.v06_evaluation===statusFilter.slice(5):r.verification_status===statusFilter))&&[r.code,r.component,r.description,r.layer,r.stage,r.verification_status,r.notes,r.v06_evaluation,r.v06_basis,r.v06_missing_validation].join(' ').toLowerCase().includes(query.toLowerCase())),[data.sdo,typeFilter,statusFilter,query]);
  const filteredDocs=useMemo(()=>data.documents.filter(r=>(typeFilter==='Todos'||r.category===typeFilter)&&(statusFilter==='Todos'||r.scan_status===statusFilter)&&[r.title,r.category,r.mime_type,r.verification_notes].join(' ').toLowerCase().includes(query.toLowerCase())),[data.documents,typeFilter,statusFilter,query]);
  const byArea=useMemo(()=>Object.entries(data.requests.reduce((m,r)=>(m[r.area||'Sin área']=(m[r.area||'Sin área']||0)+1,m),{})).sort((a,b)=>b[1]-a[1]),[data.requests]);
  const allStatus=useMemo(()=>[...new Set(data.documents.map(x=>x.scan_status))].sort(),[data.documents]);
  const docCat=useMemo(()=>[...new Set(data.documents.map(x=>x.category))].sort(),[data.documents]);
  const exportRows=()=>{
    if(active==='nuevos')csv(publicRedacted?[['Código','Área','Componente','SDO','Clasificación V07 propuesta','Estado de propuesta'],...filteredRequests.map(x=>[x.request_code,x.area,x.component,x.sdo_reference,x.v07_classification,x.v07_proposal_status])]:[['Código','Área','Solicitud original','Componente','SDO','Clasificación V07 propuesta','Fundamento V07','Evidencia contractual','Estado de propuesta'],...filteredRequests.map(x=>[x.request_code,x.area,x.request_text,x.component,x.sdo_reference,x.v07_classification,x.v07_basis,x.v07_contractual_evidence,x.v07_proposal_status])], 'clasificacion_v07.csv');
    else if(active==='sdo')csv(publicRedacted?[['Código','Componente','Tipo','Ciclo','Evaluación V06 propuesta','Estado de propuesta'],...filteredSdo.map(x=>[x.code,x.component,x.requirement_type,x.cycle,x.v06_evaluation,x.v06_proposal_status])]:[['Código','Componente','Tipo','Descripción contractual','Ciclo','Estado oficial','Evaluación V06 propuesta','Fundamento V06','Pendiente de validación','Estado de propuesta'],...filteredSdo.map(x=>[x.code,x.component,x.requirement_type,x.description,x.cycle,x.verification_status,x.v06_evaluation,x.v06_basis,x.v06_missing_validation,x.v06_proposal_status])], 'contraste_sdo_v06.csv');
    else if(active==='auditoria')csv([['Documento','Tipo','Lectura registrada','Vínculo SDO','Nivel real','Registros','Hallazgo','Notas'],...auditRows.map(d=>[d.title,d.mime_type,d.scan_status,d.linked?'Sí':'No',d.review_level_display,d.assessment_count,d.review_finding,d.verification_notes])],'auditoria_cobertura_documental.csv');
    else if(active==='cobertura')csv([['Código SDO','Documento','Criterio','Cobertura documental','Hallazgo','Verificación pendiente','Fuente'],...filteredAssessments.map(a=>[a.sdo_code,a.document_title,a.criterion,a.coverage,a.finding,a.missing_validation,a.source_detail])],'contraste_sdo_evidencias.csv');
    else csv([['Documento','Categoría','Estado','Enlace','Observaciones'],...filteredDocs.map(x=>[x.title,x.category,x.scan_status,x.url,x.verification_notes])],'bitacora_documental.csv');
  };
  const pageSource=active==='nuevos'?filteredRequests:active==='sdo'?filteredSdo:active==='cobertura'?filteredAssessments:active==='auditoria'?auditRows:filteredDocs;
  const pageCount=Math.max(1,Math.ceil(pageSource.length/25));
  const safePage=Math.min(Math.max(1,page),pageCount);
  const currentPage=pageSource.slice((safePage-1)*25,safePage*25);
  const detail=selectedDetail?.kind==='sdo'?data.sdo.find(r=>r.code===selectedDetail.id):selectedDetail?.kind==='request'?data.requests.find(r=>r.request_code===selectedDetail.id):selectedDetail?.kind==='document'?data.documents.find(r=>r.id===selectedDetail.id):selectedDetail?.kind==='assessment'?data.assessments.find(r=>String(r.id)===String(selectedDetail.id)):null;
  function nav(id,search='',selected=null){setSelectedDetail(selected);setNavSearch(search);setActive(id)}
  return <div className="app-shell">
    <aside className={'sidebar '+(mobile?'mobile-open':'')}>
      <div className="brand"><div className="brand-icon"><Layers size={23}/></div><div><strong>EJE No Penal</strong><span>Inteligencia de requerimientos</span></div><button className="mobile-close" onClick={()=>setMobile(false)}><X size={19}/></button></div>
      <div className="side-label">ESPACIO DE TRABAJO</div>
      <nav>{tabs.map(t=>{const Icon=t.icon;return <button key={t.id} onClick={()=>nav(t.id)} className={'nav-button '+(active===t.id?'active':'')}><Icon size={19}/><span>{t.label}</span>{active===t.id&&<ChevronRight size={15}/>}</button>})}</nav>
      <div className="side-bottom"><div className="db-state"><span className={'indicator '+(error?'bad':'')}></span> Fuente de datos: Neon</div><p>Análisis preliminar y trazable. No acredita cumplimiento ni autoriza consumo de horas.</p><div className="side-version">Versión de trabajo · Noviembre 2026</div></div>
    </aside>
    {mobile&&<div className="sidebar-overlay" onClick={()=>setMobile(false)} />}
    <main className="main">
      <div className="topbar"><button className="icon-button menu-button" onClick={()=>setMobile(true)}><Menu size={20}/></button><div className="top-path"><span>Programa EJE No Penal</span><ChevronRight size={14}/><b>{tabs.find(t=>t.id===active)?.label}</b></div><button className="outline-btn refresh" onClick={()=>refresh(institutionalToken)} disabled={loading}><RefreshCw size={15} className={loading?'spin':''}/> Actualizar</button><InstitutionalLogin identity={identity} onCredential={onCredential} onLogout={signOut}/></div>
      <div className="workspace">
      {sessionNotice&&<div className="insight" role="status"><ShieldCheck size={18}/><div><b>Sesión institucional</b><p>{sessionNotice}</p></div></div>}
      {error&&<div className="error-banner"><AlertCircle size={18}/><span>{error}. Verifica la disponibilidad de Neon y la configuración del servidor.</span><button onClick={()=>refresh(institutionalToken)}>Reintentar</button></div>}
      {data.generatedAt&&<div className="mini">Última consulta de registros: {new Date(data.generatedAt).toLocaleString('es-PE')}</div>}
      {assessmentFetch.loading&&['cobertura','auditoria'].includes(active)&&<div className="insight" role="status"><FileText size={18}/><div><b>Cargando trazabilidad documental</b><p>{assessmentFetch.loaded} de {assessmentFetch.total||'…'} evaluaciones recuperadas en lotes autorizados.</p></div></div>}
      {publicRedacted&&active!=='resumen'&&<div className="insight"><ShieldCheck size={18}/><div><b>Consulta disponible · datos protegidos</b><p>Se muestran códigos, clasificaciones, cobertura y metadatos anonimizados de Neon. Las descripciones contractuales, los fundamentos técnicos, nombres y enlaces documentales permanecen reservados hasta verificar autorización individual. V06/V07 no equivalen a conformidades oficiales.</p></div></div>}
      <header className="page-header"><div><span className="eyebrow">CONTROL Y TRAZABILIDAD</span><h1>{tabs.find(t=>t.id===active)?.label}</h1><p>{active==='v2'?'Avance independiente de la auditoría documental, el cumplimiento SDO, las brechas, las solicitudes y la bolsa de horas.':active==='resumen'?'Corte integrado de V06, V07 y V08 basado en Neon y separado de conformidades oficiales.':active==='historico'?'Vista histórica sin estimaciones sustentadas ni detalles restringidos.':active==='sdo'?'Requisitos SDO codificados y dictámenes propuestos V06; el texto contractual original no se publica en modo anónimo.':active==='nuevos'?'Solicitudes clasificadas por V07. Las descripciones originales y condiciones individuales exigen acceso institucional.':active==='documentos'?'Inventario anonimizado por archivo; títulos y versiones están disponibles solo con acceso institucional.':active==='cobertura'?'Evaluaciones por documento y criterio SDO, diferenciando evidencia de conformidad.':active==='auditoria'?'Auditoría de inventario: vínculo documental no equivale a cumplimiento.':'Contraste de métodos para dimensionar la bolsa de horas y sus riesgos.'}</p></div><span className="live"><span className="green-dot"/> {loading?'Cargando':restricted?'Sin conexión de detalle':publicRedacted?'Datos anonimizados de Neon':'Consulta institucional autorizada'}</span></header>
      {active==='resumen'&&<V09Overview onNavigate={nav}/>}
      {active==='v2'&&<AuditV2/>}
      {active==='brechas'&&<GapExplorer onOpenSdo={code=>nav('sdo',code,{kind:'sdo',id:code})} onOpenRequest={code=>nav('nuevos',code,{kind:'request',id:code})}/>}
      {restricted&&['sdo','nuevos','documentos','cobertura','auditoria','metodos','historico'].includes(active)&&<div className="insight"><ShieldCheck size={20}/><div><b>Consulta temporalmente no disponible</b><p>El servicio no entregó metadatos consultables. Los indicadores agregados siguen disponibles en el resumen ejecutivo. Reintenta la conexión; nunca se publicarán datos restringidos sin autorización.</p></div></div>}
      {!restricted&&active==='historico'&&<><section className="stat-grid">
        <Stat icon={ClipboardList} label="Candidatos de backlog" value={format(data.requests.length)} desc="Aún no son desarrollos aprobados"/>
        <Stat icon={BookOpen} label="Requisitos funcionales" value={format(data.sdo.filter(r=>/funcional/i.test(r.requirement_type||'')&&!/no funcional/i.test(r.requirement_type||'')).length)} desc="Matriz SDO"/>
        <Stat icon={ShieldCheck} label="Requisitos no funcionales" value={format(data.sdo.filter(r=>/no funcional/i.test(r.requirement_type||'')).length)} desc="Matriz SDO"/>
        <Stat icon={FileText} label="Documentos inventariados" value={format(data.documents.length)} desc={format(assessedCount)+' con registro de evaluación (no acredita conformidad)'}/>
      </section>
      <section className="summary-grid"><div className="panel"><div className="panel-heading"><div><h2>Distribución de candidatos</h2><p>Solicitudes por unidad o especialidad</p></div></div><div className="area-bars">{byArea.slice(0,9).map(([area,n])=><div className="area-bar" key={area}><div className="area-caption"><span title={area}>{trim(area,43)}</span><strong>{n}</strong></div><div className="track"><div className="fill" style={{width:(n/Math.max(1,byArea[0]?.[1]))*100+'%'}}/></div></div>)}</div></div>
      <div className="panel side-panel"><div className="panel-heading"><div><h2>Horas de triaje histórico</h2><p>No son estimaciones independientes ni aprobadas</p></div><Clock3 size={19}/></div><div className="hours-hero">No disponible <span>en vista pública</span></div><p className="muted">Suma orientativa de escenarios centrales antes de determinar si las solicitudes están fuera del alcance original, cuentan con evidencia de brecha y requieren desarrollo.</p><div className="divider"/><div className="fact"><span>Solicitudes con referencias SDO</span><b>{withSDO} / {data.requests.length}</b></div><div className="fact"><span>Solicitudes por verificar</span><b>{data.requests.filter(r=>r.compliance_status==='Por verificar').length}</b></div><div className="fact"><span>Documentos con lectura registrada</span><b>{docsReviewed}</b></div><div className="fact"><span>Requisitos con vínculo documental</span><b>{sdoWithEvidence} / {data.sdo.length}</b></div><div className="fact"><span>Observaciones restringidas</span><b>No publicadas</b></div><div className="fact"><span>RFU con acta informada</span><b>{actasReportadas} / {actasReportadas+actasPendientes}</b></div><div className="mini">Fuente: matriz de avance funcional, evidencia declarada por casos con acta; no acredita cumplimiento de todos los criterios.</div></div></section>
      <div className="insight"><AlertCircle size={20}/><div><b>Regla de interpretación</b><p>Una referencia SDO, un diseño o un manual no equivale a prueba de cumplimiento. La clasificación definitiva requiere evidencia funcional, casos de prueba y conformidad. Las horas estimadas se ajustarán tras ese cotejo.</p></div></div>
      <div className="insight"><ShieldCheck size={20}/><div><b>Contraste documental con criterios explícitos</b><p>{format(data.assessments.length)} registros de evaluación y clasificación; {format(data.assessments.filter(a=>a.review_level==='Análisis documental contrastado').length)} son contrastes documentales detallados. Ninguno equivale por sí solo a certificar cumplimiento.</p><button className="outline-btn" onClick={()=>nav('cobertura')}>Consultar contraste SDO</button></div></div>
      <section className="quick-nav"><button onClick={()=>nav('nuevos')}><ClipboardList size={21}/><b>Revisar los 68 candidatos</b><span>Consultar componente, SDO, brecha y estimación <ChevronRight size={16}/></span></button><button onClick={()=>nav('documentos')}><FileText size={21}/><b>Consultar la bitácora</b><span>Archivos, versiones y nivel de lectura <ChevronRight size={16}/></span></button></section></>}
      {!restricted&&active==='auditoria'&&<div className="insight"><ShieldCheck size={20}/><div><b>Cobertura de registros, no de cumplimiento</b><p>{format(assessedCount)} de {format(data.documents.length)} archivos cuentan con algún registro; {format(detailedCount)} poseen contraste documental detallado. Los demás requieren evaluación individual de contenido, versiones, pruebas y actas antes de emitir conformidad por requisito SDO.</p></div></div>}
      {!restricted&&['sdo','nuevos','documentos','cobertura','auditoria'].includes(active)&&<><section className="toolbar"><div className="search"><Search size={17}/><input placeholder={active==='nuevos'?'Buscar código, clasificación y SDO...':active==='sdo'?'Buscar código, componente y dictamen V06...':active==='cobertura'?'Buscar SDO y nivel de cobertura...':'Buscar documento, carpeta, extensión...'} value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}}/></div>{active==='nuevos'&&<><select value={areaFilter} onChange={e=>{setAreaFilter(e.target.value);setPage(1)}}><option>Todas</option>{areas.map(x=><option key={x}>{x}</option>)}</select><select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1)}}><option>Todos</option>{states.map(x=><option key={x}>{x}</option>)}</select></>}
      {active==='sdo'&&<><select value={typeFilter} onChange={e=>{setTypeFilter(e.target.value);setPage(1)}}><option>Todos</option>{sdoTypes.map(([t])=><option key={t}>{t}</option>)}</select><select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1)}}><option>Todos</option>{sdoReviewStates.map(x=><option key={x}>{x}</option>)}{v06ReviewStates.map(x=><option key={x} value={'V06: '+x}>{'V06: '+x}</option>)}</select></>}
      {active==='auditoria'&&<select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1)}}><option>Todos</option><option>Con contraste detallado</option><option>Con análisis preliminar</option><option>Solo inspección preliminar</option><option>No verificable</option><option>Con vínculo SDO</option><option>Sin registro</option></select>}
      {active==='cobertura'&&<><select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1)}}><option>Todos</option>{assessmentsStates.map(x=><option key={x}>{x}</option>)}</select><select value={levelFilter} onChange={e=>{setLevelFilter(e.target.value);setPage(1)}}><option>Todos los niveles</option>{assessmentLevels.map(x=><option key={x}>{x}</option>)}</select></>}
      {active==='documentos'&&<><select value={typeFilter} onChange={e=>{setTypeFilter(e.target.value);setPage(1)}}><option>Todos</option>{docCat.map(x=><option key={x}>{x}</option>)}</select><select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1)}}><option>Todos</option>{allStatus.map(x=><option key={x}>{x}</option>)}</select></>}
      <button className="outline-btn" onClick={exportRows}><Download size={16}/> CSV</button></section>
      <div className="result-count"><Filter size={14}/>{format(active==='nuevos'?filteredRequests.length:active==='sdo'?filteredSdo.length:active==='cobertura'?filteredAssessments.length:active==='auditoria'?auditRows.length:filteredDocs.length)} registros encontrados <span>· 25 por página</span></div>
      <section className="table-panel"><div className="table-scroll"><table><thead>{active==='nuevos'?<tr><th>Código</th><th>Área</th><th>Requerimiento propuesto</th><th>Componente</th><th>RF/RNF SDO</th><th>Brecha</th><th>Observaciones</th><th>Clasificación V07 (propuesta)</th><th>Estimación V08</th><th></th></tr>:active==='auditoria'?<tr><th>Documento</th><th>Tipo</th><th>Estado de lectura</th><th>Vínculo SDO</th><th>Nivel real de revisión</th><th>Hallazgo y pendientes</th></tr>:active==='cobertura'?<tr><th>Requisito</th><th>Documento</th><th>Criterio</th><th>Cobertura</th><th>Hallazgo y validación requerida</th><th>Fuente</th></tr>:active==='sdo'?<tr><th>Código</th><th>Componente</th><th>Tipo</th><th>Descripción SDO</th><th>Ciclo</th><th>Avance reportado</th><th>Estado oficial</th><th>Dictamen V06 (propuesto)</th><th>Observación y pendiente</th><th>Evidencia</th></tr>:<tr><th>Documento</th><th>Origen</th><th>Tipo</th><th>Estado de revisión</th><th>Evidencia</th></tr>}</thead><tbody>
      {active==='nuevos'&&currentPage.map(r=><tr key={r.id}><td><button className="outline-btn mono" onClick={()=>setSelectedDetail({kind:'request',id:r.request_code})}>{r.request_code}</button></td><td>{trim(r.area,42)}</td><td className="description" title={r.request_text}>{trim(r.request_text,200)}</td><td><span className="muted">{trim(r.component||'Por asociar',90)}</span></td><td><span className="mono">{trim(r.sdo_reference||'Por asociar',100)}</span></td><td className="description">{trim(r.gap_reference||'Sin brecha confirmada',105)}</td><td className="description">{trim(r.comments||'Sin observaciones',95)}</td><td><span className={pill(r.v07_classification)}>{r.v07_classification||'Sin dictamen V07'}</span><div className="mini">{r.v07_proposal_status||'Pendiente'}</div></td><td><span className="mini">{Number(r.v08_independent_method_count)>0?Number(r.v08_independent_method_count)+' método(s) V08 propuestos · horas reservadas':'Sin registros de estimación V08'}</span></td><td><span className="mini">Solo lectura</span></td></tr>)}
      {active==='sdo'&&currentPage.map(r=><tr key={r.code}><td><button className="outline-btn mono" onClick={()=>setSelectedDetail({kind:'sdo',id:r.code})}>{r.code}</button></td><td>{r.component}</td><td><span className={pill(r.requirement_type)}>{String(r.requirement_type||'').trim()}</span></td><td className="description" title={r.description}>{trim(r.description,275)}</td><td>{r.cycle}</td><td>{r.progress_reported?<><span className={pill(r.progress_reported)}>{r.progress_reported==='Atendido'?'Acta reportada':'Sin acta reportada'}</span><div className="mini" title={r.progress_basis||''}>{r.progress_route_count||0} rutas documentadas</div></>:<span className="mini">Sin dato de avance</span>}</td><td><span className={pill(r.verification_status)}>{r.verification_status}</span></td><td><span className={pill(r.v06_evaluation)}>{r.v06_evaluation||'Sin dictamen V06'}</span><div className="mini">{r.v06_proposal_status||'Pendiente de evaluación'}</div></td><td className="description" title={r.notes||''}>{trim(r.notes||'Sin conclusión documental específica; corresponde cotejo técnico y funcional.',240)}</td><td>{(data.evidence||[]).filter(x=>x.sdo_code===r.code).slice(0,2).map(x=><div key={x.document_id} className="mini">{x.document_url?<a className="doc-link" href={x.document_url} target="_blank" rel="noreferrer" title={x.rationale}>{trim(x.document_title||'Documento',39)} <ExternalLink size={12}/></a>:trim(x.document_title||'Documento',30)}</div>)}{!(data.evidence||[]).some(x=>x.sdo_code===r.code)&&<span className="mini">Sin vínculo localizado</span>}</td></tr>)}
      {active==='cobertura'&&currentPage.map(a=><tr key={a.id}><td><button className="outline-btn mono" onClick={()=>setSelectedDetail({kind:'assessment',id:a.id})}>{a.sdo_code||'Transversal'} · Ver análisis</button></td><td><b>{trim(a.document_title,80)}</b></td><td>{a.criterion}</td><td><span className={pill(a.coverage)}>{a.coverage}</span><div className="mini">{a.review_level||'Sin nivel declarado'}</div></td><td className="description"><b>Hallazgo:</b> {a.finding||'Abrir ficha para consultar el análisis completo'}<div className="doc-notes"><b>Pendiente:</b> {a.missing_validation||'Disponible en ficha autorizada'}</div></td><td><span className="mini">{a.source_detail}</span>{a.document_url&&<div><a className="doc-link" href={a.document_url} target="_blank" rel="noreferrer">Abrir origen <ExternalLink size={13}/></a></div>}</td></tr>)}
      {active==='auditoria'&&currentPage.map(r=><tr key={r.id}><td><b>{trim(r.title,100)}</b></td><td>{r.mime_type?.split('/').at(-1)||'Sin tipo'}</td><td><span className={pill(r.scan_status)}>{r.scan_status}</span></td><td>{r.linked?'Sí, vínculo por confirmar':'Sin vínculo'}</td><td><span className={r.review_level_display==='Contraste detallado'?'pill success':'pill muted'}>{r.review_level_display}</span><div className="mini">{r.assessment_count} registro(s)</div></td><td className="description">{trim(r.review_finding||(!publicRedacted?'Abrir ficha de documento para consultar el análisis':'Requiere contraste documental'),260)}{r.verification_notes&&<details className="doc-notes"><summary>Notas anteriores</summary><p>{r.verification_notes}</p></details>}{r.url&&<div><a className="doc-link" href={r.url} target="_blank" rel="noreferrer">Abrir origen <ExternalLink size={13}/></a></div>}</td></tr>)}
      {active==='documentos'&&currentPage.map(r=><tr key={r.id}><td><button className="outline-btn" onClick={()=>setSelectedDetail({kind:'document',id:r.id})}>{trim(r.title,115)}</button><div className="mini">{r.modified_at?('Versión origen · '+r.modified_at.slice(0,10)):'Fecha origen no disponible'}</div></td><td>{r.category}</td><td><span className="mini">{r.mime_type?.split('/').at(-1)}</span></td><td><span className={pill(r.scan_status)}>{r.scan_status}</span></td><td>{r.url&&<a className="doc-link" href={r.url} target="_blank" rel="noreferrer">Abrir <ExternalLink size={14}/></a>}{r.verification_notes&&<details className="doc-notes"><summary>Ver análisis</summary><p>{r.verification_notes}</p></details>}</td></tr>)}
      </tbody></table>{currentPage.length===0&&<Empty>No hay registros con los filtros actuales. Modifica la búsqueda o actualiza el corte de Neon.</Empty>}</div></section>
      <div className="pager"><span>Página {safePage} de {pageCount}</span><div><button onClick={()=>setPage(Math.max(1,safePage-1))} disabled={safePage===1}>Anterior</button><button onClick={()=>setPage(Math.min(pageCount,safePage+1))} disabled={safePage>=pageCount}>Siguiente</button></div></div>
      </>}
      {!restricted&&publicRedacted&&detail&&<section className="panel" aria-live="polite">
        <div className="panel-heading"><div><h2>Ficha de consulta · {selectedDetail?.id}</h2><p>Metadatos de solo lectura. Las fuentes originales requieren autorización institucional.</p></div><button className="outline-btn" onClick={()=>setSelectedDetail(null)}>Cerrar ficha</button></div>
        {selectedDetail?.kind==='sdo'&&<>
          <p><b>Componente:</b> {detail.component||'Sin asignar'} · <b>Tipo:</b> {detail.requirement_type||'Sin identificar'} · <b>Ciclo:</b> {detail.cycle||'Sin dato'}</p>
          <p><b>Etapa / capa:</b> {detail.stage||'Sin dato'} / {detail.layer||'Sin dato'}</p>
          <p><b>Dictamen V06 propuesto:</b> {detail.v06_evaluation||'Sin evaluación'} · <b>Estado de propuesta:</b> {detail.v06_proposal_status||'Pendiente'}</p>
          <p><b>Estado oficial:</b> {detail.verification_status||'No publicado'} · <b>Texto contractual:</b> reservado.</p>
          <h3>Referencias anonimizadas ({data.evidence.filter(e=>e.sdo_code===detail.code).length})</h3>
          <div className="methods-grid">{data.evidence.filter(e=>e.sdo_code===detail.code).slice(0,40).map((e,i)=><button key={String(e.document_id)+i} className="outline-btn" onClick={()=>nav('documentos',e.document_title)}>{e.document_title}</button>)}</div>
          <p className="muted">Una referencia documental no acredita cumplimiento. Fundamentación y condiciones pendientes: reservadas.</p>
        </>}
        {selectedDetail?.kind==='request'&&<>
          <p><b>Área:</b> {detail.area||'Sin dato'} · <b>Componente:</b> {detail.component||'Sin dato'}</p>
          <p><b>Clasificación V07 propuesta:</b> {detail.v07_classification||'Sin clasificación'} · <b>Estado:</b> {detail.v07_proposal_status||'Pendiente'}</p>
          <p><b>SDO relacionado:</b> {detail.sdo_reference||'Sin referencia'} · <b>Brechas confirmadas:</b> no acreditadas en este módulo.</p>
          <p><b>Estimación V08:</b> {Number(detail.v08_independent_method_count)||0} método(s) independiente(s) registrado(s). Las horas propuestas no se publican aquí y no representan aprobación.</p>
          <p className="muted">Descripción, justificación contractual y condiciones individuales de desbloqueo: reservadas.</p>
        </>}
        {selectedDetail?.kind==='document'&&<>
          <p><b>Categoría:</b> {detail.category||'Sin categoría'} · <b>Formato:</b> {detail.mime_type||'Desconocido'} · <b>Lectura:</b> {detail.scan_status||'No indicada'}</p>
          <p><b>Evaluaciones registradas:</b> {data.assessments.filter(a=>a.document_id===detail.id).length}, sin equivalencia automática con conformidad.</p>
          <h3>Requisitos referenciados en evaluaciones</h3>
          <div className="methods-grid">{[...new Set(data.assessments.filter(a=>a.document_id===detail.id).map(a=>a.sdo_code).filter(Boolean))].slice(0,40).map(code=><button key={code} className="outline-btn" onClick={()=>nav('sdo',code)}>{code}</button>)}</div>
          <p className="muted">Título original, versión, hallazgos y enlaces de Drive: reservados.</p>
        </>}
      </section>}
      {!restricted&&!publicRedacted&&institutionalToken&&selectedDetail&&<InstitutionalDetailPanel key={String(selectedDetail.kind)+String(selectedDetail.id)} token={institutionalToken} kind={selectedDetail.kind} id={selectedDetail.id} onUnauthorized={signOut} onClose={()=>setSelectedDetail(null)} onNavigate={(kind,id)=>nav(kind==='sdo'?'sdo':kind==='request'?'nuevos':'documentos',kind==='document'?(data.documents.find(d=>String(d.id)===String(id))?.title||''):String(id),{kind,id})}/>}
      {!restricted&&active==='metodos'&&<><div className="insight"><ShieldCheck size={20}/><div><b>Recomendación operativa</b><p>Triaje mediante estimación de tres puntos por paquetes de trabajo. Para solicitudes funcionales aprobadas, contrastar con el conteo IFPUG del proveedor. Para tareas no funcionales, exigir horas técnicas justificadas y calibración de productividad real.</p></div></div><div className="methods-grid">{data.methods.map(m=><article className="panel method" key={m.name}><div className="method-head"><h2>{m.name}</h2>{m.supplier_proposed&&<span className="pill amber">Proveedor</span>}</div><p>{m.description}</p><h3>Ventaja</h3><p>{m.strengths}</p><h3>Precaución</h3><p>{m.risks}</p><div className="method-decision"><b>Aplicación propuesta</b><p>{m.decision}</p></div>{String(m.source_document_id||'').startsWith('https://')&&<a className="doc-link" href={m.source_document_id} target="_blank" rel="noreferrer">Referencia metodológica <ExternalLink size={14}/></a>}</article>)}</div><div className="panel"><h2>Métodos para contrastar estimaciones (sin aprobación automática)</h2><p className="muted">Los valores y parámetros de productividad de proveedores son de consulta institucional. Una estimación independiente exige alcance, evidencia, método aplicable y validación, no multiplicadores automáticos.</p><div className="phase-grid">{[['WBS','Trabajo y esfuerzos'],['IFPUG','Funcionalidad medible'],['COSMIC','Movimiento de datos'],['SNAP','Trabajo no funcional']].map(([p,t])=><div key={t}><strong>{p}</strong><span>{t}</span></div>)}</div></div></>}
      </div>
    </main>
  </div>
}