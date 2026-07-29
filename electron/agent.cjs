/**
 * ELYRA Agent — LLM-powered intelligence with tool use.
 * Supports OpenAI-compatible APIs (OpenAI, Groq, Together, Ollama, xAI Grok, etc.)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const SYSTEM_PROMPT = `Eres ELYRA, una asistente inteligente de escritorio en español. Eres útil, clara, natural y proactiva.

REGLAS:
- Responde SIEMPRE en español, de forma conversacional y humana (no robótica).
- Si te piden crear archivos, documentos, reportes o hacer búsquedas, USA LAS HERRAMIENTAS disponibles.
- Si te piden abrir apps, carpetas o URLs, USA LAS HERRAMIENTAS.
- Puedes encadenar varias herramientas para completar tareas complejas.
- Sé concisa en la respuesta final hablada (2-4 frases máximo cuando sea posible), pero completa el trabajo con las herramientas.
- Si no puedes hacer algo, explícalo con honestidad y ofrece alternativas.
- Nunca inventes que hiciste algo si la herramienta falló.

HERRAMIENTAS DISPONIBLES (usa el formato exacto):

[TOOL: web_search]
query: texto a buscar
[/TOOL]

[TOOL: create_file]
path: ruta completa o relativa (ej: C:/Users/.../Documentos/informe.html o informes/reporte.docx)
content: contenido del archivo
[/TOOL]

[TOOL: create_html_report]
path: ruta donde guardar el .html
title: título del reporte
body: contenido HTML del cuerpo (puedes usar etiquetas HTML)
[/TOOL]

[TOOL: open_app]
name: nombre de la aplicación
[/TOOL]

[TOOL: open_folder]
name: documentos | descargas | escritorio | imagenes | musica | videos | o ruta completa
[/TOOL]

[TOOL: open_url]
url: https://...
[/TOOL]

[TOOL: read_file]
path: ruta del archivo a leer
[/TOOL]

[TOOL: list_dir]
path: ruta de la carpeta
[/TOOL]

[TOOL: run_command]
command: comando de terminal (seguro)
[/TOOL]

[TOOL: remember]
text: dato a guardar en memoria
[/TOOL]

Cuando necesites una herramienta, escribe el bloque [TOOL:...] completo. Puedes usar varias. Después de los resultados de herramientas recibirás el resultado y continuarás hasta dar la respuesta final al usuario.`;

function getConfig() {
  const configPath = path.join(os.homedir(), '.elyra', 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch {}
  return {
    apiKey: process.env.ELYRA_API_KEY || process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.ELYRA_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.ELYRA_MODEL || 'gpt-4o-mini',
  };
}

function saveConfig(partial) {
  const dir = path.join(os.homedir(), '.elyra');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const current = getConfig();
  const next = { ...current, ...partial };
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(next, null, 2));
  return next;
}

async function callLLM(messages, config) {
  if (!config.apiKey) {
    throw new Error(
      'No hay API key configurada. Configura ELYRA_API_KEY o crea ~/.elyra/config.json con { "apiKey": "tu-key", "baseUrl": "https://api.openai.com/v1", "model": "gpt-4o-mini" }',
    );
  }

  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function parseTools(text) {
  const tools = [];
  const re = /\[TOOL:\s*(\w+)\]([\s\S]*?)\[\/TOOL\]/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1].trim().toLowerCase();
    const body = m[2].trim();
    const params = {};
    // Parse key: value lines (value can be multiline until next key or end)
    const lines = body.split('\n');
    let currentKey = null;
    let currentVal = [];
    for (const line of lines) {
      const km = line.match(/^(\w+):\s*(.*)$/);
      if (km) {
        if (currentKey) params[currentKey] = currentVal.join('\n').trim();
        currentKey = km[1].toLowerCase();
        currentVal = [km[2]];
      } else if (currentKey) {
        currentVal.push(line);
      }
    }
    if (currentKey) params[currentKey] = currentVal.join('\n').trim();
    tools.push({ name, params });
  }
  return tools;
}

function stripTools(text) {
  return text.replace(/\[TOOL:\s*\w+\][\s\S]*?\[\/TOOL\]/gi, '').trim();
}

async function executeTool(tool, helpers) {
  const { name, params } = tool;
  try {
    switch (name) {
      case 'web_search': {
        const q = params.query || '';
        // Use DuckDuckGo instant answer / HTML scrape light, or just open Google
        // For real results without extra API, we return a search URL and summary hint
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
        try {
          const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ELYRA/1.0' },
          });
          const html = await res.text();
          // Extract snippet-like text
          const snippets = [];
          const re = /class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
          let sm;
          while ((sm = re.exec(html)) !== null && snippets.length < 5) {
            const t = sm[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            if (t.length > 20) snippets.push(t);
          }
          if (snippets.length === 0) {
            // fallback titles
            const re2 = /class="result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
            while ((sm = re2.exec(html)) !== null && snippets.length < 5) {
              const t = sm[1].replace(/<[^>]+>/g, '').trim();
              if (t) snippets.push(t);
            }
          }
          return {
            ok: true,
            result: snippets.length
              ? `Resultados sobre "${q}":\n${snippets.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
              : `No extraje snippets. Puedes abrir: https://www.google.com/search?q=${encodeURIComponent(q)}`,
          };
        } catch (e) {
          return { ok: false, result: `Error de búsqueda: ${e.message}` };
        }
      }

      case 'create_file': {
        let filePath = params.path || 'elyra-output.txt';
        // Expand relative to Documents/Informes or home
        if (!path.isAbsolute(filePath)) {
          const docs = path.join(os.homedir(), 'Documents');
          const informes = path.join(docs, 'Informes');
          if (filePath.toLowerCase().startsWith('informes/') || filePath.toLowerCase().startsWith('informes\\')) {
            if (!fs.existsSync(informes)) fs.mkdirSync(informes, { recursive: true });
            filePath = path.join(docs, filePath);
          } else {
            filePath = path.join(docs, filePath);
          }
        }
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, params.content || '', 'utf-8');
        return { ok: true, result: `Archivo creado: ${filePath}` };
      }

      case 'create_html_report': {
        let filePath = params.path || 'reporte.html';
        if (!path.isAbsolute(filePath)) {
          const docs = path.join(os.homedir(), 'Documents');
          const informes = path.join(docs, 'Informes');
          if (!fs.existsSync(informes)) fs.mkdirSync(informes, { recursive: true });
          if (!filePath.toLowerCase().includes('informes')) {
            filePath = path.join(informes, path.basename(filePath));
          } else {
            filePath = path.join(docs, filePath);
          }
        }
        const title = params.title || 'Reporte ELYRA';
        const body = params.body || '';
        const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 860px; margin: 40px auto; padding: 0 24px; color: #1a1a2e; line-height: 1.6; }
    h1 { color: #0ea5e9; border-bottom: 2px solid #e0f2fe; padding-bottom: 12px; }
    h2 { color: #0369a1; margin-top: 2em; }
    .meta { color: #64748b; font-size: 0.9rem; margin-bottom: 2rem; }
    table { border-collapse: collapse; width: 100%; margin: 1.5rem 0; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; }
    th { background: #f0f9ff; }
    .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 0.85rem; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="meta">Generado por ELYRA · ${new Date().toLocaleString('es-ES')}</p>
  ${body}
  <div class="footer">Documento generado automáticamente por ELYRA</div>
</body>
</html>`;
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, html, 'utf-8');
        return { ok: true, result: `Reporte HTML guardado en: ${filePath}` };
      }

      case 'open_app':
        return await helpers.openApp(params.name || '');

      case 'open_folder':
        return await helpers.openFolder(params.name || '');

      case 'open_url':
        return await helpers.openUrl(params.url || '');

      case 'read_file': {
        const p = params.path;
        if (!p || !fs.existsSync(p)) return { ok: false, result: `No existe: ${p}` };
        const stat = fs.statSync(p);
        if (stat.size > 500_000) return { ok: false, result: 'Archivo demasiado grande (>500KB)' };
        const content = fs.readFileSync(p, 'utf-8');
        return { ok: true, result: content.slice(0, 15000) };
      }

      case 'list_dir': {
        const p = params.path || os.homedir();
        if (!fs.existsSync(p)) return { ok: false, result: `No existe: ${p}` };
        const items = fs.readdirSync(p).slice(0, 50);
        return { ok: true, result: items.join('\n') };
      }

      case 'run_command': {
        return await helpers.runCommand(params.command || '');
      }

      case 'remember': {
        return await helpers.remember(params.text || '');
      }

      default:
        return { ok: false, result: `Herramienta desconocida: ${name}` };
    }
  } catch (e) {
    return { ok: false, result: e.message };
  }
}

/**
 * Main agent loop: understand → tools → answer
 */
