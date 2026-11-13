# Informe técnico de implementación del dashboard de evaluación SDO

**Destino productivo:** https://dashboard-requerimientos-sdo.vercel.app/  
**Repositorio:** Trigoat2612/dashboard-requerimientos-sdo · rama `main`  
**Fuentes del informe:** proyecto Neon `super-credit-91949836`, base `neondb`, rama `br-shy-dawn-b5or7hgh`  
**Esquema:** `ejenp_estimacion_v08`  
**Corte institucional:** vistas V13 del informe de 318 solicitudes y 122 propuestas

## 1. Fuentes y procedimiento

Se consumen exclusivamente cuatro vistas para los resultados visibles:

1. `v00_informe_gerencial_v13`
2. `v00_informe_categorias_v13`
3. `v00_informe_matriz_318_v13`
4. `v00_informe_wbs_122_v13`

Las consultas de evidencia SDO, evaluaciones Laboral, referencia metodológica y archivos existentes se utilizan solo como contexto, sin reemplazar las clasificaciones V13.

La API `api/report-v13.js` valida, en cada petición de resumen, el número de códigos únicos, las seis categorías, el desglose externo 52/34, el total de propuestas, la suma PERT de las solicitudes y de las actividades WBS. No modifica bases de datos.

## 2. Conciliación institucional comprobada

| Indicador | Resultado |
| --- | ---: |
| Solicitudes analizadas | 318 |
| Códigos únicos | 318 |
| Incrementales propuestas sujetas al usuario final | 122 |
| Horas-persona PERT propuestas | 13.547,86 |
| Otras categorías | 196 |
| Estimaciones técnicas originales conservadas | 175 |
| Actividades WBS pertenecientes a propuestas | 635 |
| Funcionalidades comprendidas en SDO | 94 |
| Funcionalidades comprendidas en brechas | 2 |
| Duplicadas | 8 |
| Sistemas externos o reformulación | 86 |
| Configuraciones y ajustes | 6 |

Dentro del grupo de sistemas externos o reformulación existen 52 modificaciones directas a sistemas satélite y 34 solicitudes con recomendación de reformular funcionalidad dentro del EJE, si corresponde.

Los datos WBS concilian por código de solicitud y por total de horas con la matriz y el resumen. No hay estimación nueva generada por la interfaz. Los escenarios históricos no son incorporados al esfuerzo incremental.

## 3. Pestañas publicadas

La interfaz principal exhibe:

- **Resumen gerencial:** seis indicadores principales, distribución de categorías, comparativo nuevas/no incrementales, número y horas por especialidad, fases WBS y conclusiones.
- **Análisis de requerimientos:** 318 registros, texto original, clasificación, motivo individual, referencias, acciones y filtro/paginación.
- **Funcionalidades incrementales:** 122 propuestas, horas O/M/PERT/P, condiciones de evaluación, componente reutilizado y desplegable con actividades WBS.
- **Criterios y metodología:** definición, criterio, ejemplo real, tratamiento y acción para cada categoría; fórmula PERT; fases WBS efectivamente registradas; comparación con las metodologías que constan en `ejenp_requerimientos_sdo.methodology_reviews`.
- **Obligaciones originales:** cobertura de SDO y brechas sin reestimar.
- **Exclusiones y reformulación:** solicitudes no incrementales con sus motivos y acciones.
- **Brechas Laboral:** consulta de los 331 registros originales.
- **Documentación, requisitos SDO y contraste:** pestañas existentes preservadas.

No se exponen títulos de procesamiento interno de R48 ni la cronología técnica como indicadores gerenciales.

## 4. Ficha individual

La ruta con parámetro `?req=REQ00157` abre una ficha contextual con el texto original, alcance contratado, propuesta adicional, clasificación y justificación técnica registrada, acción y responsable, referencias SDO y brechas, vínculos documentales, criterios y WBS/PERT.

La ficha de una propuesta incremental recupera su desglose de actividades desde `v00_informe_wbs_122_v13` y comprueba la suma frente a las horas de esa solicitud. Las demás categorías muestran cero horas incrementales y no inventan WBS.

El acceso a documentos continúa mediante los vínculos ya existentes en `/api/data` y la navegación pública del dashboard, sin restablecer `DASHBOARD_ACCESS_KEY`.

## 5. Exportaciones

- **Excel XLSX (siete hojas):** Resumen gerencial, Matriz 318, Incrementales 122, WBS 635, Criterios y método, Trazabilidad documental, Supuestos y riesgos. Incluye las justificaciones y condiciones individuales, excluyendo las horas no verificadas de las categorías no incrementales.
- **PowerPoint PPTX (doce diapositivas):** distribución de categorías, propuestas incrementales, esfuerzo por especialidad y fase WBS, criterios, escenarios y acciones.
- Ambas exportaciones se calculan desde las vistas V13 vigentes y son independientes de la exportación histórica del dashboard.

**Limitación:** no se identificó una plantilla PPTX institucional oficial en el repositorio. La presentación es editable y utiliza un diseño neutro; la aplicación de un patrón gráfico oficial requiere el archivo fuente correspondiente.

## 6. Pruebas y publicación

La aplicación usa React, Vite, funciones serverless Vercel y Neon PostgreSQL.

Las comprobaciones abarcan:
- Pruebas de integridad del modelo y casos negativos por conciliación incorrecta.
- Validación de filtros y sumatorias de los 318 registros.
- Generación XLSX de siete hojas y PPTX de doce diapositivas.
- Verificación ZIP/XML de los documentos exportables.
- Compilación `npm run build` y pruebas `npm test`.
- Comprobación HTTP de producción, incluido el bundle React, la API consolidada, las categorías 122/94/2/8/86/6, la suma de 635 WBS, el Excel íntegro y las fichas `REQ00157` y `REQ00613`.
- Comprobación de que `/api/data` sigue proporcionando documentos y enlaces y de que la API del informe rechaza operaciones POST.

La publicación se produce directamente desde `main` mediante la integración GitHub/Vercel. Los registros finales de CI y el SHA productivo pueden comprobarse en GitHub Actions y el detalle del despliegue Vercel.

## 7. Condiciones funcionales

Las 122 funcionalidades se **proponen** para evaluación del usuario final, que deberá confirmar necesidad, alcance y prioridad. La estimación WBS/PERT no implica aprobación contractual, financiera ni de ejecución. Los cambios directos de sistemas satélite no integran el esfuerzo incremental EJE. Las obligaciones SDO y brechas se atienden sin duplicar horas de desarrollo.

**Conclusión:** la actualización presenta la clasificación institucional y la estimación incremental de las 318 solicitudes con trazabilidad individual y controles de conciliación, conservando el inventario documental público existente.
