// Etiquetas descriptivas basadas en los productos de Catalogo_83.
// No reemplazan denominaciones contractuales de etapa o conformidades oficiales.
export const SDO_PHASES = Object.freeze({
  '1': { name: 'Inicio y preparación', description: 'Constitución y lanzamiento del proyecto, talleres iniciales, análisis de brechas y preparación de infraestructura.' },
  '2': { name: 'Planificación y gestión', description: 'Planes del proyecto, recursos, riesgos, cronograma, acuerdos de alcance, trazabilidad y control.' },
  '3': { name: 'Análisis y diseño', description: 'Análisis por especialidad, arquitectura, diseño del sistema, procesos BPMN y estrategias de continuidad.' },
  '4': { name: 'Desarrollo, pruebas y despliegue', description: 'Desarrollo y entrega de componentes, integraciones, parametrización, pruebas, migración, despliegue y actas de conformidad.' },
  '5': { name: 'Capacitación y gestión del cambio', description: 'Estrategias, planes, ejecución, informes de capacitación y gestión del cambio.' },
  '6': { name: 'Mantenimiento y soporte', description: 'Plan de mantenimiento y soporte del sistema.' },
  '7': { name: 'Aceptación y cierre', description: 'Aceptación operacional, informe de cierre, memoria del proyecto y acta de aceptación de cierre.' }
});

export function getSdoPhaseInfo(phase) {
  return SDO_PHASES[String(phase)] || {name:'Sin clasificación descriptiva',description:'No existe una descripción contrastada para esta fase.'};
}
