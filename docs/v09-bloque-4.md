# V09 – Bloque 4 | Verificación de integración y compuerta de producción

**Fecha del análisis:** 12/11/2026, aproximadamente 15:52–15:56, hora de Perú (UTC−5).  
**GitHub:** `Trigoat2612/dashboard-requerimientos-sdo`, rama `feature/v09-dashboard-alineamiento`, PR [#1](https://github.com/Trigoat2612/dashboard-requerimientos-sdo/pull/1).  
**Neon:** `super-credit-91949836` / `neondb` / `ejenp_requerimientos_sdo`.  
**Producción objetivo:** https://dashboard-requerimientos-sdo.vercel.app/  
**Decisión:** NO FUSIONAR, NO PUBLICAR. Las condiciones expresas de publicación no se han satisfecho.

## 1. Cierre de Bloques 1–3 y estado del código

- El PR #1 se mantenía **abierto, en borrador y mergeable clean** frente a `main` en la verificación al inicio de este bloque. La rama inicial era `aca8f6ba6204602ab6067c97e55e183b2c9ffa67`; `main` estaba en `ff9d30e03961ca81ff5cdfd3b16d898ed2a5df2c`.
- GitHub Actions de los 27 tests existentes, compilación Vite y checks de autenticación daba **success** para el código previo.
- Google OIDC en `lib/institutional-auth.js` exige firma RS256 validada con JWKS, `iss`, `aud`, expiración, email verificado y allowlist nominativa de Vercel. El acceso institucional exige `institutional_reader`, y la API **valida antes de conectar** a Neon.
- `/api/data` y `/api/gaps` sirven exclusivamente metadatos anonimizados; `/api/institutional-data` exige autorización verificada para fichas y documentos con descripción, fundamento, evidencia, observación y condiciones originales. `/api/update` deniega escrituras. No se restableció `DASHBOARD_ACCESS_KEY`.
- **No se pudo inspeccionar** `GOOGLE_OIDC_CLIENT_ID`, `INSTITUTIONAL_ALLOWED_EMAILS` ni `DATABASE_URL` de Vercel porque el conector reporta 404 para el proyecto y 403 para despliegues. No hay evidencia de login real.
- El PR contiene `sql/v09-gap-register-DRAFT.sql` que **no se ejecutó**; no hay registro consolidado persistido. Solo V07 presenta referencias preliminares a posibles brechas. No confundir V06 parcial con incumplimiento formal.
- `hours_estimate_proposals` no tiene entradas; las 6.800 horas históricas en `proposed_requirements` no son aprobadas.

## 2. Conciliación independiente de Neon

Corte SQL: **2026-11-12 20:52:00 UTC**, ejecución SELECT independiente:

| Origen | Indicador | Conteo |
| --- | --- | ---: |
| `sdo_requirements` | Total SDO | 511 |
| `sdo_compliance_proposals` | V06 | 207 |
| V06 | Demostrado (propuesto) | 1 |
| V06 | Parcial (propuesto) | 140 |
| V06 | No verificable | 66 |
| Diferencia | Sin dictamen V06 | 304 |
| `proposed_requirements` | Solicitudes originales | 68 |
| `request_classification_proposals` | Clasificadas V07 | 68 |
| V07 | Cubierta / Pendiente contractual / Brecha existente | 5 / 5 / 2 |
| V07 | Duplicada / Genuinamente nueva / Indeterminada | 2 / 18 / 36 |
| `hours_estimate_proposals` | Estimaciones V08 | 0 |
| `proposed_requirements.hours_expected` | Triaje histórico no aprobado | 6.800 h |
| `document_assessments` | Registros de evaluación documental | 2.663 |
| `requirement_evidence` | Registros de vínculo de evidencia | 4.860 |
| `source_documents` | Archivos / carpetas | 484 / 225 |
| `v09_gap_register` | Registro persistente | No existe |

Validaciones independientes: **0 huérfanos** V06↔SDO, V07↔solicitud, evidencia↔documento y evaluación↔documento. Las cantidades pueden seguir cambiando con las actividades concurrentes V00–V08.

## 3. Prueba técnica y funcional realmente realizada

1. **GitHub Actions:** ejecutó el test unitario y de seguridad (`npm test`) y compiló Vite (`npm run build`) satisfactoriamente. Los tests existentes validan JWT firmado de prueba, rechazo de JWT falso/vencido/cuenta no autorizada y la lectura simulada autorizada de fundamentos originales V06/V07. **No demuestran cuenta institucional real.**
2. **Vercel GitHub status:** el commit `aca8f6ba` estaba con estado Vercel `success`. La extensión del PR siguió desplegándose automáticamente en Preview en cada push; el status `success` no prueba acceso HTTP o ejecución correcta.
3. **Vercel API directa:** `get_project` y variables de entorno → **404**; `list_deployments` → **403**. `get_git_deployment_context` devolvió una cuenta, sin proyectos enlazados visibles.
4. **HTTP desde navegador web:** no fue posible abrir la rama Preview ni sus API. 
5. **HTTP desde ejecución local:** DNS de Vercel no resuelve desde el contenedor de esta sesión.
6. **HTTP REAL desde runner de GitHub Actions:** se implementaron `scripts/preview-smoke.mjs` y el job `preview-smoke` en `.github/workflows/verify-tablero-brechas.yml`, que esperan confirmación del estado Vercel para el **SHA exacto** de la rama y hacen comprobaciones de `/`, `/api/auth-config`, `/api/institutional-data` anónima, `/api/update`, `/api/data`, `/api/gaps`, `/api/v2-summary`. La ejecución inicial: [run 43304885458](https://github.com/Trigoat2612/dashboard-requerimientos-sdo/actions/runs/43304885458), **build success, preview-smoke failure** porque `GET /` devolvió **HTTP 302** en lugar de 200 (redirigió antes de probar las API). La segunda ejecución confirmó el destino **`vercel.com`**, consistente con la protección de despliegues.
7. El script actualizado `scripts/preview-smoke.mjs` informa **solo el dominio de redirección**, nunca querystrings de acceso. La segunda ejecución fue [run 43305239314](https://github.com/Trigoat2612/dashboard-requerimientos-sdo/actions/runs/43305239314): **build success / Preview failure** con `HTTP 302 → vercel.com`. El job admite un secreto de automatización en GitHub Secrets, sin desactivar protección. No se proporcionó dicho secreto ni identidad Vercel CLI; no se intentó saltar SSO.

**No ejecutado / no acreditado:** navegación con navegador, filtros y búsquedas E2E, fichas completas en sesión Google real, exportación, responsive visual, comparación HTTP exacta contra Neon, lectura de logs runtime del Preview y verificación de URL productiva. No declarar ninguna de estas verificaciones como aprobada.

## 4. Incidencias, severidad y estado

| ID | Gravedad | Hallazgo | Tratamiento |
| --- | --- | --- | --- |
| V09B4-01 | **Bloqueante** | El Preview responde HTTP 302 hacia `vercel.com` a prueba no autenticada | Mantener protección; habilitar cuenta Vercel de prueba o método de bypass de automatización autorizado, en secreto; reejecutar test HTTP |
| V09B4-02 | **Bloqueante** | Sin acceso Vercel a variables, despliegues o logs | Revisar permisos del proyecto y cuenta Vercel conectada, sin crear proyecto |
| V09B4-03 | **Bloqueante** | No se ha verificado configuración de Google OIDC/allowlist ni inicio de sesión real | Configurar y probar usuario permitido y no permitido; validar 401/403 reales |
| V09B4-04 | Alta | Sin regresión de navegador, responsive o exportación | Ejecutar con Preview accesible (Playwright o navegador autorizado) |
| V09B4-05 | Media | Registro persistente de brechas no creado | Mantener DRAFT; no ejecutar DDL sin autorización específica |
| V09B4-06 | Alta | `DATABASE_URL` productiva no auditable y despliegue productivo actual sin inspección | Verificar entorno y backup antes de publicar, no asumir equivalencia |
| V09B4-07 | Media | Referencia SDO `RFU-GNO-08` de V07 no localizada (Bloque 3) | Pendiente de contraste con V00/V07, sin editar fuentes |

## 5. Compilación, integración y reversión

- Rama protegida de trabajo y PR #1 permanecen sin fusionar. **Ningún cambio en `main`** durante las verificaciones.
- **La última línea base conocida de `main`** es el SHA `ff9d30e03961ca81ff5cdfd3b16d898ed2a5df2c`, con status Vercel `success` y un inspector histórico. **No se pudo verificar que fuera la versión actualmente servida** por https://dashboard-requerimientos-sdo.vercel.app/; por tanto, el procedimiento de reversión aún no es **verificable**.
- Procedimiento propuesto si se autorizara la publicación en otra etapa: registrar el deployment productivo/alias y SHA vigente **antes** del merge; mantener acceso a reversión en Vercel al deployment anterior; ejecutar merge con SHA exacto de PR y hacer deploy; comprobar versión, HTTP, Neon, OAuth, módulos, exportaciones y logs; si falla, promover la versión anterior mediante la interfaz/conector autorizado y verificar HTTP del rollback. Si no se puede comprobar el deployment anterior, no fusionar.
- No crear proyectos ni esquemas alternativos; no modificar las colas/reservas, propuestas o conformidades V00–V08; no ejecutar migraciones.

## 6. Decisión de autorización condicional

Las condiciones 2 (Preview comprobado), 3 (autorización efectiva confirmada en entorno real), 5 (HTTP real conciliado), 6 (regresión UI), 7 (reversión verificable) están **incumplidas o no verificadas**. El fallo HTTP 302 es un bloqueo suficiente para **NO fusionar PR #1 y NO desplegar a producción**, incluso si la compilación es correcta.

Para reanudar la compuerta sin debilitar seguridad:

1. Conceder al conector Vercel acceso al proyecto existente y comprobar variables `GOOGLE_OIDC_CLIENT_ID`, `INSTITUTIONAL_ALLOWED_EMAILS` y `DATABASE_URL` en Preview y Production, sin exponer valores.
2. Proporcionar un mecanismo de autenticación de las pruebas automáticas al Preview: preferentemente `vercel curl` con cuenta autorizada; alternativamente configurar `VERCEL_PREVIEW_BYPASS_TOKEN` en **GitHub Actions Secrets** para el proyecto. Un bypass de Vercel **no** sustituye autenticación OIDC de la aplicación.
3. Ejecutar el job HTTP hasta success; probar después una cuenta Google de la allowlist y una cuenta no permitida, API directas y navegador/responsive; auditar deployment de producción estable y reversión.

**Bloque 4 se detiene con evidencia de bloqueo real**. No se inicia el Bloque 5 ni se cambia producción.
