/**
 * ELYRA Tool Schemas — Function Calling (OpenAI-compatible)
 * Fuente única de verdad para el agente autónomo.
 * No depende de React/UI.
 */

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Busca información actualizada en internet (Wikipedia/web). Usa para preguntas de conocimiento.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Consulta de búsqueda en español o inglés' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_file',
      description:
        'Crea o sobrescribe un archivo de texto en Documentos del usuario. Rutas relativas van a Documents/. Usa Informes/nombre.txt para reportes.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Ruta relativa (ej: Informes/resumen.txt) o absoluta',
          },
          content: { type: 'string', description: 'Contenido completo del archivo' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_html_report',
      description: 'Genera un informe HTML legible en Documentos/Informes/. Ideal para resúmenes largos.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Ej: Informes/guerra-mundial.html' },
          title: { type: 'string' },
          body: { type: 'string', description: 'HTML del cuerpo (párrafos, listas)' },
        },
        required: ['path', 'title', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Lee el contenido de un archivo de texto del usuario.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Ruta relativa a Documents o absoluta' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'Lista archivos y carpetas de un directorio.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Por defecto Documents' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Busca archivos por nombre en Documentos (o root indicado).',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          root: { type: 'string', description: 'Carpeta raíz opcional' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_app',
      description: 'Abre una aplicación del PC (Word, Chrome, Spotify, etc.). Si falla, el sistema puede abrir la web.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre de la app: word, excel, chrome, spotify…' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_folder',
      description: 'Abre una carpeta del usuario (documentos, descargas, escritorio, informes…).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_url',
      description: 'Abre una URL en el navegador predeterminado.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Ejecuta un comando de shell seguro (no destructivo). Evitar format, del /s, shutdown.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remember',
      description: 'Guarda un dato en la memoria local de ELYRA para futuras sesiones.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recall',
      description: 'Recupera notas y hechos guardados en memoria local.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_system_info',
      description: 'CPU, RAM y disco del equipo.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'battery',
      description: 'Estado de la batería.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'network_info',
      description: 'Adaptadores de red e IPs.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'disk_space',
      description: 'Espacio libre en discos.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'uptime',
      description: 'Tiempo desde el último arranque.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'volume',
      description: 'Control de volumen del sistema.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['up', 'down', 'mute', 'set'] },
          value: { type: 'string', description: 'Porcentaje 0-100 si action=set' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'media',
      description: 'Control multimedia (play/pause, siguiente, anterior).',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['play', 'pause', 'next', 'prev', 'stop'] },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'brightness',
      description: 'Brillo de pantalla (portátiles).',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['up', 'down', 'set'] },
          value: { type: 'string' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clipboard',
      description: 'Leer, escribir o limpiar el portapapeles.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['read', 'write', 'clear'] },
          text: { type: 'string' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'screenshot',
      description: 'Captura de pantalla a Documentos/Informes/Capturas.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_processes',
      description: 'Lista procesos que más RAM usan.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'kill_process',
      description: 'Cierra un proceso por nombre (no críticos del sistema).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'windows',
      description: 'Acciones de ventana: minimizar todo, bloquear, apagar pantalla.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['minimize_all', 'lock', 'screen_off'] },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notify',
      description: 'Muestra una notificación o mensaje al usuario.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_settings',
      description: 'Abre ajustes de Windows (wifi, display, sound, etc.).',
      parameters: {
        type: 'object',
        properties: {
          page: {
            type: 'string',
            description: 'system|display|sound|wifi|bluetooth|privacy|apps|update|power',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'empty_recycle',
      description: 'Vacía la papelera de reciclaje.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'power',
      description: 'Apagar, reiniciar, suspender o cancelar apagado programado.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['shutdown', 'restart', 'sleep', 'cancel'] },
          minutes: { type: 'string', description: 'Minutos de gracia opcionales' },
        },
        required: ['action'],
      },
    },
  },
];

/** Resumen compacto para system prompt (texto) */
function toolsPromptSummary() {
  return TOOL_DEFINITIONS.map((t) => {
    const f = t.function;
    const keys = Object.keys(f.parameters?.properties || {});
    return f.name + (keys.length ? ' (' + keys.join(', ') + ')' : '');
  }).join('\n');
}

module.exports = {
  TOOL_DEFINITIONS,
  toolsPromptSummary,
};
