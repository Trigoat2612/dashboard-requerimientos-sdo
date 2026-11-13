# V09 | Informe de implementación de la auditoría integral SDO

**Corte de implementación:** 13/11/2026  
**Proyecto:** Dashboard de Requerimientos SDO – Programa EJE No Penal  
**Repositorio:** `Trigoat2612/dashboard-requerimientos-sdo`  
**Destino:** `main`, desplegado automáticamente por Vercel en `https://dashboard-requerimientos-sdo.vercel.app/`  
**Neon:** proyecto `super-credit-91949836`, base `neondb`, rama `br-shy-dawn-b5or7hgh`

## 1. Alcance efectivamente implementado

Se incorporó una capa de consulta consolidada **de solo lectura**, con cuatro fuentes:

- `ejenp_requerimientos_sdo`: 511 requisitos originales SDO, documentos y propuestas históricas.
- `ejenp_v14_brechas`: 331 registros de la auditoría Laboral y sus evaluaciones.
- `ejenp_auditoria_318`: 318 solicitudes originales, revisiones V07, QA, relaciones SDO/brechas y evidencias.
- `ejenp_estimacion_v08`: elegibilidad correctiva V2, unidades, escenarios WBS/PERT, supuestos, riesgos, componentes y seguimiento por agente.

El endpoint `api/integrated-audit.js` usa consultas parametrizadas y selecciona la última revisión disponible de cada registro, preservando su historial en el detalle individual. Las relaciones múltiples se agregan en listas para evitar duplicar solicitudes por cada código SDO o evidencia. El snapshot es compacto; al abrir una ficha se consulta el fundamento completo.

## 2. Nuevas pestañas e interacción

| Pestaña | Resultado |
| --- | --- |
| Resumen gerencial integral | Indicadores firmes/condicionales/excluidos, horas O/M/PERT/P, pendientes, solapamientos y distribución por agente y causa |
| Matriz de 318 solicitudes | Una fila por código; filtros combinables, paginación, ordenación, descarga Excel y ficha individual |
| Obligaciones contractuales | Exclusiones de esfuerzo propio y referencia SDO/brecha, texto SDO y distinción entre obligación y funcionamiento |
| 331 brechas Laboral | Evaluación vigente, texto origen, vínculo SDO y solicitudes relacionadas |
| Avance estimaciones V08 | V08-09 a V08-16: asignaciones, estados y horas estimadas diferenciadas |
| Exclusiones R48 | Identificación de candidatas por categorías V07/V2 y estado R48 pendiente de registro; no inventa resultados |
| Solapamientos y componentes | Pares de trabajo relacionados, resolución pendiente y titular del componente compartido |

Las pestañas previas de SDO, documentos, contraste, auditoría histórica y clasificación de 68 solicitudes **se conservaron**. No se restableció `DASHBOARD_ACCESS_KEY` ni se añadieron barreras documentales.

**Acceso directo a ficha:** `https://dashboard-requerimientos-sdo.vercel.app/?req=REQ00411` (sustituir por el código correspondiente).

## 3. Detalle por requerimiento

La ficha comprende texto original, V07 e historial QA, revisión V2, requisitos SDO y brechas vinculadas, diferencia original/adicional, justificación experta WBS, lista de actividades con O/M/PERT/P, metodología y comparaciones funcionales registradas, hipótesis, riesgos, contingencias, dependencias, fuentes, referencias, revisiones cruzadas y eventos de auditoría.

Las solicitudes sin WBS muestran *Pendiente de estimación*, no cero ficticio. Las excluidas muestran **cero horas incrementales propias** y motivo sustentado, sin convertir automáticamente toda exclusión en obligación Softplan.

## 4. Exportaciones

- `src/integrated-export.js`: genera **XLSX** con los 318 códigos y 41 columnas de trazabilidad, incluidas bases contractuales completas y fuentes cargadas bajo demanda desde `GET /api/integrated-audit?view=export`.
- Genera una presentación **PPTX de 12 diapositivas**, con universo, elegibilidad, obligaciones, escenarios, distribución, avance, riesgos, exclusiones y recomendaciones. Los archivos OOXML se producen sin enviar secretos al navegador ni añadir dependencia de terceros.
- **Plantilla institucional:** no se encontró una plantilla PPTX institucional en los archivos del repositorio; se utiliza una presentación editable con identidad visual genérica y debe sustituirse por la plantilla oficial cuando esta se proporcione.

