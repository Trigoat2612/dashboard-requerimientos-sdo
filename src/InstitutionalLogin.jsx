import React, { useEffect, useRef, useState } from 'react';
import { LogIn, LogOut, ShieldCheck } from 'lucide-react';

// Google Identity Services; el Client ID es público y los permisos se comprueban en servidor.
// El ID token permanece solamente en memoria React. Sin localStorage ni contraseñas compartidas.
export default function InstitutionalLogin({identity, onCredential, onLogout}) {
  const [config,setConfig] = useState({loading:true,enabled:false,clientId:null,error:''});
  const [error,setError] = useState('');
  const buttonRef=useRef(null);
  const callbackRef=useRef(onCredential);
  callbackRef.current=onCredential;

  useEffect(()=>{
    let active=true;
    fetch('/api/auth-config',{cache:'no-store'})
      .then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'Servicio de identidad no disponible');return data;})
      .then(data=>{if(active)setConfig({...data,loading:false,error:''});})
      .catch(()=>{if(active)setConfig({loading:false,enabled:false,clientId:null,error:'Servicio de identidad no disponible'});});
    return ()=>{active=false;};
  },[]);

  useEffect(()=>{
    if (!config.enabled || !config.clientId || identity) return;
    let active=true;
    const render=()=>{
      if(!active || !buttonRef.current || !window.google?.accounts?.id) return;
      buttonRef.current.innerHTML='';
      window.google.accounts.id.initialize({
        client_id:config.clientId,
        auto_select:false,
        callback:async result=>{
          if(!result?.credential)return;
          setError('');
          try{await callbackRef.current(result.credential);}
          catch(e){setError(e?.message||'No se pudo validar el acceso institucional');}
        }
      });
      window.google.accounts.id.renderButton(buttonRef.current,{
        type:'standard',theme:'outline',size:'medium',text:'signin_with',shape:'rectangular'
      });
    };
    if(window.google?.accounts?.id){render();return ()=>{active=false;};}
    const existing=document.querySelector('script[data-v09-gis]');
    const script=existing||document.createElement('script');
    if(!existing){
      script.src='https://accounts.google.com/gsi/client';
      script.async=true;
      script.defer=true;
      script.dataset.v09Gis='true';
      document.head.appendChild(script);
    }
    script.addEventListener('load',render);
    script.addEventListener('error',()=>{if(active)setError('No se pudo cargar el servicio de Google');});
    return ()=>{active=false;script.removeEventListener('load',render);};
  },[config.clientId,config.enabled,identity]);

  if(!config.loading&&!config.enabled&&!identity)return null;
  if(identity) return <div className="institutional-login">
    <span className="institutional-user"><ShieldCheck size={15}/> Acceso institucional: {identity.email}</span>
    <button className="outline-btn" onClick={()=>{window.google?.accounts?.id?.disableAutoSelect?.();onLogout();}}><LogOut size={15}/> Cerrar sesión</button>
  </div>;
  return <div className="institutional-login">
    {config.loading?<span className="mini">Comprobando inicio de sesión…</span>:config.enabled?<div ref={buttonRef} className="google-login-button"/>:
      <span className="mini" title={config.error||'Configurar GOOGLE_OIDC_CLIENT_ID e INSTITUTIONAL_ALLOWED_EMAILS en Vercel Preview'}><LogIn size={14}/> Consulta institucional pendiente de configuración</span>}
    {error&&<span className="mini auth-error" role="alert">{error}</span>}
  </div>;
}
