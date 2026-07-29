/**
 * ELYRA Agent — más rápido, honesto con errores de herramientas
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_GROQ_KEY = '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';
const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const MODEL_CHAIN = [
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
  'llama-3.3-70b-versatile',
];

const SYSTEM_PROMPT = `Eres ELYRA, asistente de escritorio. Español natural, cercano, breve.

RESPUESTA FINAL (voz): 1-3 frases, sin rutas Windows, sin markdown, sin JSON.
Si una herramienta falló (ERROR), dilo con claridad. Nunca digas que abriste algo si el resultado fue ERROR.

HERRAMIENTAS:
[TOOL: web_search]
query: texto
[/TOOL]

[TOOL: create_file]
path: Informes/archivo.txt
content: contenido
[/TOOL]

[TOOL: create_html_report]
path: Informes/reporte.html
title: título
body: html
[/TOOL]

[TOOL: append_file]
path: archivo
content: texto
[/TOOL]

[TOOL: delete_file]
path: archivo
[/TOOL]

[TOOL: create_folder]
path: nombre
[/TOOL]

[TOOL: open_app]
name: word | excel | chrome | notepad | calculadora | code | spotify
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

[TOOL: recall]
[/TOOL]

[TOOL: get_system_info]
[/TOOL]

[TOOL: write_desktop_note]
filename: nota.txt
content: texto
[/TOOL]

Para abrir apps usa open_app. Sé directa.`;

function getConfigPath() {
  return path.join(os.homedir(), '.elyra', 'config.json');
}
function ensureDefaultConfig() {
  const p = getConfigPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify({
      apiKey: DEFAULT_GROQ_KEY, baseUrl: DEFAULT_BASE_URL, model: MODEL_CHAIN[0],
    }, null, 2));
  }
}
function getConfig() {
  ensureDefaultConfig();
  try {
    const c = JSON.parse(fs.readFileSync(getConfigPath(), 'utf-8'));
    return {
      apiKey: c.apiKey || DEFAULT_GROQ_KEY,
      baseUrl: c.baseUrl || DEFAULT_BASE_URL,
      model: c.model || MODEL_CHAIN[0],
    };
  } catch {
    return { apiKey: DEFAULT_GROQ_KEY, baseUrl: DEFAULT_BASE_URL, model: MODEL_CHAIN[0] };
  }
}
function saveConfig(partial) {
  ensureDefaultConfig();
  const next = { ...getConfig(), ...partial };
  fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 2));
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
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.45, max_tokens: 2048 }),
  });
  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`LLM ${res.status}: ${errText.slice(0, 280)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callLLM(messages, config) {
  if (!config.apiKey) throw new Error('NO_API_KEY');
  const preferred = config.model || MODEL_CHAIN[0];
  const chain = [preferred, ...MODEL_CHAIN.filter((m) => m !== preferred)];
  let lastErr;
  for (const model of chain) {
    try {
      return await callLLMOnce(messages, config, model);
    } catch (e) {
      lastErr = e;
      if (e.status === 429 || /rate limit|429/i.test(String(e.message))) continue;
      throw e;
    }
  }
  throw lastErr || new Error('Límite de uso');
}

function parseTools(text) {
  const tools = [];
  const re = /\[TOOL:\s*([\w_]+)\]([\s\S]*?)\[\/TOOL\]/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1].trim().toLowerCase();
    const body = m[2].trim();
    const params = {};
    let currentKey = null;
    let currentVal = [];
    for (const line of body.split('\n')) {
      const km = line.match(/^([\w_]+):\s*(.*)$/);
      if (km && !line.startsWith(' ')) {
        if (currentKey) params[currentKey] = currentVal.join('\n').trim();
        currentKey = km[1].toLowerCase();
        currentVal = [km[2]];
      } else if (currentKey) currentVal.push(line);
    }
    if (currentKey) params[currentKey] = currentVal.join('\n').trim();
    tools.push({ name, params });
  }
  return tools;
}

function stripTools(text) {
  return text.replace(/\[TOOL:\s*[\w_]+\][\s\S]*?\[\/TOOL\]/gi, '').replace(/\n{3,}/g, '\n\n').trim();
}

function polishForSpeech(text) {
  if (!text) return '';
  let t = stripTools(text);
  if (/rate limit|429/i.test(t)) return 'El servicio está saturado un momento. Espera y lo intentamos otra vez.';
  t = t.replace(/[A-Za-z]:\\[^\s\]"']+/g, 'Documentos');
  t = t.replace(/\\+/g, ' ');
  t = t.replace(/\*\*?/g, '');
  t = t.replace(/`+/g, '');
  t = t.replace(/\{[\s\S]*\}/g, '');
  return t.replace(/\s+/g, ' ').trim();
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
          const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
          });
          const html = await res.text();
          const re = /class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td)>/gi;
          let sm;
          while ((sm = re.exec(html)) !== null && results.length < 5) {
            const t = sm[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            if (t.length > 30) results.push(t);
          }
        } catch (e) {
          results.push(`(Búsqueda: ${e.message})`);
        }
        try {
          const wr = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`, {
            headers: { 'User-Agent': 'ELYRA/2.0' },
          });
          if (wr.ok) {
            const data = await wr.json();
            if (data.extract) results.unshift(`Wikipedia: ${data.extract}`);
          }
        } catch {}
        if (!results.length) return { ok: true, result: `Sin resultados para: ${q}` };
        return { ok: true, result: results.map((r, i) => `${i + 1}. ${r}`).join('\n') };
      }
      case 'create_file': {
        const filePath = resolveUserPath(params.path || 'elyra-output.txt');
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, params.content || '', 'utf-8');
        return { ok: true, result: `Creado ${path.basename(filePath)}` };
      }
      case 'append_file': {
        const filePath = resolveUserPath(params.path || 'elyra-notes.txt');
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.appendFileSync(filePath, (params.content || '') + '\n', 'utf-8');
        return { ok: true, result: `Añadido a ${path.basename(filePath)}` };
      }
      case 'delete_file': {
        if (!params.path) return { ok: false, result: 'Falta path' };
        const resolved = path.resolve(resolveUserPath(params.path));
        if (!resolved.startsWith(path.resolve(os.homedir()))) {
          return { ok: false, result: 'Solo archivos de tu usuario' };
        }
        if (!fs.existsSync(resolved)) return { ok: false, result: 'No existe' };
        fs.unlinkSync(resolved);
        return { ok: true, result: `Eliminado ${path.basename(resolved)}` };
      }
      case 'create_html_report': {
        const filePath = resolveUserPath(params.path || 'Informes/reporte.html');
        const title = params.title || 'Reporte ELYRA';
        const body = params.body || '<p>Sin contenido</p>';
        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>${title.replace(/</g, '')}</title>
<style>body{font-family:Segoe UI,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;line-height:1.7}h1{color:#0284c7}</style></head>
<body><h1>${title.replace(/</g, '')}</h1><p>${new Date().toLocaleString('es-ES')}</p>${body}</body></html>`;
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const finalPath = filePath.toLowerCase().endsWith('.html') ? filePath : filePath + '.html';
        fs.writeFileSync(finalPath, html, 'utf-8');
        return { ok: true, result: `Reporte ${path.basename(finalPath)} listo` };
      }
      case 'create_folder': {
        const folderPath = resolveUserPath(params.path || 'Informes');
        fs.mkdirSync(folderPath, { recursive: true });
        return { ok: true, result: `Carpeta ${path.basename(folderPath)} lista` };
      }
      case 'write_desktop_note': {
        const p = path.join(os.homedir(), 'Desktop', path.basename(params.filename || `nota-${Date.now()}.txt`));
        fs.writeFileSync(p, params.content || '', 'utf-8');
        return { ok: true, result: `Nota en escritorio: ${path.basename(p)}` };
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
        const candidates = [p, path.join(os.homedir(), 'Documents', params.path), path.join(os.homedir(), 'Desktop', params.path)];
        const found = candidates.find((c) => c && fs.existsSync(c) && fs.statSync(c).isFile());
        if (!found) return { ok: false, result: `No existe ${params.path}` };
        if (fs.statSync(found).size > 800000) return { ok: false, result: 'Archivo muy grande' };
        return { ok: true, result: `${path.basename(found)}:\n${fs.readFileSync(found, 'utf-8').slice(0, 15000)}` };
      }
      case 'list_dir': {
        let p = params.path || path.join(os.homedir(), 'Documents');
        if (!path.isAbsolute(p)) p = resolveUserPath(p);
        if (!fs.existsSync(p)) return { ok: false, result: 'No existe' };
        const items = fs.readdirSync(p, { withFileTypes: true }).slice(0, 80);
        return { ok: true, result: items.map((d) => `${d.isDirectory() ? '[DIR]' : '[FILE]'} ${d.name}`).join('\n') };
      }
      case 'run_command':
        return await helpers.runCommand(params.command || '');
      case 'remember':
        return await helpers.remember(params.text || '');
      case 'recall':
        return helpers.recall ? await helpers.recall() : { ok: true, result: 'Sin notas' };
      case 'get_system_info': {
        if (helpers.getSystemStats) {
          const s = await helpers.getSystemStats();
          return { ok: true, result: `CPU ${s.cpu}%, RAM ${s.ram}%, disco ${s.disk}%.` };
        }
        return { ok: true, result: `Equipo ${os.hostname()}` };
      }
      default:
        return { ok: false, result: `Desconocida: ${name}` };
    }
  } catch (e) {
    return { ok: false, result: e.message };
  }
}

async function runAgent(userMessage, history, helpers) {
  const config = getConfig();
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-8).map((h) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.text,
    })),
    { role: 'user', content: userMessage },
  ];

  let finalText = '';
  let iterations = 0;
  const maxIter = 5;

  while (iterations < maxIter) {
    iterations++;
    let reply;
    try {
      reply = await callLLM(messages, config);
    } catch (e) {
      if (/429|rate limit/i.test(String(e.message))) {
        return { response: 'El servicio está saturado un momento. Espera un poco.', iterations };
      }
      return { response: 'No pude conectar ahora. Revisa internet.', iterations };
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
        '\n\nRespuesta FINAL breve y honesta (si hubo ERROR, dilo). Sin TOOL.',
    });
  }

  if (!finalText) {
    const last = messages.filter((m) => m.role === 'assistant').pop();
    finalText = last ? polishForSpeech(last.content) : 'Listo.';
  }
  return { response: finalText, iterations };
}

function fallbackResponse() {
  return { response: 'No pude conectar con el modelo.', intelligent: false };
}

module.exports = {
  runAgent, getConfig, saveConfig, fallbackResponse, callLLM,
  getConfigPath, ensureDefaultConfig, MODEL_CHAIN,
};
