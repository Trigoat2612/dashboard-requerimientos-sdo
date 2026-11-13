# Dashboard de Requerimientos SDO | EJE No Penal

Dashboard Vite + React, funciones serverless y Neon PostgreSQL, en el repositorio existente
`Trigoat2612/dashboard-requerimientos-sdo`.

**Producción:** https://dashboard-requerimientos-sdo.vercel.app/  
**Neon:** `super-credit-91949836` / `neondb` / `ejenp_requerimientos_sdo`.  
**Fuente de resultados visible:** las cuatro vistas institucionales consolidadas del informe, con evidencias históricas en modo consulta, sin alterar registros.

## Informe institucional consolidado

El módulo principal del dashboard utiliza **exclusivamente** estas cuatro vistas de Neon como fuente
de las clasificaciones y estimaciones mostradas a la Dirección Ejecutiva:

- `ejenp_estimacion_v08.v00_informe_gerencial_v13`
- `ejenp_estimacion_v08.v00_informe_categorias_v13`
- `ejenp_estimacion_v08.v00_informe_matriz_318_v13`
- `ejenp_estimacion_v08.v00_informe_wbs_122_v13`

**Resultados conciliados:** 318 solicitudes; 122 funcionalidades incrementales propuestas sujetas a evaluación del usuario final; **13.547,86 horas-persona WBS/PERT**; 196 solicitudes de las demás categorías; 175 estimaciones técnicas conservadas y 635 actividades WBS correspondientes a las propuestas.

| Clasificación | Solicitudes |
| --- | ---: |
| Nuevas funcionalidades incrementales sujetas a evaluación del usuario final | 122 |
| Funcionalidades comprendidas en SDO | 94 |
| Funcionalidades comprendidas en brechas | 2 |
| Solicitudes duplicadas | 8 |
| Solicitudes sobre sistemas externos y sujetas a reformulación | 86 |
| Configuraciones y ajustes | 6 |

Las 86 solicitudes incluyen 52 modificaciones directas a sistemas externos y 34 potenciales reformulaciones para EJE. Ninguna de ellas aporta horas al total incremental.

### Módulo del informe y APIs

- **Resumen gerencial:** indicadores, clasificación de seis categorías, especialidades, fases WBS, conclusión y tratamiento técnico
- **Análisis de requerimientos:** 318 solicitudes, filtros, justificación individual, referencia SDO/brechas y ficha completa
- **Funcionalidades incrementales:** 122 propuestas con actividades WBS desplegables y sumas PERT por código
- **Criterios y metodología:** categorías, ejemplos reales, WBS/PERT y comparación con métodos del proveedor documentados en Neon
- **Consulta documental:** acceso a inventario, evidencias y referencias SDO existentes, sin restaurar `DASHBOARD_ACCESS_KEY`
- **Excel:** libro XLSX con 7 hojas, incluidas matriz 318, propuestas 122, actividades WBS 635, metodología, referencias, supuestos y riesgos
- **PowerPoint:** presentación gerencial editable de 12 diapositivas, generada con datos del informe vigente

Endpoint institucional público de solo lectura:

- `GET /api/report-v13?view=snapshot`
- `GET /api/report-v13?view=detail&code=REQ00157`
- `GET /api/report-v13?view=wbs`
- `GET /api/report-v13?view=export`

Cada consulta comprueba la conciliación de códigos, categorías, escenarios y horas. No reestima ni altera los registros de Neon. La UI no presenta las versiones internas como categorías o titulares.

**Publicación:** los cambios se despliegan directamente desde `main` a Vercel.
El control productivo `scripts/report-v13-production-smoke.mjs` comprueba la navegación cliente,
la API, el inventario documental y los universos de 318/122/635.

**Limitación del PPTX:** el repositorio no dispone de la plantilla institucional original;
se utiliza un diseño editable, listo para adaptar cuando exista el archivo fuente.

Para implementación y pruebas ver `docs/v09-publicacion-informe-v13.md`.

## Consulta documental íntegra

A solicitud del responsable del proyecto, **todos los documentos inventariados se presentan por sus títulos originales y enlaces registrados**, sin sustituirlos por nombres genéricos ni ocultarlos por coincidencias en el título. Se muestran:

- Los 484 archivos actuales de `source_documents` (el número crece según el inventario).
- Sus enlaces `url` almacenados en Neon.
- Las evidencias `requirement_evidence` y sus justificaciones documentales.
- Las evaluaciones `document_assessments`, hallazgos, fuentes y condiciones de validación.
- Los textos SDO y solicitudes que ya forman parte de `GET /api/data`.

La aplicación **no aplica listas de palabras sensibles, filtros por nombres de archivos ni reemplazos de títulos y URLs documentales**. En el último cotejo, los 484 archivos tenían enlaces HTTPS registrados.

La apertura efectiva de archivos hospedados en Google Drive u otros servicios sigue sujeta a los permisos del **proveedor del archivo**. Publicar el enlace en el dashboard no modifica los permisos en Drive.

## Fuentes auxiliares e históricas (no sustituyen los indicadores del informe)

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
