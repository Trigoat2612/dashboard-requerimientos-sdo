# V09 — Publicación definitiva del cierre de novedad técnica V00 V9

**Fecha de corte verificada:** 13 de noviembre de 2026  
**Dashboard:** https://dashboard-requerimientos-sdo.vercel.app/  
**Repositorio:** Trigoat2612/dashboard-requerimientos-sdo  
**Rama productiva:** `main`  
**Proyecto Neon:** `super-credit-91949836` · `neondb` · `br-shy-dawn-b5or7hgh`  
**Versión final del dato:** `V00-20261113-NOVEDAD-TECNICA-V9`

## 1. Decisión de fuente

Antes de implementar se inspeccionaron las tablas y vistas `v00_*` realmente existentes.

La versión gerencial vigente es `ejenp_estimacion_v08.v00_novedad_gerencial_v9`, conciliada con la matriz individual `v00_final_novedad_318_v9` y las actividades `v00_novedad_wbs_v9`.

Las versiones V5–V8, propuestas V07, elegibilidad V2 y estimaciones WBS históricas se mantienen para auditoría, **pero no determinan por sí solas qué horas corresponden a desarrollos nuevos**.

## 2. Resultados técnicos comprobados

| Concepto | Valor |
| --- | ---: |
| Requisitos SDO en catálogo | 511 |
| Brechas Laboral | 331 |
| Solicitudes individualmente contrastadas | 318 |
| Nuevas funcionalidades EJE acreditadas | 6 |
| Solicitudes sin horas incrementales EJE admitidas | 312 |
| Horas optimistas | 1.455,000 |
| Horas más probables | 2.371,000 |
| **PERT incremental** | **2.490,833** |
| Horas pesimistas | 4.006,000 |
| Actividades WBS de nuevas funcionalidades | 44 |
| Horas técnicas históricas brutas, solo referencia | 18.746,700 |
| Horas preliminares no incluidas | 16.255,867 |

Desglose de las 312 solicitudes sin novedad técnica admitida:

| Dictamen final V00 V9 | Solicitudes |
| --- | ---: |
| Alcance original SDO | 108 |
| Alcance original de brechas | 2 |
| Cambios directos en sistemas externos | 66 |
| Novedad técnica no acreditada | 73 |
| Reformulación pendiente para EJE | 34 |
| Configuración o ajuste | 21 |
| Duplicados | 8 |

**Únicamente las siguientes seis solicitudes tienen novedad acreditada y horas WBS/PERT admitidas:**

| Solicitud | PERT técnico admitido (h-persona) |
| --- | ---: |
| REQ00157 | 750,001 |
| REQ00487 | 554,333 |
| REQ00530 | 415,333 |
| REQ00547 | 512,667 |
| REQ00833 | 215,166 |
| REQ00839 | 43,333 |
| **Total** | **2.490,833** |

El método es **WBS + juicio experto + estimación de tres puntos**, con `PERT=(O+4M+P)/6` por actividad. No representa aprobación financiera ni acto contractual.

## 3. Cambios implementados

### API consolidada

`api/integrated-audit.js` incorpora una consulta autoritativa de V00 V9 para las 318 solicitudes y valida:
- Cantidad de registros originales = 318.
- Matriz V00 final = 318 códigos únicos y correspondencia con identificador original.
- Homogeneidad del identificador de corte.
- Igualdad entre resumen gerencial y suma individual de horas PERT.
- Separación de resultados R48 V4/V5 y vista V00 de 49 solapamientos.

La ficha `view=detail` recupera decisiones V00, WBS admitida, requisitos SDO, brechas, evidencias, QA, R48, riesgos y antecedentes. Las **WBS históricas excluidas nunca se muestran como horas nuevas admitidas**.

### Panel ejecutivo

`src/IntegratedAudit.jsx` presenta:
- Universo SDO, Laboral y 318 solicitudes.
- Seis desarrollos nuevos EJE y sus escenarios O/M/PERT/P.
- Distribución por ocho categorías de decisión técnica final.
- Horas históricas brutas frente a horas descartadas y horas técnicas admitidas.
- Totales por área y seis fichas directamente consultables.
- Conclusiones y recomendaciones basadas en casos individuales.