## 5. Reconciliación y lectura correcta

- Universo de solicitudes: 318 códigos únicos, sin multiplicar filas por relaciones.
- Brechas Laboral: 331 registros.
- Elegibilidad V2 de referencia: 10 firmes, 169 condicionales, 139 excluidas. Las cifras reales se leen cada vez de Neon.
- El número de estimaciones aumenta conforme los agentes finalizan; las tarjetas calculan **solo** las WBS realmente persistidas.
- El PERT se suma independientemente para firmes y condicionales. La estimación bruta se distingue de la estimación QA aceptada y de la aprobación contractual.
- **No existe una aprobación institucional verificada en estas fuentes que permita declarar horas contractualmente aprobadas.** No se utiliza cero para sustituir ese estado.
- Los solapamientos pendientes se identifican; la suma bruta podría requerir depuración posterior por V00.

## 6. Estado y límite R48

La referencia histórica del frente R48 comprende 48 exclusiones (34 configuración y 14 fuera de alcance). En los registros vigentes consultables, **40 solicitudes** tienen esas dos categorías en la última evaluación V07. **No existe un registro específico R48 consultable** en los esquemas revisados con decisiones finales individualizadas. Por ello el dashboard exhibe la línea base V2 y advierte `Pendiente de registro R48`; no finge 48 dictámenes concluidos. Cuando V00 formalice el esquema/resultado correspondiente, habrá que mapearlo expresamente, conservando la revisión previa.

## 7. Archivos introducidos o modificados

- `api/integrated-audit.js`: snapshot, detalle individual, exportación completa, solo GET.
- `src/IntegratedAudit.jsx`: pestañas, tarjetas, tablas, filtros, navegación, detalle y acciones.
- `src/integrated-model.js`: filtros, indicadores, criterios de cero/no estimación, matriz exportable.
- `src/integrated-audit.css`: diseño responsive.
- `src/integrated-export.js`: XLSX y PPTX.
- `src/App.jsx`: integración en menú sin eliminar funciones existentes.
- `tests/integrated.test.mjs`, `tests/exports-opc.test.mjs`: pruebas de consistencia y estructura de los artefactos.
- `scripts/audit-production-smoke.mjs`, `.github/workflows/verify-tablero-brechas.yml`: reconciliación HTTP productiva tras compilación.

## 8. Validación técnica

1. Las 7 consultas SQL estáticas del snapshot se ejecutaron directamente contra Neon y devolvieron 318 solicitudes, 331 brechas, 8 agentes, 41 solapamientos, 2 componentes compartidos y 511 requisitos SDO.
2. Las consultas SQL individuales del detalle se ejecutaron para `REQ00411`, sin errores.
3. GitHub Actions superó los tests de Node y compilación Vite.
4. El smoke productivo confirmó HTTP 200 en página, snapshot y ficha `REQ00411`; 318 códigos únicos, 331 brechas, al menos una estimación con WBS y rechazo de escritura POST.
5. El exportador genera archivos OOXML con ZIP íntegro, XML parseable y relaciones internas verificadas mediante pruebas automatizadas.
6. Vercel informó despliegue exitoso desde `main`. El SHA actual se determina en GitHub/Vercel para no fijar en el informe uno obsoleto.

## 9. Cuestiones pendientes fuera de esta implementación

- La revisión individual R48 necesita una fuente final persistida para mostrar resultados realmente aprobados por V00.
- Los solapamientos y componentes compartidos todavía necesitan resolución QA antes de presentar un total depurado.
- La plantilla gráfica oficial PowerPoint requiere el archivo original.
- El dashboard no emite conformidades ni sustituye aprobaciones institucionales.
- Las autorizaciones de Google Drive siguen siendo las propias del repositorio de origen; el dashboard conserva los enlaces almacenados.

**Conclusión:** las vistas y consultas integradas están implementadas y verificadas en producción. El cierre de decisiones contractuales, QA V08, R48 y la plantilla corporativa sigue condicionado a evidencias y aprobaciones externas, sin alterar ni falsear los resultados históricos.
