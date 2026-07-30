/** Schemas extra FS skills */
module.exports = [
  {
    type: 'function',
    function: {
      name: 'find_files',
      description: 'Busca archivos por extensión y/o nombre en Documentos, Descargas, Escritorio.',
      parameters: {
        type: 'object',
        properties: {
          root: { type: 'string', description: 'descargas|documentos|escritorio|ruta' },
          ext: { type: 'string', description: 'pdf,docx,xlsx...' },
          query: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'collect_files',
      description:
        'Skill multi-paso: encuentra archivos por extensión, los copia a Informes y genera resumen.',
      parameters: {
        type: 'object',
        properties: {
          root: { type: 'string' },
          ext: { type: 'string' },
          dest: { type: 'string' },
          query: { type: 'string' },
        },
        required: ['ext'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'copy_file',
      description: 'Copia un archivo a una carpeta del usuario.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          dest: { type: 'string' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mkdir',
      description: 'Crea carpeta bajo el perfil del usuario.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    },
  },
];
