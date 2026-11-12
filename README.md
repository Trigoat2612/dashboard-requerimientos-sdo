# Dashboard de Requerimientos SDO | EJE No Penal

Dashboard responsive desarrollado en Vite + React + API Serverless, base de datos en Neon PostgreSQL.

**Destino oficial**
- GitHub: https://github.com/Trigoat2612/dashboard-requerimientos-sdo
- Neon: proyecto `seguimientopejenp`, base PostgreSQL `neondb`, esquema `ejenp_requerimientos_sdo`.
- Vercel: proyecto independiente para este repositorio.

## Módulos
1. Resumen ejecutivo de requisitos SDO, backlog y horas preliminares.
2. Requisitos funcionales y no funcionales (475 registros de la matriz SDO).
3. Los 68 candidatos seleccionados del backlog y la ficha de asociación con componente/SDO/brecha/observaciones/estado.
4. Bitácora documental con procedencia, estado de análisis y vínculos originales.
5. Evaluación comparativa de métodos de estimación y propuesta Softplan.

## Variables de servidor para Vercel
- `DATABASE_URL`: cadena PostgreSQL de la **base neondb del proyecto seguimientopejenp**, no del proyecto Neon anterior.
- `DASHBOARD_ACCESS_KEY`: secreto largo generado por el administrador. Solo en Vercel. No usar prefijo `VITE_`.

Las funciones `/api/data` y `/api/update` consultan exclusivamente `ejenp_requerimientos_sdo.*`.
Vercel: Framework Vite; raíz del repositorio; compilación `npm run build`; salida `dist`.
**Importante:** autenticar el acceso a la aplicación y restringir el despliegue para datos institucionales. El control de acceso actual es básico y no reemplaza autenticación individual con auditoría.

## Criterio de evaluación
Una mención documental no constituye conformidad funcional. Las horas iniciales son triaje paramétrico y no equivalen a conteo contractual IFPUG aprobado. Los resultados de cumplimiento deben sustentarse en documentación, pruebas y conformidad.
