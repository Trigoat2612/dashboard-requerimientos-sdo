# V09 – Informe de cierre del Bloque 5 (cierre técnico condicionado)

**Programa:** EJE No Penal – Auditoría Integral de Requisitos SDO.  
**Fecha del corte:** 12/11/2026, 16:05:24 (Lima).  
**Repositorio:** `Trigoat2612/dashboard-requerimientos-sdo`; rama `feature/v09-dashboard-alineamiento`; PR #1.  
**Neon:** `super-credit-91949836`, `neondb`, esquema `ejenp_requerimientos_sdo`.  
**Producción:** https://dashboard-requerimientos-sdo.vercel.app/  
**Clasificación final:** **PENDIENTE DE ESTABILIZACIÓN**. El Bloque 4 no concluyó integración; por ello no hay versión V09 validada y publicada sobre la cual certificar estabilización productiva.

## 1. Versión y estado de publicación

En la verificación inicial:
- `main`: `ff9d30e03961ca81ff5cdfd3b16d898ed2a5df2c`.
- PR #1: abierto, draft; rama `8ddefc759f31831308c857b3a0081edd1f4973de`. Sin conflictos de merge en ese corte, pero con estado de checks inestable por fallos HTTP de Preview.
- La rama avanzó con correcciones exclusivamente V09, sin merge hacia `main`.
- Vercel informa deployment `success` por GitHub para los commits de Preview, **pero la prueba HTTP real del runner obtiene HTTP 302 hacia `vercel.com`**. No equivale a navegación y API verificadas.
- Conector Vercel: `get_project` devuelve **404**; `list_deployments` **403**; `list_projects` para el proyecto **0 resultados**. No es posible inspeccionar entorno ni obtener el deployment productivo real, por lo que **no se puede certificar reversión**.

**Decisión:** no desplegar, no fusionar el PR #1 y no modificar producción. El Bloque 5 trabaja únicamente sobre las actividades independientes posibles de la rama y bloqueos de los Bloques 3–4.

## 2. Correcciones de este bloque

| ID | Módulo | Prioridad | Causa | Corrección | Prueba / estado |
| --- | --- | --- | --- | --- | --- |
| V09B5-01 | Sesiones | Alta | Token vencido sin aviso proactivo | Temporizador de vencimiento basado en `expiresAt`, limpieza del estado institucional y aviso de reautenticación; `src/App.jsx` | Compilación y tests, **sin cuenta Google real** |
| V09B5-02 | CSV | Alta | Exportaciones SDO/V07 no incluían fundamentos para lector autorizado | `src/App.jsx`: CSV público reducido y CSV autorizado con texto contractual, fundamentos, evidencia y pendientes; sanitización de fórmulas existente preservada | Test estático y compilación, navegador pendiente |
| V09B5-03 | Rendimiento documental | Media | `view=assessments` transfería todos los hallazgos en una respuesta | `api/institutional-data.js`: páginas parametrizadas de 200, tope de página; `src/App.jsx`: lotes concurrentes de hasta 4 páginas, indicador de progreso y cancelación con `AbortController` | Test de límite/offset/401 y compilación, HTTP real pendiente |
| V09B5-04 | Condiciones V07 | Media | Cola carecía de identificación visible de la ventana asignada | Consulta individual incluye `assigned_window`; ficha presenta responsable/ventana, estado y fecha | Compilación, consulta real en Preview pendiente |
| V09B5-05 | Fichas | Media | La ficha institucional no tenía botón de cierre ni aviso específico de revocación | `InstitutionalDetailPanel.jsx` y `App.jsx` incorporan cierre y mensaje de sesión no autorizada | Compilación, E2E pendiente |
| V09B5-06 | Integridad documental | Media | `modified_at` se presentaba erróneamente como una versión documental | Se rotula «última modificación», sin inventar número formal de versión | Código actualizado; verificación visual pendiente |
| V09B5-07 | Preview | **Bloqueante** | Protección de acceso devuelve HTTP 302 a `vercel.com` | Se preserva protección; no se publica un bypass | Pendiente de credenciales de acceso autorizado para pruebas |

No se alteraron consultas de V06/V07 ni sus resultados, ni se generaron horas V08, ni se escribieron datos originales en Neon.

## 3. Conciliación independiente con Neon

