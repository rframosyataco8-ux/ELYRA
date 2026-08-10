/** Schemas de visión ELYRA 0.8 */
module.exports = [
  {
    type: 'function',
    function: {
      name: 'analyze_image',
      description:
        'Analiza una imagen local (PNG/JPG/WEBP) con un modelo multimodal. Indica path del archivo y opcionalmente prompt.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Ruta o nombre del archivo de imagen' },
          prompt: { type: 'string', description: 'Qué quieres saber de la imagen' },
          detail: { type: 'string', description: 'auto|high' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_screenshot',
      description: 'Toma o usa una captura de pantalla y la describe con visión multimodal.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
        },
      },
    },
  },
];
