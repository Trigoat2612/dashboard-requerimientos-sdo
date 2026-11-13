# Dashboard de Requerimientos SDO | EJE No Penal

Dashboard Vite + React, funciones serverless y Neon PostgreSQL, en el repositorio existente
`Trigoat2612/dashboard-requerimientos-sdo`.

**Producción:** https://dashboard-requerimientos-sdo.vercel.app/  
**Neon:** `super-credit-91949836` / `neondb` / `ejenp_requerimientos_sdo`.  
**Fuente vigente de novedad técnica:** cierre V00 V9, con detalle histórico V07/V08 y fuentes de cuatro esquemas Neon, de solo lectura.

## Corte ejecutivo vigente: V00 V9 (13/11/2026)

El dashboard consulta en cada carga `ejenp_estimacion_v08.v00_final_novedad_318_v9`,
concilia 318 códigos únicos con `v00_novedad_gerencial_v9` y muestra **solo las funcionalidades genuinamente nuevas del EJE** como horas incrementales.

**Último corte comprobado:** `V00-20261113-NOVEDAD-TECNICA-V9`.
De 318 solicitudes, 6 están acreditadas como `NUEVO_EJE`, con
**2.490,833 horas-persona PERT** y 44 actividades WBS admitidas.
Las 312 restantes no integran el total de nuevos desarrollos. El histórico V07/V08 sigue accesible como antecedente, **pero no se agrega automáticamente** a la bolsa.

La solución incluye siete secciones integrales: resumen gerencial, matriz 318, obligaciones originales Softplan,
331 brechas Laboral, seguimiento V08, exclusiones R48 y 49 relaciones de solapamiento.
**R48 está registrado** en `v00_r48_final_scope_v4` y
`v00_r48_resolutions_v5`. El antiguo diagnóstico de falta de R48 corresponde a una versión anterior del tablero.

Un cambio directo a SIJ, REMAJU, SERNOT u otro satélite no se estima como desarrollo EJE. Una reformulación para intervenir exclusivamente EJE debe analizarse como nuevo alcance y contrastarse con SDO y brechas.

Los indicadores ejecutivos son técnicos: **no constituyen aprobación de contrato ni de pago**.
Las pestañas y API anteriores se conservan.

**Rutas de consulta:**
- `GET /api/integrated-audit?view=snapshot`: 318 solicitudes, dictamen técnico V00 V9, resumen gerencial, brechas Laboral, R48 y solapamientos
- `GET /api/integrated-audit?view=detail&code=REQ00157`: ficha original y WBS admitida del nuevo EJE
- `GET /api/integrated-audit?view=detail&code=REQ00613`: ejemplo de cambio externo, con 0 horas EJE y estimación histórica no imputada
- `GET /api/integrated-audit?view=export`: 318 fundamentos íntegros para Excel

Se generan **XLSX de 56 columnas** y **PPTX gerencial de 12 diapositivas** desde el navegador.
La presentación tiene diseño institucional editable, pero requiere la plantilla oficial cuando esté disponible.

El flujo `scripts/audit-production-smoke.mjs` verifica por HTTP la URL de producción,
el cierre V00 V9, la conciliación de horas, la WBS admitida y las exclusiones externas.
La versión productiva se despliega desde `main` y conserva las verificaciones `npm test` / `npm run build`.

Para el reporte de implementación, consultar
[`docs/v09-cierre-v00-v9.md`](docs/v09-cierre-v00-v9.md).

## Consulta documental íntegra

A solicitud del responsable del proyecto, **todos los documentos inventariados se presentan por sus títulos originales y enlaces registrados**, sin sustituirlos por nombres genéricos ni ocultarlos por coincidencias en el título. Se muestran:

- Los 484 archivos actuales de `source_documents` (el número crece según el inventario).
- Sus enlaces `url` almacenados en Neon.
- Las evidencias `requirement_evidence` y sus justificaciones documentales.
- Las evaluaciones `document_assessments`, hallazgos, fuentes y condiciones de validación.
- Los textos SDO y solicitudes que ya forman parte de `GET /api/data`.

La aplicación **no aplica listas de palabras sensibles, filtros por nombres de archivos ni reemplazos de títulos y URLs documentales**. En el último cotejo, los 484 archivos tenían enlaces HTTPS registrados.

La apertura efectiva de archivos hospedados en Google Drive u otros servicios sigue sujeta a los permisos del **proveedor del archivo**. Publicar el enlace en el dashboard no modifica los permisos en Drive.

## Clasificaciones, propuestas y conformidades

- **511 SDO:** `sdo_requirements`; propuestas de V06 en `sdo_compliance_proposals`, sin confundirse con estado oficial.
- **68 solicitudes:** `proposed_requirements`; clasificación propuesta por V07 en `request_classification_proposals`.
- **Bolsa de horas:** `hours_estimate_proposals` contiene estimaciones independientes cuando existan. Las **6.800 horas históricas** de triaje no representan esfuerzo validado ni aprobado.
- **Brechas:** `sql/v09-gap-register-DRAFT.sql` es un diseño sin ejecutar. Los candidatos de V07 no son brechas confirmadas.
- **Auditoría:** indicadores, documentos, trazabilidad SDO y evaluaciones se actualizan desde Neon. V00–V08 conservan la titularidad de sus análisis.

## APIs y autorización

| API | Disponibilidad |
| --- | --- |
| `GET /api/data` | Consulta pública de documentos, enlaces, evidencias y análisis documental completos; incluye SDO/solicitudes y clasificaciones resumidas V06/V07 |
| `GET /api/v2-summary` | Indicadores agregados en tiempo de consulta |
| `GET /api/gaps` | Candidatos y referencias V07; no inventa brechas consolidadas |
| `GET /api/institutional-data` | Detalles adicionales de fundamentos y propuestas V06/V07 mediante Google OIDC individual, cuando esté configurado |
| `POST /api/update` | 403: no se permite modificar registros oficiales desde la consulta pública |

La consulta documental de `/api/data` **no depende** de `GOOGLE_OIDC_CLIENT_ID`, `INSTITUTIONAL_ALLOWED_EMAILS` ni `DASHBOARD_ACCESS_KEY`. El acceso institucional opcional del endpoint de dictámenes usa sus propios controles de autorización en servidor; no se configura ninguna clave compartida.

## Pruebas y publicación

- `npm install --no-audit --no-fund`
- `npm test`
- `npm run build`
- GitHub Actions publica comprobaciones de build y una prueba HTTP del Preview, que puede estar limitada por la protección de acceso de Vercel.
- El despliegue productivo se conecta a `main`; verificar el SHA implementado en Vercel tras cada publicación.

## Historial de la auditoría V09

Los reportes históricos se conservan en `docs/v09-bloque-{1,2,3,4,5}.md` para trazabilidad de decisiones y restricciones **vigentes en aquellos cortes**, no como especificación actual de visibilidad documental.

No se han creado proyectos, esquemas ni tablas adicionales para esta corrección.
