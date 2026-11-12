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

- `/api/data` expone **únicamente metadatos estructurados y redacción de contenido**. No devuelve descripciones de expedientes, documentos, títulos reales, vínculos de Drive ni hallazgos. Los IDs documentales son pseudónimos estables.
- `/api/v2-summary` publica datos agregados. La aplicación distingue evaluaciones propuestas de aprobaciones.
- `/api/update` responde 403 y no permite escritura anónima.
- **No se utiliza `DASHBOARD_ACCESS_KEY`.** La consulta completa de detalles exige autenticación personal verificable y autorización institucional, todavía no implementadas. No resolver este requisito mediante simples listas de palabras prohibidas en títulos.
- Hasta concluir las pruebas de seguridad y acceso, los cambios V09 deben permanecer en rama/PR de revisión y fuera de producción.

## Validación

- Construcción: `npm install --no-audit --no-fund && npm run build`.
- GitHub Actions: workflow `Verificación del tablero de brechas` ejecutado en el PR de V09.
- Verificar las métricas ante Neon en el mismo momento de la revisión, porque V00–V08 trabajan en paralelo.
- No fusionar sin controles de seguridad, pruebas funcionales y regresión del despliegue.
