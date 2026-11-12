# V09 · BLOQUE 3 | Validación y preparación de producción

**Fecha de corte de datos:** 12/11/2026, 15:23 (América/Lima)  
**Repositorio:** `Trigoat2612/dashboard-requerimientos-sdo`  
**Rama única:** `feature/v09-dashboard-alineamiento`  
**PR:** https://github.com/Trigoat2612/dashboard-requerimientos-sdo/pull/1 (borrador, sin merge)  
**Neon:** `super-credit-91949836` / `neondb` / `ejenp_requerimientos_sdo` (solo SELECT)  
**Vercel:** producción existente https://dashboard-requerimientos-sdo.vercel.app/ (**sin modificaciones**)

## 1. Resultado técnico y clasificación de módulos

| Módulo | Clasificación | Alcance efectivamente validado | Pendientes |
| --- | --- | --- | --- |
| Resumen ejecutivo V09 | Validado con restricciones | Modelo de consulta y separación entre V06, V07, V08, triaje histórico y auditoría; conciliación SQL | Navegador real, comprobación en Preview y autorización sobre agregados |
| Cumplimiento SDO | Validado con restricciones | Los 511 códigos son seleccionables; V06 propuesto y estado oficial distinguidos; fichas anonimizadas | Texto contractual, bases y condiciones de V06 requieren identidad verificada |
| Brechas | Bloqueado | Modelo SQL DRAFT, filtros, estados, paginación y referencias preliminares V07 | Tabla no autorizada/no migrada; ninguna brecha validada para divulgar |
| Nuevos requisitos | Validado con restricciones | 68 códigos, clasificación V07 actual, enlaces SDO, fichas de metadatos, CSV | Justificación contractual y condiciones de desbloqueo reservadas |
| Bolsa de horas | Validado con restricciones | Recuento dinámico de métodos V08, sin publicar importes; histórico separado | No hay aún estimaciones V08, comparativa Softplan ni autorización de horas |
| Auditoría documental V00–V08 | Validado con restricciones | Metadatos anonimizados, índices SDO↔documento, niveles, fichas, tablas y enlaces internos | Documento/versiones/observaciones originales y URLs requieren SSO; navegador E2E pendiente |
| Seguridad de consultas | Validado con restricciones | Escritura anónima 403; lista blanca de columnas, 14 tests, sanitización CSV | Autenticación institucional individual y evaluación de publicación de metadatos |

La categoría “Validado con restricciones” **no equivale a listo para producción**. Las pruebas automatizadas y consultas independientes no sustituyen inspección y pruebas de navegador.

## 2. Conciliación Neon

Consulta realizada el **12/11/2026 20:23:22 UTC** con SQL directo de solo lectura:

| Origen | Indicador | Corte |
| --- | --- | ---: |
| `sdo_requirements` | Requisitos SDO | 511 |
| `sdo_compliance_proposals` | Dictámenes V06 | 175 |
| V06 | Cumplimiento demostrado propuesto | 1 |
| V06 | Cumplimiento parcial propuesto | 123 |
| V06 | No verificable | 51 |
| Diferencia 511-175 | Sin dictamen V06 | 336 |
| `proposed_requirements` / V07 | Solicitudes / clasificaciones | 68 / 68 |
| V07 | Cubierta / pendiente contractual / brecha existente | 5 / 5 / 2 |
| V07 | Duplicada / genuinamente nueva / indeterminada | 2 / 18 / 36 |
| `hours_estimate_proposals` | Métodos independientes V08 | 0 |
| `proposed_requirements.hours_expected` | Horas históricas de triaje, no aprobadas | 6.800 |
| `source_documents` | Archivos / carpetas | 484 / 225 |
| `document_assessments` | Evaluaciones documentales | 2.544 |
| `requirement_evidence` | Vínculos de evidencia | 4.786 |
| `document_assessments` | Documentos distintos evaluados | 482 |
| `requirement_evidence` | Códigos SDO distintos enlazados | 476 |
| `to_regclass('ejenp_requerimientos_sdo.v09_gap_register')` | Registro consolidado | No existe |

Estas son cifras **del corte**, no constantes incrustadas. V00–V08 trabajan en paralelo.

