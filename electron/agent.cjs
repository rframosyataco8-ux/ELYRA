/**
 * ELYRA Agent — más inteligente, con fallback de modelos ante rate limit de Groq.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_GROQ_KEY = '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';
const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';

// Cadena de modelos: si uno da 429 (límite), prueba el siguiente
const MODEL_CHAIN = [
  'llama-3.1-8b-instant',      // más cuota en plan gratis
  'llama-3.3-70b-versatile',   // más capaz, menos cuota
  'gemma2-9b-it',
  'llama-3.1-70b-versatile',
];

const SYSTEM_PROMPT = `Eres ELYRA, asistente inteligente de escritorio. Hablas español como una mujer joven profesional: natural, clara, cercana y competente. Nunca suenas a robot.

ESTILO DE RESPUESTA FINAL (se lee en voz alta):
- 2 a 5 frases, lenguaje cotidiano de persona real.
- Sin rutas Windows, sin barras invertidas, sin markdown, sin JSON, sin códigos de error.
- Si guardaste un archivo: "Lo guardé en tu carpeta de Informes, dentro de Documentos."
- Si falló algo: explícalo en una frase simple, sin detalles técnicos feos.

CAPACIDADES: investigar, crear reportes HTML y archivos, leer archivos, abrir apps/carpetas, comandos seguros, memoria, estado del PC, responder cualquier pregunta.

HERRAMIENTAS (formato exacto):

[TOOL: web_search]
query: texto
[/TOOL]

[TOOL: create_file]
path: Informes/nombre.txt
content: contenido
[/TOOL]

[TOOL: create_html_report]
path: Informes/reporte.html
title: título
body: html
[/TOOL]

[TOOL: create_folder]
path: Informes
[/TOOL]

[TOOL: open_app]
name: chrome | code | notepad | calculadora | spotify
[/TOOL]

[TOOL: open_folder]
name: documentos | descargas | escritorio | informes
[/TOOL]

[TOOL: open_url]
url: https://...
[/TOOL]

[TOOL: read_file]
path: archivo
[/TOOL]

[TOOL: list_dir]
path: carpeta
[/TOOL]

[TOOL: run_command]
command: cmd
[/TOOL]

[TOOL: remember]
text: dato
[/TOOL]

[TOOL: get_system_info]
[/TOOL]

Usa herramientas cuando haga falta. Respuesta final limpia para voz.`;

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
      model: MODEL_CHAIN[0],
    };
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf-8');
    return cfg;
  }
  // Actualizar modelo por defecto si tenían el 70b y se agota cuota
  try {
    const c = JSON.parse(fs.readFileSync(p, 'utf-8'));
    if (!c.model || c.model === 'llama-3.3-70b-versatile') {
      // No forzamos overwrite si el usuario eligió 70b a propósito;
      // el fallback en callLLM cubre el 429.
    }
  } catch {}
  return null;
}

function getConfig() {
  ensureDefaultConfig();
  try {
    const p = getConfigPath();
    if (fs.existsSync(p)) {
      const c = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return {
        apiKey: c.apiKey || process.env.ELYRA_API_KEY || process.env.GROQ_API_KEY || DEFAULT_GROQ_KEY,
        baseUrl: c.baseUrl || process.env.ELYRA_BASE_URL || DEFAULT_BASE_URL,
        model: c.model || process.env.ELYRA_MODEL || MODEL_CHAIN[0],
      };
    }
  } catch {}
  return {
    apiKey: process.env.ELYRA_API_KEY || process.env.GROQ_API_KEY || DEFAULT_GROQ_KEY,
    baseUrl: process.env.ELYRA_BASE_URL || DEFAULT_BASE_URL,
    model: process.env.ELYRA_MODEL || MODEL_CHAIN[0],
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

async function callLLMOnce(messages, config, model) {
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
      max_tokens: 4096,
    }),
  });

  const errText = !res.ok ? await res.text() : '';
  if (!res.ok) {
    const err = new Error(`LLM ${res.status}: ${errText.slice(0, 300)}`);
    err.status = res.status;
    err.body = errText;
    throw err;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/** Intenta varios modelos si hay rate limit (429) */
