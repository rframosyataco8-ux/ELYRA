/**
 * ELYRA Agent — inteligencia + herramientas.
 * Personalidad calmada tipo JARVIS. Respuestas finales aptas para voz.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_GROQ_KEY = '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';
const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `Eres ELYRA, el asistente inteligente de escritorio del usuario. Tu estilo es como JARVIS de Iron Man: calmado, preciso, seguro, ligeramente formal pero natural. Hablas siempre en español.

PERSONALIDAD Y VOZ:
- Tranquilo, claro y competente. Nunca robótico ni exagerado.
- Frases cortas y naturales cuando resumas algo que se va a escuchar en voz alta.
- La RESPUESTA FINAL al usuario debe poder leerse en voz alta sin problemas:
  · NO incluyas rutas de Windows con barras invertidas (C:\\Users\\...).
  · Di en su lugar: "lo guardé en Documentos, carpeta Informes" o "archivo creado correctamente".
  · NO uses markdown, asteriscos, código ni listas con símbolos raros en la respuesta final.
  · 2 a 5 frases como máximo en el resumen final, salvo que pidan una explicación larga.
- Si ejecutas herramientas, no narras cada paso técnico: al final resume el resultado con naturalidad.

CAPACIDADES:
- Investigar (web_search), crear reportes HTML y archivos, leer/analizar archivos,
  abrir apps y carpetas, comandos seguros, memoria, estado del sistema,
  responder cualquier pregunta de conocimiento.

HERRAMIENTAS (formato exacto):

[TOOL: web_search]
query: texto
[/TOOL]

[TOOL: create_file]
path: Informes/nombre.txt
content: contenido completo
[/TOOL]

[TOOL: create_html_report]
path: Informes/reporte.html
title: título
body: html del cuerpo
[/TOOL]

[TOOL: create_folder]
path: Informes
[/TOOL]

[TOOL: open_app]
name: chrome | code | notepad | calculadora | spotify | ...
[/TOOL]

[TOOL: open_folder]
name: documentos | descargas | escritorio | informes | ...
[/TOOL]

[TOOL: open_url]
url: https://...
[/TOOL]

[TOOL: read_file]
path: nombre o ruta
[/TOOL]

[TOOL: list_dir]
path: carpeta
[/TOOL]

[TOOL: run_command]
command: comando
[/TOOL]

[TOOL: remember]
text: dato
[/TOOL]

[TOOL: get_system_info]
[/TOOL]

REGLAS:
1. Usa herramientas cuando haga falta actuar o investigar.
2. Puedes usar varias en una respuesta.
3. Tras resultados, termina con respuesta final SIN bloques TOOL, limpia para voz.
4. Nunca inventes que algo se hizo si la herramienta falló.
5. Conocimiento general: responde directo; busca solo si necesitas datos actuales.`;

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
  if (!config.apiKey) throw new Error('NO_API_KEY');
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
      temperature: 0.55,
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

/** Suaviza la respuesta final para voz (sin rutas Windows feas) */
function polishForSpeech(text) {
  if (!text) return text;
  let t = stripTools(text);
  t = t.replace(/[A-Za-z]:\\[^\s\]"']+/g, 'Documentos');
  t = t.replace(/\\+/g, ' ');
  t = t.replace(/\*\*?/g, '');
  t = t.replace(/`+/g, '');
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
        } catch (e) {
          results.push(`(Búsqueda error: ${e.message})`);
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
        if (!results.length) {
          return { ok: true, result: `Sin resultados directos para: ${q}` };
        }
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
        return { ok: true, result: `Archivo creado en Documentos: ${path.basename(filePath)}` };
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
h2{color:#0369a1;margin-top:2em}.meta{color:#64748b;font-size:.9rem;margin-bottom:2rem}
table{border-collapse:collapse;width:100%;margin:1.5rem 0}th,td{border:1px solid #cbd5e1;padding:10px 14px}th{background:#f0f9ff}
.footer{margin-top:3rem;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:.85rem;padding-top:1rem}
</style></head><body>
<h1>${title.replace(/</g, '')}</h1>
<p class="meta">Generado por ELYRA · ${new Date().toLocaleString('es-ES')}</p>
${body}
<div class="footer">ELYRA — Asistente Inteligente</div>
</body></html>`;
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const finalPath = filePath.toLowerCase().endsWith('.html') ? filePath : filePath + '.html';
        fs.writeFileSync(finalPath, html, 'utf-8');
        return { ok: true, result: `Reporte HTML guardado como ${path.basename(finalPath)} en Informes o Documentos` };
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
        if (!found) return { ok: false, result: `No existe el archivo: ${params.path}` };
        const stat = fs.statSync(found);
        if (stat.size > 800_000) return { ok: false, result: 'Archivo demasiado grande' };
        const content = fs.readFileSync(found, 'utf-8');
        return { ok: true, result: `Archivo ${path.basename(found)}:\n${content.slice(0, 20000)}` };
      }

      case 'list_dir': {
        let p = params.path || path.join(os.homedir(), 'Documents');
        if (!path.isAbsolute(p)) p = resolveUserPath(p);
        if (!fs.existsSync(p)) return { ok: false, result: `No existe la carpeta` };
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
            result: `CPU ${s.cpu} por ciento, RAM ${s.ram} por ciento, disco ${s.disk} por ciento.`,
          };
        }
        return { ok: true, result: `Equipo ${os.hostname()}, plataforma ${process.platform}.` };
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
      finalText = polishForSpeech(reply);
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
        'Resultados:\n' +
        results.map((r) => `• ${r.tool}: ${r.ok ? 'OK' : 'ERROR'} — ${r.result}`).join('\n') +
        '\n\nDa ahora la respuesta FINAL al usuario: español natural, estilo JARVIS, 2 a 5 frases, SIN rutas con barras invertidas, SIN markdown, SIN bloques TOOL.',
    });
  }

  if (!finalText) {
    const last = messages.filter((m) => m.role === 'assistant').pop();
    finalText = last ? polishForSpeech(last.content) : 'Listo. He completado lo posible.';
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
};
