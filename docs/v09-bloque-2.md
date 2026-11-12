# V09 | BLOQUE 2 · Validación, brechas y preparación de despliegue

**Fecha:** 12/11/2026 (Perú)  
**Rama:** `feature/v09-dashboard-alineamiento`  
**PR:** https://github.com/Trigoat2612/dashboard-requerimientos-sdo/pull/1 (borrador; no fusionado)  
**Base de producción:** `main`, sin modificación durante este bloque.

## 1. Objetivo y resultado

Se validó el primer bloque, se corrigió la exposición anónima de detalles, se incorporó una interfaz de brechas lista para consumir registros institucionales autorizados y se reforzó el diseño de migración para Neon. **No está listo para producción**: falta autenticación institucional, autorización de la migración y pruebas end-to-end sobre Vercel Preview.

## 2. Conciliación con Neon (12/11/2026 14:48 Perú)

Consulta independiente, de solo lectura, al proyecto `super-credit-91949836`, base `neondb`, esquema `ejenp_requerimientos_sdo`:

| Métrica | Valor |
| --- | ---: |
| Requisitos SDO | 511 |
| Propuestas V06 | 142 |
| Cumplimiento demostrado V06 (propuesta) | 1 |
| Cumplimiento parcial V06 (propuesta) | 106 |
| No verificable V06 | 35 |
| Sin dictamen V06 | 369 |
| Solicitudes / clasificaciones V07 | 68 / 68 |
| V07: Cubierta / pendiente contractual / brecha existente | 5 / 5 / 2 |
| V07: Duplicada / genuinamente nueva / indeterminada | 2 / 18 / 36 |
| Estimaciones independientes V08 | 0 |
| Horas de triaje histórico (NO justificadas) | 6.800 |
| Archivos / carpetas | 484 / 225 |
| Evaluaciones documentales | 2.388 |
| Tabla de brechas V09 | No existe |

Las cifras son dinámicas porque V00–V08 siguen trabajando. La integración usa consultas al momento de lectura, no totales fijos. **No sumar las evaluaciones parciales como brechas reales.**

### Integridad

- V06 → SDO, filas huérfanas: **0**.
- V07 → solicitudes originales, filas huérfanas: **0**.
- `requirement_evidence` → `source_documents`, filas huérfanas: **0**.
- Enlaces de V07 hacia códigos SDO inexistentes: **1**. Se requiere cotejo por V00/V07 sin alteración de su evaluación.
- Existen 8 identificadores distintos de brechas en referencias V07 distribuidos entre 7 solicitudes; no prueban por sí mismos el estado, causa ni cierre. No se crean brechas artificiales a partir de ellos.

## 3. Cambios implementados en la rama

| Componente | Cambio |
| --- | --- |
| `api/data.js` | Respuesta 403 antes de consultar Neon, para accesos no autenticados; también se rechazan tokens/cookies inventados |
| `api/gaps.js` | Nuevo endpoint de denegación por defecto para hallazgos, responsables y evidencias |
| `src/App.jsx` | Manejo explícito de acceso restringido; tablas, exportaciones y fichas no se muestran sin autorización; filtros propuestos V06/V07; limpieza de datos tras pérdida de acceso |
| `src/GapExplorer.jsx` | Matriz de brechas con filtros, paginación, CSV seguro y relaciones SDO/documentos/solicitudes, visible solo con respuesta de autorización institucional explícita |
| `src/gap-model.js` | Filtrado, paginación y serialización tabular puros y comprobables |
| `src/csv-utils.js` | Escapado de comillas, CRLF, BOM UTF-8 y defensa contra fórmulas de hojas de cálculo |
| `src/V09Overview.jsx` | Navegación desde el resumen a brechas |
| `sql/v09-gap-register-DRAFT.sql` | Claves externas, huella única obligatoria, evidencia formal para cierres, índices, bitácora, vista interna y permisos restrictivos. No ejecutado |
| `tests/v09.test.mjs` | Pruebas reproducibles de filtros, acceso anónimo, integridad de exportación y separación de indicadores |
| `.github/workflows/verify-tablero-brechas.yml` | Ejecuta `npm test` y `npm run build` antes de considerar correcto el PR |
| `README.md` | Documenta seguridad, restricciones, pruebas y bloqueo Vercel |

Los registros de V00–V08, colas, reservas, conformidades y estados históricos no fueron modificados.

## 4. Validaciones ejecutadas