async function callLLM(messages, config) {
  if (!config.apiKey) throw new Error('NO_API_KEY');

  const preferred = config.model || MODEL_CHAIN[0];
  const chain = [preferred, ...MODEL_CHAIN.filter((m) => m !== preferred)];

  let lastErr = null;
  for (const model of chain) {
    try {
      return await callLLMOnce(messages, config, model);
    } catch (e) {
      lastErr = e;
      const isRate =
        e.status === 429 ||
        /rate limit|429|tokens per|TPD|TPM/i.test(String(e.message) + String(e.body || ''));
      if (isRate) {
        // siguiente modelo
        continue;
      }
      // otro error: no seguir probando todos
      throw e;
    }
  }

  throw lastErr || new Error('No hay modelos disponibles (límite de uso). Espera un minuto e inténtalo otra vez.');
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

function polishForSpeech(text) {
  if (!text) return text;
  let t = stripTools(text);
  if (/rate limit|429|tokens per/i.test(t)) {
    return 'Por ahora el servicio de inteligencia está un poco saturado. Espera medio minuto y vuelve a intentarlo.';
  }
  t = t.replace(/[A-Za-z]:\\[^\s\]"']+/g, 'Documentos');
  t = t.replace(/\\+/g, ' ');
  t = t.replace(/\*\*?/g, '');
  t = t.replace(/`+/g, '');
  t = t.replace(/\{[\s\S]*\}/g, '');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
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
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            },
          });
          const html = await res.text();
          const snippetRe = /class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td)>/gi;
          let sm;
          while ((sm = snippetRe.exec(html)) !== null && results.length < 6) {
            const t = sm[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            if (t.length > 30) results.push(t);
          }
        } catch (e) {
          results.push(`(Búsqueda: ${e.message})`);
        }
        try {
          for (const lang of ['es', 'en']) {
            const wikiUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`;
            const wr = await fetch(wikiUrl, { headers: { 'User-Agent': 'ELYRA/1.0' } });
            if (wr.ok) {
              const data = await wr.json();
              if (data.extract) {
                results.unshift(`Wikipedia: ${data.extract}`);
                break;
              }
            }
          }
        } catch {}
        if (!results.length) return { ok: true, result: `Sin resultados para: ${q}` };
        return {
          ok: true,
          result: `Sobre "${q}":\n${results.map((r, i) => `${i + 1}. ${r}`).join('\n')}`,
        };
      }

      case 'create_file': {
        const filePath = resolveUserPath(params.path || 'elyra-output.txt');
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, params.content || '', 'utf-8');
        return { ok: true, result: `Archivo creado: ${path.basename(filePath)} en Documentos` };
      }

      case 'create_html_report': {
        const filePath = resolveUserPath(params.path || 'Informes/reporte.html');
        const title = params.title || 'Reporte ELYRA';
        const body = params.body || '<p>Sin contenido</p>';
        const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/><title>${title.replace(/</g, '')}</title>
<style>
body{font-family:'Segoe UI',system-ui,sans-serif;max-width:900px;margin:48px auto;padding:0 28px 64px;color:#0f172a;line-height:1.7}
h1{color:#0284c7;border-bottom:3px solid #e0f2fe;padding-bottom:14px}
h2{color:#0369a1;margin-top:2em}.meta{color:#64748b;font-size:.9rem}
</style></head><body>
<h1>${title.replace(/</g, '')}</h1>
<p class="meta">Generado por ELYRA · ${new Date().toLocaleString('es-ES')}</p>
${body}
</body></html>`;
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const finalPath = filePath.toLowerCase().endsWith('.html') ? filePath : filePath + '.html';
        fs.writeFileSync(finalPath, html, 'utf-8');
        return { ok: true, result: `Reporte guardado: ${path.basename(finalPath)}` };
      }

      case 'create_folder': {
        const folderPath = resolveUserPath(params.path || 'Informes');
        if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
        return { ok: true, result: `Carpeta lista: ${path.basename(folderPath)}` };
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
        if (!found) return { ok: false, result: `No existe: ${params.path}` };
        if (fs.statSync(found).size > 800_000) return { ok: false, result: 'Archivo muy grande' };
        return { ok: true, result: `Archivo ${path.basename(found)}:\n${fs.readFileSync(found, 'utf-8').slice(0, 20000)}` };
      }

      case 'list_dir': {
        let p = params.path || path.join(os.homedir(), 'Documents');
        if (!path.isAbsolute(p)) p = resolveUserPath(p);
        if (!fs.existsSync(p)) return { ok: false, result: 'No existe la carpeta' };
        const items = fs.readdirSync(p, { withFileTypes: true }).slice(0, 80);
        return {
          ok: true,
          result: items.map((d) => `${d.isDirectory() ? '[DIR]' : '[FILE]'} ${d.name}`).join('\n'),
        };
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
            result: `CPU ${s.cpu} por ciento, memoria ${s.ram} por ciento, disco ${s.disk} por ciento.`,
          };
        }
        return { ok: true, result: `Equipo ${os.hostname()}.` };
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
    let reply;
    try {
      reply = await callLLM(messages, config);
    } catch (e) {
      const msg = String(e.message || e);
      if (/429|rate limit/i.test(msg)) {
        return {
          response:
            'El servicio de inteligencia alcanzó su límite por unos minutos. Espera un poco y vuelve a preguntarme.',
          iterations,
        };
      }
      return {
        response: 'No pude conectar con la inteligencia en este momento. Revisa tu internet e inténtalo de nuevo.',
        iterations,
      };
    }

    const tools = parseTools(reply);
    if (tools.length === 0) {
      finalText = polishForSpeech(reply);
      break;
    }

    const results = [];
    for (const t of tools) {
      results.push({ tool: t.name, ...(await executeTool(t, helpers)) });
    }

    messages.push({ role: 'assistant', content: reply });
    messages.push({
      role: 'user',
      content:
        'Resultados:\n' +
        results.map((r) => `• ${r.tool}: ${r.ok ? 'OK' : 'ERROR'} — ${r.result}`).join('\n') +
        '\n\nRespuesta FINAL: español natural, 2 a 5 frases, sin rutas, sin markdown, sin TOOL.',
    });
  }

  if (!finalText) {
    const last = messages.filter((m) => m.role === 'assistant').pop();
    finalText = last ? polishForSpeech(last.content) : 'Listo.';
  }

  return { response: finalText, iterations };
}

function fallbackResponse() {
  return {
    response: 'No pude conectar con el modelo. Revisa la conexión a internet.',
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
  MODEL_CHAIN,
};
