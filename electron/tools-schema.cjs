/**
 * ELYRA Tool Schemas — Function Calling (OpenAI-compatible)
 */

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Busca información actualizada en internet.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scan_folder',
      description: 'Escanea Documentos (u otra carpeta) buscando Excel, PDF, Word, PPT, texto.',
      parameters: {
        type: 'object',
        properties: {
          root: { type: 'string' },
          pattern: { type: 'string', description: 'Filtro opcional en el nombre' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_excel',
      description: 'Analiza un CSV/Excel con pandas: columnas, stats, muestra. Opcional export ejecutivo.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          export: { type: 'boolean' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'summarize_pdf',
      description: 'Extrae texto de un PDF para analizarlo o resumirlo.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_docx',
      description: 'Lee un documento Word (.docx).',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_docx',
      description: 'Redacta un informe corporativo en Word (.docx) en Documentos/Informes.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string', description: 'Texto con párrafos; # y ## para títulos; - para viñetas' },
          path: { type: 'string' },
        },
        required: ['title', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_pptx',
      description: 'Crea una presentación PowerPoint ejecutiva.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          slides: {
            type: 'string',
            description: 'JSON array [{title, bullets: string[]}] o texto plano',
          },
          body: { type: 'string' },
          path: { type: 'string' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'html_dashboard',
      description: 'Genera un dashboard HTML ejecutivo en Informes/.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string', description: 'HTML interior' },
          path: { type: 'string' },
        },
        required: ['title', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_file',
      description: 'Crea archivo de texto en Documentos.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_html_report',
      description: 'Informe HTML simple en Informes/.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['path', 'title', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Lee archivo de texto.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'Lista directorio.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Busca archivos por nombre.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          root: { type: 'string' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_app',
      description: 'Abre aplicación del PC.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_folder',
      description: 'Abre carpeta del usuario.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_url',
      description: 'Abre URL en el navegador.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Comando shell no destructivo.',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string' } },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remember',
      description: 'Guarda preferencia o hecho en memoria a largo plazo.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          kind: { type: 'string', enum: ['preference', 'fact'] },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recall',
      description: 'Recupera memoria contextual.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_system_info',
      description: 'CPU RAM disco.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'battery',
      description: 'Batería.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'network_info',
      description: 'Red e IPs.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'disk_space',
      description: 'Espacio en disco.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'uptime',
      description: 'Uptime del sistema.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'volume',
      description: 'Volumen.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['up', 'down', 'mute', 'set'] },
          value: { type: 'string' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'media',
      description: 'Multimedia.',
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
      description: 'Brillo.',
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
      description: 'Portapapeles.',
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
      description: 'Captura de pantalla.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_processes',
      description: 'Procesos top RAM.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'kill_process',
      description: 'Cierra proceso.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'windows',
      description: 'minimize_all | lock | screen_off',
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
      description: 'Notificación al usuario.',
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
      description: 'Ajustes Windows.',
      parameters: {
        type: 'object',
        properties: { page: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'empty_recycle',
      description: 'Vaciar papelera.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'power',
      description: 'shutdown|restart|sleep|cancel',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['shutdown', 'restart', 'sleep', 'cancel'] },
          minutes: { type: 'string' },
        },
        required: ['action'],
      },
    },
  },
];

function toolsPromptSummary() {
  return TOOL_DEFINITIONS.map((t) => {
    const f = t.function;
    const keys = Object.keys(f.parameters?.properties || {});
    return f.name + (keys.length ? ' (' + keys.join(', ') + ')' : '');
  }).join('\n');
}

module.exports = { TOOL_DEFINITIONS, toolsPromptSummary };