`SELECT` ejecutado el 12/11/2026 **21:05:24 UTC** sobre las fuentes originales, sin DML ni DDL.

| Métrica | Resultado |
| --- | ---: |
| Total requisitos SDO | 511 |
| Dictámenes V06 | 217 |
| V06 demostrado / parcial / no verificable | 1 / 145 / 71 |
| SDO pendientes de dictamen V06 | 294 |
| Solicitudes originales / clasificadas V07 | 68 / 68 |
| V07 cubierta / pendiente contractual / brecha existente | 5 / 5 / 2 |
| V07 genuinamente nueva / indeterminada / duplicada | 18 / 36 / 2 |
| V08: estimaciones independientes | 0 |
| Horas históricas de triaje **no aprobadas** | 6.800 |
| Registros documentales de análisis | 2.723 |
| Evidencias vinculadas | 4.926 |
| Archivos / carpetas | 484 / 225 |
| Brechas consolidadas `v09_gap_register` | No existe |

Verificaciones de integridad: cero huérfanos V06↔SDO, V07↔solicitud, evidencia↔documento y evaluaciones↔documento. `request_analysis_queue` al corte: clasificación, **36 bloqueadas / 30 contrastadas / 2 duplicadas verificadas**; estimación, **68 bloqueadas**. No interpretar 2 referencias V07 a brechas existentes como brechas formalmente validadas. Los datos siguen evolucionando por V00–V08 y las métricas **no están codificadas como constantes** del dashboard.

### Casos de aceptación especialmente solicitados

Con SELECT directos, **sin divulgar textos**:
- `RFA-ARQ-01` existe en `sdo_requirements`, dispone de descripción contractual y de fundamento V06 con estado de propuesta separado.
- `REQ00157` existe en `proposed_requirements`, dispone de texto original y fundamento de clasificación V07 con estado propuesto separado.

**No** se verificó que un usuario real autenticado vea esas fichas en un navegador Vercel. Las pruebas unitarias con credenciales firmadas de prueba **no cuentan** como validación institucional real.

## 4. Pruebas

| Prueba | Resultado | Alcance |
| --- | --- | --- |
| `npm test` | **29/29 satisfactorias** | RSA/JWKS simulado, claims OIDC, denegación anónima, clasificación y modelos, CSV, paginación de evaluaciones |
| `npm run build` | **Exitosa** | Compilación Vite/React |
| Consultas SQL Neon | **Correctas** | Conteos, integridad, casos RFA/REQ |
| GitHub/Vercel deployment status | **Success** | Solo build/deploy automático del commit |
| Smoke HTTP real Preview | **Falla** | GET / devuelve 302 a `vercel.com`; resto de endpoints no ejecutados |
| Login Google real | **No ejecutado** | Google OIDC no verificable en entorno |
| E2E fichas/filtros/enlaces/CSV/responsive | **No ejecutado** | Sin sesión de navegador autorizada |
| Seguridad HTTP con cuenta real y sin cuenta | **No ejecutado** | Solo tests unitarios con JWT de prueba |
| Producción, APIs y rollback efectivos | **No ejecutado** | Conector Vercel sin acceso |

Workflow de la rama: https://github.com/Trigoat2612/dashboard-requerimientos-sdo/actions  
Comprobación HTTP bloqueada del Bloque 4: https://github.com/Trigoat2612/dashboard-requerimientos-sdo/actions/runs/43305239314

## 5. Módulos y cobertura

| Módulo | Estado | Observación |
| --- | --- | --- |
| Resumen ejecutivo | Validado con restricciones en código | Dinámico desde Neon; navegador real y publicación por confirmar |
| SDO / V06 | Validado con restricciones en código | 511 SDO, V06 separado; fichas originales solo con OAuth configurado |
| 68 V07 | Validado con restricciones en código | Clasificaciones actuales y motivos; consulta real autenticada pendiente |
| Brechas | Bloqueado | Sin tabla institucional consolidada; solo candidatos y referencias propuestas |
| V08 | Validado con restricciones en código | 0 estimaciones; 6.800 h históricas separadas |
| Auditoría documental | Validado con restricciones en código | Lotes de 200; tablas y fichas requieren pruebas reales de interacción |
| Autenticación individual | **Bloqueado** | Implementación OIDC existe; no hay prueba real con cuenta autorizada |
| Producción | **Pendiente de estabilización** | Bloques 4–5 no publicaron V09 |

