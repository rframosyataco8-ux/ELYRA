/**
 * ELYRA Agent — key solo desde config/env; escalado de modelo; herramientas PC
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const MODEL_FAST = 'llama-3.1-8b-instant';
const MODEL_SMART = 'llama-3.3-70b-versatile';
const MODEL_CHAIN = [MODEL_FAST, 'gemma2-9b-it', MODEL_SMART];

const COMPLEX_RE =
  /\b(analiza|analizar|planifica|planificar|explica en detalle|investiga|investigar|compara|diseña|arquitectura|paso a paso|reporte|informe|estrategia|debug|refactor)\b/i;

const SYSTEM_PROMPT = `Eres ELYRA, asistente de escritorio. Español natural, cercano, breve.

RESPUESTA FINAL (voz): 1-3 frases, sin rutas Windows, sin markdown, sin JSON.
Si una herramienta falló (ERROR), dilo. Nunca inventes éxitos.

HERRAMIENTAS:
[TOOL: web_search]
query: texto
[/TOOL]
[TOOL: create_file]
path: Informes/a.txt
content: texto
[/TOOL]
[TOOL: create_html_report]
path: Informes/r.html
title: t
body: html
[/TOOL]
[TOOL: open_app]
name: word|chrome|notepad|...
[/TOOL]
[TOOL: open_folder]
name: documentos|descargas|escritorio|informes
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
[TOOL: volume]
action: up|down|mute|set
value: 50
[/TOOL]
[TOOL: media]
action: play|pause|next|prev
[/TOOL]
[TOOL: brightness]
action: up|down|set
value: 70
[/TOOL]
[TOOL: clipboard]
action: read|write
text: opcional
[/TOOL]
[TOOL: screenshot]
[/TOOL]
[TOOL: list_processes]
[/TOOL]
[TOOL: kill_process]
name: chrome
[/TOOL]
[TOOL: windows]
action: minimize_all|lock|screen_off
[/TOOL]
[TOOL: input]
action: type|click
text: hola
[/TOOL]
`;

function getConfigPath() {
  return path.join(os.homedir(), '.elyra', 'config.json');
}

function ensureDefaultConfig() {
  const p = getConfigPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(p)) {
    fs.writeFileSync(
      p,
      JSON.stringify(
        {
          apiKey: '',
          baseUrl: DEFAULT_BASE_URL,
          model: MODEL_FAST,
        },
        null,
        2,
      ),
      'utf-8',
    );
  }
}

function getConfig() {
  ensureDefaultConfig();
  try {
    const c = JSON.parse(fs.readFileSync(getConfigPath(), 'utf-8'));
    return {
      apiKey: (c.apiKey || process.env.GROQ_API_KEY || process.env.ELYRA_API_KEY || '').trim(),
      baseUrl: c.baseUrl || process.env.ELYRA_BASE_URL || DEFAULT_BASE_URL,
      model: c.model || process.env.ELYRA_MODEL || MODEL_FAST,
    };
  } catch {
    return {
      apiKey: (process.env.GROQ_API_KEY || process.env.ELYRA_API_KEY || '').trim(),
      baseUrl: DEFAULT_BASE_URL,
      model: MODEL_FAST,
    };
  }
}

function saveConfig(partial) {
  ensureDefaultConfig();
  const next = { ...getConfig(), ...partial };
  fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

function pickModel(userMessage, config) {
  if (COMPLEX_RE.test(userMessage || '')) return MODEL_SMART;
  return config.model || MODEL_FAST;
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

async function callLLM(messages, config, preferredModel) {
  if (!config.apiKey) throw new Error('NO_API_KEY');
  const preferred = preferredModel || config.model || MODEL_FAST;
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
  if (/rate limit|429/i.test(t)) return 'El servicio está saturado un momento.';
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
            headers: { 'User-Agent': 'ELYRA/2.1' },
          });
          if (wr.ok) {
            const data = await wr.json();
            if (data.extract) results.unshift(`Wikipedia: ${data.extract}`);
          }
        } catch {}
        return {
          ok: true,
          result: results.length ? results.map((r, i) => `${i + 1}. ${r}`).join('\n') : `Sin resultados: ${q}`,
        };
      }
      case 'create_file': {
        const filePath = resolveUserPath(params.path || 'elyra-output.txt');
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, params.content || '', 'utf-8');
        return { ok: true, result: `Creado ${path.basename(filePath)}` };
      }
      case 'create_html_report': {
        const filePath = resolveUserPath(params.path || 'Informes/reporte.html');
        const title = params.title || 'Reporte ELYRA';
        const body = params.body || '<p>Sin contenido</p>';
        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>${title.replace(/</g, '')}</title></head><body><h1>${title.replace(/</g, '')}</h1>${body}</body></html>`;
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const finalPath = filePath.toLowerCase().endsWith('.html') ? filePath : filePath + '.html';
        fs.writeFileSync(finalPath, html, 'utf-8');
        return { ok: true, result: `Reporte ${path.basename(finalPath)} listo` };
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
        return { ok: true, result: `${path.basename(found)}:\n${fs.readFileSync(found, 'utf-8').slice(0, 12000)}` };
      }
      case 'list_dir': {
        let p = params.path || path.join(os.homedir(), 'Documents');
        if (!path.isAbsolute(p)) p = resolveUserPath(p);
        if (!fs.existsSync(p)) return { ok: false, result: 'No existe' };
        const items = fs.readdirSync(p, { withFileTypes: true }).slice(0, 60);
        return { ok: true, result: items.map((d) => `${d.isDirectory() ? '[DIR]' : '[FILE]'} ${d.name}`).join('\n') };
      }
      case 'run_command':
        return await helpers.runCommand(params.command || '');
      case 'remember':
        return await helpers.remember(params.text || '');
      case 'recall':
        return helpers.recall ? await helpers.recall() : { ok: true, result: 'Sin notas' };
      case 'get_system_info':
        if (helpers.getSystemStats) {
          const s = await helpers.getSystemStats();
          return { ok: true, result: `CPU ${s.cpu}%, RAM ${s.ram}%, disco ${s.disk}%.` };
        }
        return { ok: true, result: `Equipo ${os.hostname()}` };
      case 'volume':
        return helpers.pc ? await helpers.pc.volume(params.action, params.value) : { ok: false, result: 'N/A' };
      case 'media':
        return helpers.pc ? await helpers.pc.media(params.action) : { ok: false, result: 'N/A' };
      case 'brightness':
        return helpers.pc ? await helpers.pc.brightness(params.action, params.value) : { ok: false, result: 'N/A' };
      case 'clipboard':
        return helpers.pc ? await helpers.pc.clipboard(params.action, params.text) : { ok: false, result: 'N/A' };
      case 'screenshot':
        return helpers.pc ? await helpers.pc.screenshot() : { ok: false, result: 'N/A' };
      case 'list_processes':
        return helpers.pc ? await helpers.pc.listProcesses() : { ok: false, result: 'N/A' };
      case 'kill_process':
        return helpers.pc ? await helpers.pc.killProcess(params.name) : { ok: false, result: 'N/A' };
      case 'windows':
        return helpers.pc ? await helpers.pc.windows(params.action) : { ok: false, result: 'N/A' };
      case 'input':
        return helpers.pc ? await helpers.pc.input(params.action, { text: params.text }) : { ok: false, result: 'N/A' };
      default:
        return { ok: false, result: `Desconocida: ${name}` };
    }
  } catch (e) {
    return { ok: false, result: e.message };
  }
}

async function runAgent(userMessage, history, helpers) {
  const config = getConfig();
  if (!config.apiKey) {
    return {
      response:
        'No hay API key configurada. Crea el archivo de configuración en tu carpeta de usuario, carpeta .elyra, archivo config.json, con tu clave de Groq.',
      iterations: 0,
    };
  }

  const preferred = pickModel(userMessage, config);
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
      reply = await callLLM(messages, config, preferred);
    } catch (e) {
      if (/429|rate limit/i.test(String(e.message))) {
        return { response: 'El servicio está saturado un momento.', iterations };
      }
      if (String(e.message) === 'NO_API_KEY') {
        return { response: 'Falta la API key de Groq en tu configuración local.', iterations };
      }
      return { response: 'No pude conectar ahora.', iterations };
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
        '\n\nRespuesta FINAL breve y honesta. Sin TOOL.',
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
    response: 'Configura tu API key de Groq en el archivo local de configuración de ELYRA.',
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
  MODEL_FAST,
  MODEL_SMART,
};