### Matrices y trazabilidad

- Matriz completa de 318 decisiones V00 V9 con filtros, ordenación, paginación y detalle.
- Obligaciones originales Softplan limitadas a **108 casos SDO y 2 de brechas**, sin atribuir otras exclusiones automáticamente al proveedor.
- 331 evaluaciones Laboral y vínculos registrados.
- Seguimiento de agentes V08, separando WBS histórica y aportación técnica nueva.
- Exclusiones reales R48: **28 registros en `v00_r48_final_scope_v4` y 19 en `v00_r48_resolutions_v5`**.
- **49 relaciones** de solapamiento según `v00_overlap_dashboard_49_v7`.
- El cambio directo de SIJ, REMAJU o SERNOT no es desarrollo EJE. Se conserva la opción de reformular el alcance para implementar una función genuinamente nueva **dentro** del EJE.

### Exportaciones

- XLSX editable de **56 columnas**, incluidos contrato SDO, V07, V2, decisión V00 V9, exclusiones, WBS y fuentes. El detalle íntegro se recupera desde `view=export` solo al exportar.
- PPTX gerencial de **12 diapositivas** con cierre V00 V9, clasificación, seis novedades, escenarios, exclusiones, solapamientos, riesgos y recomendaciones.
- Los archivos son OOXML; las pruebas verifican ZIP, XML y relaciones internas.
- **Limitación:** la plantilla PowerPoint oficial no estaba en los archivos del repositorio. El archivo generado es editable con diseño propio, no reproducción certificada de la plantilla institucional.

## 4. Pruebas y publicación

Se empleó el despliegue automático desde `main` mediante GitHub/Vercel, sin condicionar la publicación a un Preview protegido. Las pruebas de GitHub Actions verifican:
- 37 pruebas Node y seguridad del dashboard.
- Compilación Vite.
- Respuesta HTTP real del dashboard en su dominio productivo.
- 318 solicitudes únicas y 331 brechas.
- Resumen gerencial V00 V9 y reconciliación exacta de horas.
- Ficha nueva REQ00157 con WBS admitida.
- Ficha de cambio externo REQ00613 con **cero horas EJE** y antecedentes históricos conservados.
- R48 V4 y V5 accesibles.
- Excel exportado desde las 318 fuentes íntegras.
- Rechazo de escrituras mediante POST a la API de solo lectura.

El resultado publicado del corte técnico fue:
`{"status":"OK","requests":318,"gaps":331,"version":"V00-20261113-NOVEDAD-TECNICA-V9","novedades":6,"pertV00":2490.833,"r48V4":28,"r48V5":19,"admittedWbs":8,"externalExcluded":"REQ00613"}`.

La verificación de 8 WBS corresponde específicamente a REQ00157; las 44 actividades totales corresponden al conjunto de seis funciones nuevas.

## 5. Seguridad y mantenimiento

- No se cambiaron los datos originales de Neon ni las conclusiones oficiales.
- No se publicaron secretos, usuarios administradores ni cadenas de conexión.
- No se restauró `DASHBOARD_ACCESS_KEY`.
- No se introdujeron restricciones nuevas al acceso documental.
- Los indicadores usan el último corte V00 V9 leído desde Neon y se actualizan mediante el botón **Actualizar Neon**.
- Si V00 registra un corte con nueva estructura o versión, se debe revisar el contrato de lectura para no mezclar decisiones incompatibles.

## 6. Limitaciones reales

1. La fuente V00 V9 es una **conclusión técnica de novedad**, no resolución de contratación ni aprobación de pago.
2. El funcionamiento final de funcionalidades SDO originalmente contratadas exige comprobación operativa diferenciada del vínculo contractual.
3. Los cambios directos a sistemas externos deben ser atendidos por sus responsables o reformulados como desarrollo específico EJE, según corresponda.
4. El PowerPoint requiere el archivo institucional oficial para heredar exactamente su diseño.

**Conclusión:** se adoptó el cierre de novedad V00 V9 como única referencia gerencial para horas de nuevos desarrollos EJE, se preservaron V07/V08/R48 como historial y se comprobó su exposición en el dashboard productivo.
