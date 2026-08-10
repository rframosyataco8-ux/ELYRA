/** Schemas OCR / visión extendida ELYRA 1.4 */
module.exports = [
  {
    type: 'function',
    function: {
      name: 'ocr_image',
      description:
        'Extrae texto de una imagen con OCR local (Tesseract). Ideal para fotos de documentos o capturas con texto.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          lang: { type: 'string', description: 'spa+eng por defecto' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ocr_pdf',
      description:
        'OCR sobre PDF escaneado (páginas como imagen). Usa si summarize_pdf no saca texto.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          max_pages: { type: 'string' },
          lang: { type: 'string' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'extract_pdf_smart',
      description:
        'Intenta texto nativo del PDF; si está vacío (escaneado), aplica OCR automáticamente.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          max_pages: { type: 'string' },
        },
        required: ['path'],
      },
    },
  },
];
