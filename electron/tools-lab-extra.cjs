module.exports = [
  {
    type: 'function',
    function: {
      name: 'list_lab_templates',
      description: 'Lista plantillas de laboratorio disponibles (cadmio, AFQ, cacao).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lab_template',
      description:
        'Obtiene o escribe plantilla de informe de laboratorio. name: cadmio_resumen | afq_basico | cacao_lote. write=true genera Word en Informes/.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          write: { type: 'boolean' },
        },
        required: ['name'],
      },
    },
  },
];
