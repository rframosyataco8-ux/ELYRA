/**
 * ELYRA Agent — LLM-powered intelligence with tool use.
 * Default provider: Groq (llama-3.3-70b-versatile)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

// Default Groq credentials (user-provided). Override via ~/.elyra/config.json or env.
const DEFAULT_GROQ_KEY = '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';
const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `Eres ELYRA, una asistente de escritorio extremadamente capaz, inteligente y proactiva. Hablas español de forma natural, clara y humana (nunca robótica ni excesivamente formal).

PERSONALIDAD:
- Amable, directa y eficiente.
- Explicas con claridad cuando hace falta.
- Si una tarea tiene varios pasos, los ejecutas todos con herramientas sin pedir permiso innecesario.
- Al final das un resumen corto de lo que hiciste (2-5 frases), ideal para leerse en voz alta.

CAPACIDADES (úsalas):
- Investigar en internet (web_search)
- Crear reportes HTML profesionales, archivos de texto, JSON, Markdown, CSV
- Leer y analizar archivos del PC
- Listar carpetas, crear carpetas
- Abrir aplicaciones, URLs y carpetas del sistema
- Ejecutar comandos seguros
- Guardar datos en memoria a largo plazo
- Responder cualquier pregunta de conocimiento general usando tu conocimiento + búsqueda si hace falta

REGLAS DE HERRAMIENTAS:
1. Cuando debas actuar en el PC o investigar, USA herramientas con este formato exacto:

[TOOL: nombre_herramienta]
parametro: valor
otro: valor
[/TOOL]

2. Puedes usar VARIAS herramientas en una sola respuesta.
3. Después de recibir resultados, continúa hasta completar la tarea y da la respuesta final SIN bloques TOOL.
4. Para reportes/artículos/análisis → usa create_html_report o create_file.
5. Si piden Word: genera un HTML profesional bien formateado (Word puede abrirlo) o un .md / .txt completo. Indica la ruta exacta donde quedó.
6. Si piden guardar en "Informes" u otra carpeta, respeta esa ruta.
7. Nunca digas que hiciste algo si la herramienta falló.
8. Para preguntas de conocimiento (¿quién inventó X?, historia, ciencia…) responde con tu conocimiento. Si necesitas datos actualizados, usa web_search.

HERRAMIENTAS:

[TOOL: web_search]
query: texto de búsqueda
[/TOOL]

[TOOL: create_file]
path: ruta (ej: Informes/articulo.md o C:/Users/.../archivo.txt)
content: contenido completo del archivo
[/TOOL]

[TOOL: create_html_report]
path: ruta del .html (ej: Informes/reporte-guerra.html)
title: título
body: HTML del cuerpo (puedes usar h2, p, ul, table, etc.)
[/TOOL]

[TOOL: create_folder]
path: ruta de la carpeta a crear
[/TOOL]

[TOOL: open_app]
name: nombre de la app (chrome, code, spotify, notepad, calculadora...)
[/TOOL]

[TOOL: open_folder]
name: documentos | descargas | escritorio | imagenes | musica | videos | informes | o ruta completa
[/TOOL]

[TOOL: open_url]
url: https://...
[/TOOL]

[TOOL: read_file]
path: ruta del archivo
[/TOOL]

[TOOL: list_dir]
path: ruta de la carpeta
[/TOOL]

[TOOL: run_command]
command: comando de terminal
[/TOOL]

[TOOL: remember]
text: dato a memorizar
[/TOOL]

[TOOL: get_system_info]
[/TOOL]

Responde siempre en español.`;

function getConfigPath() {
  return path.join(os.homedir(), '.elyra', 'config.json');
}

function ensureDefaultConfig() {
  const p = getConfigPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(p)) {
    const cfg = {
      apiKey: DEFAULT_GROQ_KEY,
      baseUrl: DEFAULT_BASE_URL,
      model: DEFAULT_MODEL,
    };
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf-8');
    return cfg;
  }
  return null;
}

function getConfig() {
  // Ensure config file exists with Groq defaults on first run
  ensureDefaultConfig();

  try {
    const p = getConfigPath();
    if (fs.existsSync(p)) {
      const c = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return {
        apiKey: c.apiKey || process.env.ELYRA_API_KEY || process.env.GROQ_API_KEY || DEFAULT_GROQ_KEY,
        baseUrl: c.baseUrl || process.env.ELYRA_BASE_URL || DEFAULT_BASE_URL,
        model: c.model || process.env.ELYRA_MODEL || DEFAULT_MODEL,
      };
    }
  } catch {}

  return {
    apiKey: process.env.ELYRA_API_KEY || process.env.GROQ_API_KEY || DEFAULT_GROQ_KEY,
    baseUrl: process.env.ELYRA_BASE_URL || DEFAULT_BASE_URL,
    model: process.env.ELYRA_MODEL || DEFAULT_MODEL,
  };
}

function saveConfig(partial) {
  const dir = path.join(os.homedir(), '.elyra');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const current = getConfig();
  const next = { ...current, ...partial };
  fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

function resolveUserPath(filePath) {
  if (!filePath) return path.join(os.homedir(), 'Documents', 'elyra-output.txt');
  if (path.isAbsolute(filePath)) return filePath;

  const docs = path.join(os.homedir(), 'Documents');
  const normalized = filePath.replace(/\\/g, '/');

  if (/^informes\//i.test(normalized)) {
    const informes = path.join(docs, 'Informes');
    if (!fs.existsSync(informes)) fs.mkdirSync(informes, { recursive: true });
    return path.join(docs, normalized);
  }

  return path.join(docs, filePath);
}

async function callLLM(messages, config) {
  if (!config.apiKey) {
    throw new Error('NO_API_KEY');
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
      temperature: 0.65,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM ${res.status}: ${errText.slice(0, 400)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function parseTools(text) {
  const tools = [];
  const re = /\[TOOL:\s*([\w_]+)\]([\s\S]*?)\[\/TOOL\]/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1].trim().toLowerCase();
    const body = m[2].trim();
    const params = {};
    const lines = body.split('\n');
    let currentKey = null;
    let currentVal = [];
    for (const line of lines) {
      const km = line.match(/^([\w_]+):\s*(.*)$/);
      if (km && !line.startsWith(' ')) {
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
  return text
    .replace(/\[TOOL:\s*[\w_]+\][\s\S]*?\[\/TOOL\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function executeTool(tool, helpers) {
  const { name, params } = tool;
  try {
    switch (name) {
      case 'web_search': {
        const q = params.query || '';
        if (!q) return { ok: false, result: 'Falta query' };

        const results = [];

        try {
          const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
          const res = await fetch(url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });
          const html = await res.text();
          const snippetRe = /class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td)>/gi;
          let sm;
          while ((sm = snippetRe.exec(html)) !== null && results.length < 6) {
            const t = sm[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            if (t.length > 30) results.push(t);
          }
          if (results.length < 3) {
            const titleRe = /class="result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
            while ((sm = titleRe.exec(html)) !== null && results.length < 6) {
              const t = sm[1].replace(/<[^>]+>/g, '').trim();
              if (t) results.push(t);
            }
          }
        } catch (e) {
          results.push(`(DuckDuckGo error: ${e.message})`);
        }

        try {
          for (const lang of ['es', 'en']) {
            const wikiUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`;
            const wr = await fetch(wikiUrl, {
              headers: { 'User-Agent': 'ELYRA/1.0' },
            });
            if (wr.ok) {
              const data = await wr.json();
              if (data.extract) {
                results.unshift(`Wikipedia (${lang}): ${data.extract}`);
                break;
              }
            }
          }
        } catch {}

        if (results.length === 0) {
          return {
            ok: true,
            result: `Sin snippets. Sugiere abrir: https://www.google.com/search?q=${encodeURIComponent(q)}`,
          };
        }
        return {
          ok: true,
          result: `Investigación sobre "${q}":\n\n${results.map((r, i) => `${i + 1}. ${r}`).join('\n\n')}`,
        };
      }

      case 'create_file': {
        const filePath = resolveUserPath(params.path || 'elyra-output.txt');
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, params.content || '', 'utf-8');
        return { ok: true, result: `Archivo creado: ${filePath}` };
      }

      case 'create_html_report': {
        const filePath = resolveUserPath(params.path || 'Informes/reporte.html');
        const title = params.title || 'Reporte ELYRA';
        const body = params.body || '<p>Sin contenido</p>';
        const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title.replace(/</g, '')}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 900px; margin: 48px auto; padding: 0 28px 64px; color: #0f172a; line-height: 1.7; background: #fff; }
    h1 { color: #0284c7; font-size: 1.85rem; border-bottom: 3px solid #e0f2fe; padding-bottom: 14px; margin-bottom: 8px; }
    h2 { color: #0369a1; margin-top: 2.2em; font-size: 1.35rem; }
    h3 { color: #0c4a6e; margin-top: 1.5em; }
    .meta { color: #64748b; font-size: 0.9rem; margin-bottom: 2rem; }
    p { margin: 0.85em 0; }
    ul, ol { margin: 0.8em 0; padding-left: 1.4em; }
    li { margin: 0.35em 0; }
    table { border-collapse: collapse; width: 100%; margin: 1.6rem 0; font-size: 0.95rem; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; }
    th { background: #f0f9ff; color: #0c4a6e; }
    blockquote { border-left: 4px solid #38bdf8; margin: 1.2em 0; padding: 0.4em 1em; background: #f8fafc; color: #334155; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    .footer { margin-top: 3.5rem; padding-top: 1.2rem; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 0.85rem; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>${title.replace(/</g, '')}</h1>
  <p class="meta">Generado por ELYRA · ${new Date().toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}</p>
  ${body}
  <div class="footer">Documento generado automáticamente por ELYRA — Asistente Inteligente</div>
</body>
</html>`;
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const finalPath = filePath.toLowerCase().endsWith('.html') ? filePath : filePath + '.html';
        fs.writeFileSync(finalPath, html, 'utf-8');
        return { ok: true, result: `Reporte HTML guardado en: ${finalPath}` };
      }

      case 'create_folder': {
        const folderPath = resolveUserPath(params.path || 'Informes');
        if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
        return { ok: true, result: `Carpeta lista: ${folderPath}` };
      }

      case 'open_app':
        return await helpers.openApp(params.name || '');

      case 'open_folder':
        return await helpers.openFolder(params.name || '');

      case 'open_url':
        return await helpers.openUrl(params.url || '');

      case 'read_file': {
        let p = params.path;
        if (!p) return { ok: false, result: 'Falta path' };
        if (!path.isAbsolute(p)) p = resolveUserPath(p);
        const candidates = [
          p,
          path.join(os.homedir(), 'Documents', params.path),
          path.join(os.homedir(), 'Downloads', params.path),
          path.join(os.homedir(), 'Desktop', params.path),
        ];
        let found = null;
        for (const c of candidates) {
          if (c && fs.existsSync(c) && fs.statSync(c).isFile()) {
            found = c;
            break;
          }
        }
        if (!found) return { ok: false, result: `No existe el archivo: ${params.path}` };
        const stat = fs.statSync(found);
        if (stat.size > 800_000) {
          return { ok: false, result: `Archivo muy grande (${Math.round(stat.size / 1024)} KB). Máximo ~800 KB.` };
        }
        const content = fs.readFileSync(found, 'utf-8');
        return { ok: true, result: `Archivo: ${found}\n\n${content.slice(0, 20000)}` };
      }

      case 'list_dir': {
        let p = params.path || path.join(os.homedir(), 'Documents');
        if (!path.isAbsolute(p)) p = resolveUserPath(p);
        if (!fs.existsSync(p)) return { ok: false, result: `No existe: ${p}` };
        const items = fs.readdirSync(p, { withFileTypes: true }).slice(0, 80);
        const listing = items
          .map((d) => `${d.isDirectory() ? '[DIR]' : '[FILE]'} ${d.name}`)
          .join('\n');
        return { ok: true, result: `Contenido de ${p}:\n${listing}` };
      }

      case 'run_command':
        return await helpers.runCommand(params.command || '');

      case 'remember':
        return await helpers.remember(params.text || '');

      case 'get_system_info': {
        if (helpers.getSystemStats) {
          const s = await helpers.getSystemStats();
          return {
            ok: true,
            result: `CPU: ${s.cpu}% | RAM: ${s.ram}% (${s.freeMemGB}/${s.totalMemGB} GB) | Disco: ${s.disk}% | Host: ${s.hostname} | SO: ${s.platform}`,
          };
        }
        return {
          ok: true,
          result: `Host: ${os.hostname()} | Plataforma: ${process.platform} | Arch: ${os.arch()} | RAM libre: ${(os.freemem() / 1e9).toFixed(1)} GB`,
        };
      }

      default:
        return { ok: false, result: `Herramienta desconocida: ${name}` };
    }
  } catch (e) {
    return { ok: false, result: e.message };
  }
}

async function runAgent(userMessage, history, helpers) {
  const config = getConfig();
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-14).map((h) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.text,
    })),
    { role: 'user', content: userMessage },
  ];

  let finalText = '';
  let iterations = 0;
  const maxIter = 8;

  while (iterations < maxIter) {
    iterations++;
    const reply = await callLLM(messages, config);
    const tools = parseTools(reply);

    if (tools.length === 0) {
      finalText = stripTools(reply) || reply;
      break;
    }

    const results = [];
    for (const t of tools) {
      const r = await executeTool(t, helpers);
      results.push({ tool: t.name, ...r });
    }

    messages.push({ role: 'assistant', content: reply });
    messages.push({
      role: 'user',
      content:
        'Resultados de herramientas:\n' +
        results.map((r) => `• ${r.tool}: ${r.ok ? '✓' : '✗'} ${r.result}`).join('\n') +
        '\n\nSi la tarea está completa, responde al usuario en español de forma natural y concisa (sin bloques TOOL). Si falta algo, usa más herramientas.',
    });
  }

  if (!finalText) {
    const last = messages.filter((m) => m.role === 'assistant').pop();
    finalText = last ? stripTools(last.content) : 'He completado las acciones posibles.';
  }

  return { response: finalText, iterations };
}

function fallbackResponse(_input) {
  return {
    response:
      'No pude conectar con el modelo de lenguaje. Revisa tu conexión a internet o la API key de Groq en ~/.elyra/config.json',
    intelligent: false,
  };
}

module.exports = {
  runAgent,
  getConfig,
  saveConfig,
  fallbackResponse,
  callLLM,
  getConfigPath,
  ensureDefaultConfig,
};