**Integridad referencial verificada:**
- Evidencias sin documento: **0**; evaluaciones sin documento: **0**.
- V06 sin código SDO: **0**; V07 sin solicitud: **0**.
- Referencia V07 a código SDO no encontrado: **1** (`REQ00571` → `RFU-GNO-08`), pendiente de contraste por V00/V07.
- Se observaron 55 pares SDO–documento con multiplicidad en `requirement_evidence` y 213 grupos repetidos por documento/SDO/cobertura/nivel en `document_assessments`. No se consideran automáticamente duplicados: pueden ser evidencias/criterios diferentes. La evaluación corresponde a V00–V05, sin alterar datos.

**Queries independientes**: `COUNT(*)` sobre las fuentes, distribución por `proposed_evaluation` y `classification`, `COALESCE(SUM(hours_expected),0)` solo sobre histórico, `to_regclass`, `LEFT JOIN` para huérfanos y `GROUP BY` para multiplicidad. Ningún `UPDATE`, `INSERT` ni DDL ejecutado.

## 3. Incidencias y solución en rama

| ID | Módulo | Severidad | Hallazgo y causa | Corrección/commit | Verificación / estado |
| --- | --- | --- | --- | --- | --- |
| V09B3-01 | API / navegación | Alta | `/api/data` 403 impedía incluso consultar información anonimizables | `aae4dbd`, `6d9461d` | 511/68 consultables por proyección; prueba pura y CI: corregido en rama |
| V09B3-02 | Brechas | Alta | Pantalla 403 sin información útil, aun con referencias V07 | `9f54e86`, `24a859c` | Referencias V07 separadas de registro; 14 tests: corregido en rama |
| V09B3-03 | Fichas | Media | Matrices sin navegación individual | `e7bf098` | Fichas anonimizadas SDO, solicitudes y documentos: implementado, E2E pendiente |
| V09B3-04 | Bolsa de horas | Alta | Regla fija del proveedor en bundle y totales V08 en resumen público | `b90a42d`, `5d5f6ee` | Sin multiplicadores ni totales V08 expuestos: corregido, falta prueba runtime |
| V09B3-05 | Proyección pública | Alta | Riesgo de fuga futura por `...r` en filas SDO | `44b7bfe`, `4996d98` | Lista blanca explícita y prueba con valores secretos: corregido |
| V09B3-06 | Regresión CI | Media | Pruebas del bloque 2 esperaban 403 en endpoints ahora limitados a metadatos | `8d89e0e`, `099538a` | 14/14 pruebas superadas, CI verde: corregido |
| V09B3-07 | V08 dinámico | Media | Una futura estimación podía ser invisible en ficha de solicitud | `1c7c694`, `a1436bd`, `35339f6` | Recuento de métodos por solicitud sin horas: corregido |
| V09B3-08 | Paginación | Media | Cambio de corte podía dejar página fuera de rango | `4184b91` | Página acotada y build: corregido |
| V09B3-09 | V07↔SDO | Media | Un código referenciado no existe en base SDO | Sin modificación de datos | Comunicar a V00/V07; pendiente |
| V09B3-10 | Preview E2E | Alta | Conector Vercel devuelve 403 para despliegues y 404 para proyecto, aunque GitHub indica deployment Ready | Sin cambio de credenciales | Inspección de navegador pendiente; bloqueo |
| V09B3-11 | Autenticación | Alta | No hay SSO/OIDC individual verificado en servidor | Sin acceso a configurar identidad | No exponer textos, expedientes, títulos ni enlaces; bloqueo |

## 4. Seguridad y políticas de consulta

- `/api/data`: **200 en entorno con Neon configurado** para **solo metadatos anonimizados**. Las columnas SQL son explícitas; quedan fuera `request_text`, `requester`, `description`, `finding`, `basis`, `rationale`, `url`, `hours_expected`. El proyector devuelve texto restringido, enlaces `null` e IDs documentales hash. **No hay respuesta de producción verificada**, por lo que esta afirmación es de diseño y pruebas unitarias, no smoke test HTTP real.
- `/api/gaps`: la API de metadatos devuelve candidatos V07 `Brecha existente`; `rows=[]`, `registryStatus=not_migrated`. No hay brechas consolidadas, ni se crean a partir de V06.
- `/api/v2-summary`: contadores agregados actualizados; V08 solo número de métodos, sin cifras por método; reservas activas corregidas usando fecha `lease_expires_at > NOW()`.
- `/api/update`: mantiene 403 frente a escritura anónima.
- `DASHBOARD_ACCESS_KEY`: no se restableció.
- Los ficheros originales y su versión, evidencia contractual, observaciones específicas, identidad de personas y horas de proveedores siguen reservados. **Una API pública no es un lugar autorizado para alojarlos** aunque el usuario final los necesite.

