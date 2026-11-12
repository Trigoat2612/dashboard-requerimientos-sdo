# Dashboard de Requerimientos SDO | EJE No Penal

Dashboard Vite + React, funciones serverless y Neon PostgreSQL, en el repositorio existente
`Trigoat2612/dashboard-requerimientos-sdo`.

**Producción:** https://dashboard-requerimientos-sdo.vercel.app/  
**Neon:** `super-credit-91949836` / `neondb` / `ejenp_requerimientos_sdo`.  
**Fuente:** datos históricos y propuestas de V00–V08, consultados dinámicamente sin modificar conformidades oficiales.

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
