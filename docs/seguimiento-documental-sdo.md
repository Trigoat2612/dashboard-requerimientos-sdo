# Seguimiento documental SDO: 83 productos

## Estado del módulo (19/11/2026)
- Rama: `feature/sdo-seguimiento-83-sync`, PR #2 en borrador. No fusionar antes del QA HTTP.
- Fuente maestra: [Catalogo_83](https://docs.google.com/spreadsheets/d/1VG0Hawz_HZKPBdDAwPuznagJ47MTaFJwJjNTqOAFRww/edit), 83 IDs SDO únicos.
- Primera carga verificada en Neon: 83 registros, 35 URLs en la columna Y, 48 sin propuesta. No es conformidad.
- Esquema existente: `ejenp_requerimientos_sdo`. La migración `sql/20261119_sdo_tracking.sql` se aplicó en la rama productiva `br-shy-dawn-b5or7hgh` sin alterar tablas antiguas.
- La cuenta Vercel conectada no encuentra el proyecto histórico; despliegue Preview/Producción aún no verificado.

## Arquitectura y separación
**Google Sheets Catalogo_83 (A:Z) → lectura autenticada de servicio → API serverless → espejo e historial Neon → GET público → React.**
- `sdo_document_catalog_83`: un registro por código, 26 valores originales en `snapshot.raw_cells`; W/X/Y/Z nunca se calculan mediante IA o heurística para grabar en la hoja.
- `sdo_document_changes_83`: instantáneas anterior/nueva y campos modificados por versión. No se sobreescriben registros de historial.
- `sdo_document_sync_runs_83`: aciertos y fallos, y último corte válido disponible para consulta incluso si Google no responde.
- No se escribe en la hoja maestra desde la web. La sincronización es **unidireccional, de solo lectura en Google Sheets**.
- Se mantienen independientes los universos de 511 requisitos, 318 solicitudes, 122 propuestas incrementales y 83 productos.
- No se crean proyectos ni esquemas Neon adicionales.

## Endpoints
- `GET /api/sdo-documents`: lectura pública de catálogo, códigos, enlaces, categorías QA, resumen por fase calculable, evolución y control de sincronización. No devuelve la instantánea completa ni W/X como texto.
- `GET /api/sdo-document-detail?code=4.2.1`: datos de la ficha y versiones con bearer Google OIDC autorizado.
- `GET /api/sdo-sync`: ejecución por Vercel Cron, exigiendo `CRON_SECRET`.
- `POST /api/sdo-sync`: sincronización de operador autenticado cuyo correo figure además en `INSTITUTIONAL_SYNC_EMAILS`.
- En fallo de lectura Sheets, no se eliminan ni reemplazan los 83 registros previos.

## Variables de entorno (nombres únicamente)
- `DATABASE_URL`: la base `neondb` del proyecto Neon existente.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`: cuenta de servicio con permisos **de lectura** en la matriz; habilitar Google Sheets API y compartir la matriz con dicho correo.
- `GOOGLE_SHEET_ID`: opcional, ID de la matriz maestra; el ID conocido está fijado como identificador de recurso, no como credencial.
- `CRON_SECRET`: secreto de invocación del cron HTTP de Vercel.
- `GOOGLE_OIDC_CLIENT_ID`, `INSTITUTIONAL_ALLOWED_EMAILS`: autenticación institucional individual existente.
- `INSTITUTIONAL_SYNC_EMAILS`: subconjunto expresamente autorizado a sincronizar.

Configurar las variables directamente en el proyecto Vercel bajo la cuenta correcta. **No enviarlas por chat ni subirlas al repositorio.** El archivo `vercel.json` declara sincronización cada hora; confirmar compatibilidad de la frecuencia con el plan del equipo. La interfaz consulta el último corte cada dos minutos.

## Distinciones técnicas
- **Propuesta:** existe URL válida en Y; no acredita sustitución del original.
- **Opinión técnica:** W posee un registro sustantivo o documento de opinión, no el texto `PENDIENTE_CONCILIACION_DE_PAQUETE`.
- **QA observado:** declaración explícita de observación.
- **QA conforme delta:** se limita a cambios revisados, nunca es conformidad integral.
- **QA conforme integral:** solamente cuando se documenta explícitamente.
- **Original identificado:** existe una referencia de archivo/link en el registro A02; el enlace puede derivarse de un ID citado, pero debe validarse su correspondencia y sus permisos antes de concluir conformidad documental.
- **Integrado en original:** sólo una declaración expresa, sin pendiente de integración.
- **Última modificación visible:** es la última variación capturada por el espejo, no un timestamp nativo de edición de cada celda de Google Sheets.
- **Agentes:** no se publican ejecuciones A00/A01/A02/G1/A09/A10/A11 si no existe evidencia técnica accesible.

## Regresión / despliegue
1. Ejecutar `npm test` y `npm run build`, además de las pruebas de consistencia con Neon.
2. Verificar en Preview los endpoints públicos y las rutas institucionales (401/403 al no tener sesión), el corte de 83, los 35/48 y la conservación de 511/318/122.
3. Verificar `/api/sdo-sync` con una cuenta de servicio funcional y permisos de acceso a la hoja, repetirla y comprobar que el segundo upsert sea idempotente (0 cambios).
4. Modificar una celda de ensayo en la matriz solamente con coordinación explícita; restaurarla y comprobar el historial. No utilizar W/X/Y/Z para ensayos.
5. Con Preview correcto y acceso al proyecto Vercel correcto, promover a producción y comprobar dominio y endpoints. No afirmar publicación hasta hacerlo.

### Bloqueador operativo
En el equipo Vercel conectado (`miguel-trigosos-projects`) el listado de proyectos y despliegues está vacío; el proyecto `dashboard-requerimientos-sdo` devuelve 404. Se necesita seleccionar/conectar la cuenta o equipo que posee el despliegue histórico. **No crear un segundo proyecto ni asignar el dominio histórico hasta confirmar titularidad.**