async function runAgent(userMessage, history, helpers) {
  const config = getConfig();
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-12).map((h) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.text,
    })),
    { role: 'user', content: userMessage },
  ];

  let finalText = '';
  let iterations = 0;
  const maxIter = 6;

  while (iterations < maxIter) {
    iterations++;
    const reply = await callLLM(messages, config);
    const tools = parseTools(reply);

    if (tools.length === 0) {
      finalText = stripTools(reply) || reply;
      break;
    }

    // Execute tools
    const results = [];
    for (const t of tools) {
      const r = await executeTool(t, helpers);
      results.push({ tool: t.name, ...r });
    }

    messages.push({ role: 'assistant', content: reply });
    messages.push({
      role: 'user',
      content:
        'Resultados de las herramientas:\n' +
        results.map((r) => `- ${r.tool}: ${r.ok ? 'OK' : 'ERROR'} → ${r.result}`).join('\n') +
        '\n\nContinúa. Si ya terminaste la tarea, da la respuesta final al usuario en español (sin bloques TOOL).',
    });

    // If last iteration, force final
    if (iterations === maxIter) {
      finalText = stripTools(reply) || 'He completado las acciones posibles.';
    }
  }

  if (!finalText) finalText = 'Listo.';
  return { response: finalText, iterations };
}

/**
 * Fallback when no API key: improved rule-based + honest message
 */
function fallbackResponse(input) {
  return {
    response:
      'Para entender cualquier pregunta y hacer tareas complejas (investigar, crear documentos, analizar archivos) necesito una API key de un modelo de lenguaje. ' +
      'Configúrala así:\n\n' +
      '1. Crea el archivo: ~/.elyra/config.json\n' +
      '2. Contenido ejemplo:\n' +
      '{ "apiKey": "sk-...", "baseUrl": "https://api.openai.com/v1", "model": "gpt-4o-mini" }\n\n' +
      'También sirve Groq, Together, OpenRouter, xAI o Ollama local. ' +
      'Mientras tanto puedo abrir apps, carpetas y recordar notas con comandos directos.',
  };
}

module.exports = { runAgent, getConfig, saveConfig, fallbackResponse, callLLM };