La divulgación de los metadatos anonimizados también requiere una revisión institucional antes de **producción**, por ser una aplicación del Poder Judicial.

## 5. Pruebas automatizadas y Preview

**CI del último cambio funcional**: https://github.com/Trigoat2612/dashboard-requerimientos-sdo/actions/runs/43299799614  
**Resultado:** `success`; **14 pruebas superadas, 0 fallidas**, `npm run build` exitoso.

Pruebas incluidas: filtrado compuesto, acentos, paginación, CSV, denegación de escritura, métodos sin sumar horas históricas, ausencia de consultas a columnas restringidas, enmascaramiento de secretos inyectados, correspondencia de IDs hash de documento, candidatos V07 no confirmados, categorías V06/V07, vista pública, `DASHBOARD_ACCESS_KEY` ausente del endpoint y presencia de reglas responsive.

**Preview**: el estado Vercel de GitHub para el commit de código `4184b91` devolvió `success` con un enlace de despliegue. La URL estable comunicada en el PR es:

https://dashboard-requerimientos-sd-git-8b1718-miguel-trigosos-projects.vercel.app

**Limitación**: el conector Vercel no permite inspeccionar deployments (403), la búsqueda de proyecto devuelve 404 y el navegador web disponible no pudo abrir la URL. No se han ejecutado pruebas reales de carga a Neon, comportamiento de API HTTP, exportación en navegador, rendimiento, tablet/móvil visual, ni logs runtime del Preview. **No confundir “Ready” y compilación exitosa con validación integral de navegador.**

## 6. Matriz de criterios de aceptación gerencial

| Pregunta | Estado |
| --- | --- |
| 1. ¿Qué exige cada SDO? | Códigos/metadatos consultables; cláusula/obligación literal reservada |
| 2. ¿Qué está demostrado? | V06 muestra propuesta; conformidad oficial no se infiere |
| 3. ¿Qué no es verificable? | V06 distingue `No verificable` y sin dictamen |
| 4. ¿Qué brechas sustentadas? | Bloqueado: no existe registro consolidado autorizado |
| 5. ¿Qué responsables/acciones? | Restricción: no se publican hallazgos ni responsables sin autorización |
| 6. ¿Qué solicitudes cubre la SDO? | Clasificación V07 `Cubierta` / `Pendiente contractual`; propuesta, no decisión oficial |
| 7. ¿Qué incrementos son nuevos? | V07: `Genuinamente nueva`, separado de obligaciones existentes |
| 8. ¿Cuáles son estimables? | No hay métodos independientes V08; condiciones de habilitación se consultan en resumen |
| 9. ¿Diferencia frente a Softplan? | No disponible: faltan estimaciones comparables sustentadas |
| 10. ¿Qué requiere validación? | Todas las propuestas V06/V07/V08 y cierres de brechas; no aprobadas automáticamente |

## 7. Puertas de publicación progresiva y reversión

1. **Prueba integral Preview**: comprobar que `/api/data`, `/api/gaps` y `/api/v2-summary` devuelven JSON correcto con Neon real, contienen exclusivamente el contenido permitido, responden 405 a escritura improcedente, y permiten navegar 511/68 registros con filtros, fichas, CSV y estados vacíos en móvil.
2. **Autorización institucional**: aprobar qué metadatos pueden publicarse en un dominio abierto y habilitar SSO para información completa. No usar claves compartidas.
3. **V00**: resolver la referencia SDO desconocida, verificar duplicaciones documentales y validar el modelo del registro de brechas.
4. **Neon**: solicitar autorización **antes** de ejecutar `sql/v09-gap-register-DRAFT.sql`; luego verificar FKs, permisos, tablas vacías y respaldo. No ejecutar un rollback DDL con datos automáticamente.
5. **Producción**: con los puntos previos verificados, solicitar autorización expresa del usuario para fusionar/publicar módulos completos. Conservar SHA prepublicación y deployment anterior para reversión controlada; monitorizar endpoints luego de publicar.

### Recomendación

**NO integrar el PR #1 a `main` ni desplegar a producción en este bloque.** La consulta parcial ha sido restablecida de modo seguro a nivel de código, los 14 tests y el build están verdes, pero faltan permisos para pruebas reales en Preview, una validación institucional de divulgación y el registro consolidado de brechas. Ningún cambio alteró conformidades, clasificaciones V07, reservas, resultados V08 ni Neon.

**Fin del bloque 3:** se detiene la ejecución; no se inicia el siguiente bloque automáticamente.
