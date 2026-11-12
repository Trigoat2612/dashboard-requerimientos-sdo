# V09 | Reporte de bloque 1 (12/11/2026, corte 14:26 Perú)

## Objetivo
Reconstruir el tablero, diagnosticar sus indicadores y realizar las correcciones iniciales compatibles con V00–V08.

## Infraestructura verificada
- Repositorio GitHub: Trigoat2612/dashboard-requerimientos-sdo (público).
- Rama principal al inicio y al cierre: `ff9d30e03961ca81ff5cdfd3b16d898ed2a5df2c` (no modificada).
- Rama V09: `feature/v09-dashboard-alineamiento`.
- Pull request de revisión en borrador: https://github.com/Trigoat2612/dashboard-requerimientos-sdo/pull/1
- Neon: proyecto `super-credit-91949836`, base `neondb`, esquema `ejenp_requerimientos_sdo`, rama predeterminada `production`.
- Vercel: el conector no encuentra el proyecto (404) ni permite consultar despliegues (403). Producción NO modificada y preview NO validada.

## Línea base dinámica de Neon
Datos al 12/11/2026 14:26 (America/Lima), que pueden cambiar durante el trabajo paralelo:
- Requisitos SDO: **511**.
- Dictámenes propuestos V06: **132** (1 cumplimiento demostrado, 98 parcial, 33 no verificable; 379 sin propuesta).
- Solicitudes: **68**. Clasificadas por V07: **68** (5 cubiertas, 4 pendientes contractuales, 2 brechas existentes, 2 duplicadas, 18 genuinamente nuevas, 37 indeterminadas).
- Estimaciones independientes V08: **0**.
- Tareas de estimación bloqueadas: **68** (no todas corresponden a incremento nuevo).
- Triaje histórico: **6.800 horas** (NO esfuerzo sustentado ni aprobado).
- Archivos: **484**; carpetas: **225**; evaluaciones documentales: **2.270**.
- Propuestas V06 y V07 sin referencias huérfanas según cotejo inicial: **0** cada una.

## Pantallas, fuentes y cambios
| Pantalla o endpoint | Fuente antes | Cambio en V09 |
| --- | --- | --- |
| Resumen | `proposed_requirements`, `sdo_requirements`, `source_documents` | Nuevo resumen V09 con cuatro frentes, sin horas históricas como KPI de esfuerzo aprobado |
| Requisitos SDO | `sdo_requirements`, `requirement_evidence` | Vincula `sdo_compliance_proposals` por código; resultado propuesto separado de estado oficial |
| Solicitudes | `proposed_requirements` | Vincula `request_classification_proposals` por ID; clasificación V07 visible y diferenciada del estado histórico |
| Bolsa de horas | `methodology_reviews`, horas históricas del backlog | Separa las horas históricas de `hours_estimate_proposals` y los bloqueos V08 |
| Auditoría documental | `source_documents`, `document_assessments` | Corrige denominadores para contar solo archivos visibles |
| Control operativo V00–V08 | `audit_v2_*`, colas | Reserva activa solamente si el lease está vigente |
| `/api/data` | Filas y hallazgos sin autenticación, redacción por títulos | Solo metadatos seleccionados; oculta textos, títulos reales, enlaces e identificadores documentales |
| `/api/update` | Bloqueo 403 | Se conserva sin cambios |

## Modelo de brechas
Se diseñó `sql/v09-gap-register-DRAFT.sql`: estructura aditiva para hallazgos, enlaces a requisitos, documentos y solicitudes, y bitácora.
- Estado: **solo diseño, no ejecutado**. `to_regclass('ejenp_requerimientos_sdo.v09_gap_register')` devolvió falso.
- No se deducen brechas automáticas de evaluaciones parciales.
- Requiere validación de clasificación y control institucional antes de activar consultas o escrituras.

## Verificaciones
1. GitHub Actions compiló la rama en la ejecución https://github.com/Trigoat2612/dashboard-requerimientos-sdo/actions/runs/43289965460 con resultado **success** sobre el commit `c0d48923599a4c9da4dfd50beb5e294d12098be2`.
2. Consultas independientes en Neon confirmaron métricas, vínculos de V06/V07 y 0 estimaciones de V08.
3. Validación estática de los endpoints: `/api/data` no selecciona el texto de solicitudes, títulos/URLs de Drive ni hallazgos; `/api/update` permanece en 403.
4. No se ejecutó migración, no se editaron datos, reservas ni conformidades; `main` no cambió.
5. **Sin verificación de runtime Vercel, tests funcionales de navegador o revisión responsive en preview** por falta de acceso al proyecto desde el conector. Compilar no equivale a validar un despliegue.

## Riesgos y pendientes
- El despliegue de producción sigue usando la versión anterior, cuyo `/api/data` expone campos detallados: se requiere control de acceso institucional prioritario.
- Sin autenticación individual, las fichas públicas presentan metadatos y no documentos, descripciones ni fundamentos completos. No se debe eliminar esta restricción sin control verificable.
- Revisar seguridad del endpoint en un preview autorizado y la cadena `DATABASE_URL` de Vercel para confirmar que apunta al proyecto indicado.
- Validar filtros, navegación, CSV, fichas y responsive con pruebas de navegador.
- Aprobar o rediseñar el registro de brechas antes de ejecutarlo.
- No existen estimaciones independientes V08 ni aprobaciones verificadas; la solución deja visibles los bloqueos.
- V06/V07 continúan escribiendo: los conteos son cortes temporales, no cifras congeladas.

**Conclusión:** primera corrección funcional incorporada en rama y compilada. No está validada integralmente ni desplegada. Detener V09 al concluir el bloque y no fusionar el PR hasta completar controles.
