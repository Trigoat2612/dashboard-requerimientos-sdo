# Dashboard de Requerimientos SDO | EJE No Penal

Aplicación existente en Vite + React, API Serverless y Neon PostgreSQL.
**V09 evoluciona esta solución, sin reconstruirla ni modificar los registros de los agentes V00–V08.**

## Infraestructura de referencia

- GitHub: https://github.com/Trigoat2612/dashboard-requerimientos-sdo
- Neon: proyecto `super-credit-91949836`, base `neondb`, esquema `ejenp_requerimientos_sdo`.
- Vercel (producción existente): https://dashboard-requerimientos-sdo.vercel.app/
- Rama de desarrollo: `feature/v09-dashboard-alineamiento`.
- **Nota:** el proyecto Vercel no ha podido verificarse con los permisos del conector disponibles. La rama V09 no implica despliegue a producción.

## Interpretación de indicadores V09

1. **511 requisitos SDO:** el dictamen de `sdo_compliance_proposals` es una propuesta V06, no conformidad oficial.
2. **68 solicitudes:** la clasificación propuesta procede de `request_classification_proposals` (V07), no del estado histórico del backlog.
3. **Bolsa de horas:** solo los registros de `hours_estimate_proposals` corresponden a métodos independientes de V08. No se suman métodos alternativos ni se infiere aprobación.
4. **6.800 h históricas:** suma de triaje en `proposed_requirements`; no está validada como esfuerzo incremental ni horas aprobadas.
5. **Brechas:** el diseño aditivo propuesto está en `sql/v09-gap-register-DRAFT.sql`. **No ha sido ejecutado.** No derivar automáticamente brechas de estados de cumplimiento parcial.
6. **Auditoría documental y operativa:** se consumen los datos agregados de `audit_v2_*` y las colas sin modificar reservas.

Los números se leen desde Neon y evolucionan a medida que V00–V08 registran nuevos resultados.

## Seguridad

- `/api/data` entrega **solo metadatos de lectura anonimizados**: códigos SDO, clasificaciones propuestas, referencias documentales seudonimizadas y recuentos de métodos V08. No publica textos contractuales, hallazgos, títulos originales, URLs ni horas de métodos.
- `/api/gaps` entrega únicamente referencias preliminares V07 de solicitudes clasificadas como posible brecha, separadas explícitamente de las **0 filas consolidadas disponibles** (la tabla aún no existe). No contiene fundamentos ni evidencia privada.
- `/api/v2-summary` publica exclusivamente indicadores agregados y datos de coordinación no nominativos. Las propuestas V06/V07 no equivalen a aprobación institucional.
- `/api/update` responde 403 y no permite escritura anónima.
- **No se utiliza `DASHBOARD_ACCESS_KEY`.** La consulta completa de detalles exige autenticación personal verificable y autorización institucional, todavía no implementadas. No resolver este requisito mediante simples listas de palabras prohibidas en títulos.
- Hasta concluir las pruebas de seguridad y acceso, los cambios V09 deben permanecer en rama/PR de revisión y fuera de producción.

## Validación

- Construcción: `npm install --no-audit --no-fund && npm run build`.
- GitHub Actions: workflow `Verificación del tablero de brechas` ejecutado en el PR de V09.
- Verificar las métricas ante Neon en el mismo momento de la revisión, porque V00–V08 trabajan en paralelo.
- No fusionar sin controles de seguridad, pruebas funcionales y regresión del despliegue.

## Bloque V09-2 · pruebas y migración pendiente

- `src/GapExplorer.jsx`, `src/gap-model.js`: filtros por SDO, componente, tipo, severidad, responsable y estado, paginación, exportación y relaciones documentales (solo cuando exista sesión autorizada).
- `src/csv-utils.js`: escapado estándar y mitigación de inyección de fórmulas en CSV.
- `npm test`: Node Test Runner, filtros, paginación, seguridad de APIs y CSV; GitHub Actions exige pruebas antes de `npm run build`.
- `sql/v09-gap-register-DRAFT.sql` **no ejecutado**. Requiere autorización previa para la creación de objetos persistentes. Se preservan las colas de trabajo y conformidades.
- Vercel Preview: GitHub reporta despliegues automáticos de la rama en el PR #1; el conector Vercel devuelve 403/404 para inspección y no permite las pruebas runtime E2E desde esta sesión. No confundir build/deploy Ready con validación funcional completa.
- El acceso completo requiere SSO/OIDC y autorización institucional comprobada en servidor, todavía no configurados. No se admiten claves compartidas ni heurísticas por nombre de archivo.

## Bloque V09-3 · alcance de la consulta pública

- El dashboard deja de bloquear todas las matrices: se navega por los 511 códigos SDO, clasificaciones V06/V07, 68 solicitudes y sus referencias anonimizadas, inventario documental y fichas de metadatos.
- Los fundamentos completos, textos contractuales, versiones y URLs originales de documentos, incidencias y estimaciones V08 por valor permanecen restringidos hasta habilitar autenticación individual verificable.
- `src/App.jsx` y `src/GapExplorer.jsx` permiten búsqueda, filtros, CSV y fichas no sensibles; no generan conformidades ni modifican datos.
- `api/v2-summary.js` omite el agregado de esfuerzo de estimaciones V08 en modo público, calcula reservas vigentes por `lease_expires_at` y mantiene triaje histórico separado.
- La migración DDL sigue pendiente de autorización. No hay escritura ni nuevas tablas.
- Detalle de pruebas, incidencias, conciliación y bloqueos: `docs/v09-bloque-3.md`.