Los usuarios autorizados deberían consultar las fichas en `/api/institutional-data?view=detail&kind=sdo&id=RFA-ARQ-01` y `...&kind=request&id=REQ00157` usando **Authorization Bearer firmado y autorizado**. En ausencia de sesión, API devuelve 401 sin consultar Neon. Esta es una garantía de diseño y prueba unitaria, no un smoke HTTP aprobado.

## 6. Configuración externa requerida

Se requiere acceso de propietario al proyecto Vercel existente:

1. En Vercel **Settings → Environment Variables** (en el proyecto actual, Preview), configurar `GOOGLE_OIDC_CLIENT_ID` e `INSTITUTIONAL_ALLOWED_EMAILS` con **correos individuales aprobados**; confirmar por existencia/configuración la `DATABASE_URL` de la base `neondb` y esquema autorizado. No enviar secretos por chat ni introducirlos en GitHub.
2. En Google Cloud Console → **APIs & Services → Credentials** de la aplicación OAuth, agregar el **origen HTTPS exacto** del Preview usado para las pruebas. Comprobar audiencia del token y que la cuenta pertenece a la allowlist.
3. Resolver acceso de verificación al Preview protegido: utilizar `vercel curl` con una identidad Vercel autenticada y permisos de proyecto o configurar el mecanismo de automatización de Preview **solo como GitHub Actions secret**, sin desactivar Vercel Deployment Protection. El bypass de protección Vercel no es permiso sobre la API institucional.
4. Ejecutar smoke HTTP con identidad Vercel, navegador/Playwright con cuenta Google autorizada y otra no permitida; probar token expirado, falsificado, direct API anónima, SDO `RFA-ARQ-01`, solicitud `REQ00157`, filtros, CSV, tablet/móvil y conciliación con Neon.
5. Auditar entorno productivo, SHA/despliegue anterior, permisos y mecanismo de rollback antes de la **autorización condicional** de integración del Bloque 4.

## 7. Plan verificable de reversión (todavía sin ejecutar)

**Condición previa:** identificar y registrar deployment ID y SHA del entorno productivo que realmente sirve `dashboard-requerimientos-sdo.vercel.app`; respaldar configuración y documentar acceso a la opción Vercel Rollback/promoción. La rama `main` previa es `ff9d30e03961ca81ff5cdfd3b16d898ed2a5df2c`, pero **no se debe asumir** que equivale al deployment productivo actual. Tras un futuro merge autorizado, guardar el deployment nuevo y comprobar los endpoints. Si hay incidencia crítica, restaurar el deployment anterior con la función autorizada de Vercel y comprobar URL, APIs, auth, Neon y logs. **Sin acceso al deployment real, el rollback no está validado y la publicación queda prohibida.**

## 8. Mantenimiento y coordinación

- No tocar conformidades oficiales, reservas, documentos de V00–V08 o sus propuestas.
- Mantener contraste independiente entre evaluaciones V06, propuestas V07, elegibilidad V08 y estados institucionales.
- Monitorear tamaño/paginación de evaluaciones, token expirado y disponibilidad del JWKS Google.
- Evitar enlaces directos a Drive y exportación de contenido original fuera de sesiones autorizadas.
- Comunicar a V00/V07 la asociación de solicitud `REQ00571` con código SDO `RFU-GNO-08`, reportada como referencia no localizada, sin alterar fuentes.
- Conservar el script `scripts/preview-smoke.mjs` como compuerta que falla cuando no hay acceso al Preview.

## 9. Cumplimiento del objetivo original y conclusión

El **código** permite distinguir metadatos públicos y análisis individuales institucionales, sustenta consultas a Neon, evita contraseñas compartidas y se actualiza dinámicamente. Las restricciones de acceso, visualización real y reversión productiva **impiden acreditar cumplimiento final**. No se ha publicado V09 a producción.

**Clasificación final: PENDIENTE DE ESTABILIZACIÓN.** 
**Fin de las tareas independientes de este bloque:** no merge, no despliegue productivo, no migraciones persistentes. Reanudar solamente cuando estén satisfechas las condiciones verificables establecidas en el Bloque 4.