**GitHub Actions:** https://github.com/Trigoat2612/dashboard-requerimientos-sdo/actions/runs/43293899128  
**Resultado:** `success` (ejecución del 12/11/2026).  
**Pruebas:** 10 superadas, 0 fallidas; `npm run build` completó exitosamente.

Comprobaciones cubiertas:
- filtros por SDO, tipo, componente, severidad, responsable y estado, paginación y referencias;
- petición anónima e intento con token/cookie falsos para `/api/data` y `/api/gaps`: denegación 403;
- escritura pública mediante `/api/update`: denegación 403;
- no mezclar las 6.800 h históricas con `hours_estimate_proposals`;
- escape de CSV, BOM y saltos CRLF;
- compilación React/Vite de la interfaz existente con V09.

**No ejecutadas:** navegador end-to-end, validación móvil visual, endpoints conectados a Neon bajo sesión real y regresión de Preview. No se afirma haber validado las fichas autorizadas ni el consumo efectivo de brechas.

## 5. Migración de brechas: estado y autorización

- `to_regclass('ejenp_requerimientos_sdo.v09_gap_register')` devolvió **NULL**.
- DRAFT compatible conceptualmente con PK/FK existentes: código SDO text, documento text, solicitud bigint.
- Script idempotente y aditivo: usa `CREATE TABLE IF NOT EXISTS` y `CREATE OR REPLACE VIEW`. Requiere cotejo final de permisos/DDL en un entorno habilitado.
- No implementa carga automática, ni considera propuestas de V06 como brechas confirmadas.
- **Sin ejecución** porque la creación de tablas/vista persistentes requiere autorización expresa del usuario. La reversión de una migración aplicada debe planificarse con respaldo y sin `DROP` destructivos automáticos.
- La vista interna diseñada no debe publicarse antes de incorporar autorización verificable.

## 6. Riesgos de seguridad

1. **Actual producción anterior:** podría seguir exponiendo documentos y hallazgos, dado que el bloqueo 403 solo está en la rama V09. Riesgo prioritario pendiente de cambio controlado autorizado.
2. **Identidad:** Neon Auth no está habilitado y el conector Vercel no da acceso suficiente al proyecto. No se puede distinguir de forma verificable usuarios institucionales y anónimos. Política: denegar el detalle.
3. **API y CSV:** en rama V09 las rutas sensibles deniegan anónimos, el cliente exige `access='institutional_verified'` y limpia cachés al fallar. Hay mitigación de fórmulas CSV.
4. **Autenticación futura:** usar SSO/OIDC respaldado por la infraestructura existente, validando firma, audiencia, emisor, caducidad y permisos en el servidor, con auditoría. No utilizar `DASHBOARD_ACCESS_KEY`, simples headers de cliente ni filtros por títulos.

## 7. Vercel Preview

**Estado:** no disponible para esta conexión. La consulta del proyecto devolvió 404 y la consulta de despliegues 403. La lista de proyectos del equipo conectado no contenía el proyecto solicitado. No se puede garantizar el objetivo ni las credenciales del despliegue. **No se creó otro proyecto, no se realizó Preview y no se alteró producción.**

## 8. Estrategia de integración progresiva

1. **Gate A: seguridad pública (candidato independiente):** proteger la consulta anónima, verificar en Preview el 403 de rutas restringidas y la continuidad del resumen agregado. Requerirá autorización expresa para publicar y plan de retroceso.
2. **Gate B: migración:** revisar con V00 el inventario de brechas y enlaces; obtener autorización previa para aplicar solo DDL aditivo; verificar FKs, permisos, registros vacíos y planes de rollback.
3. **Gate C: autenticación y fichas:** configurar SSO individual y roles (institucional / anónimo), endpoints autorizados con registros enlazados y trazabilidad; probar casos de acceso permitido/denegado.
4. **Gate D: publicación controlada:** ejecutar Preview por commit con smoke tests de Neon, navegación, filtros, CSV, errores y responsive; aprobar expresamente la publicación; integrar solo componentes independientes verificados y comprobar producción. Revertir con commit anterior/despliegue anterior en caso de fallo; jamás revertir una migración con datos sin inspección.

## 9. Recomendación

**NO fusionar el PR #1 ni desplegar a producción** en este momento. La compilación y las pruebas unitarias son positivas, pero faltan autenticación institucional, Vercel Preview, regresión real y autorización de la migración. Continuar en la misma rama después de resolver los bloqueos, sin alterar resultados V00–V08.

**Detención del bloque:** V09 no continuará automáticamente.
