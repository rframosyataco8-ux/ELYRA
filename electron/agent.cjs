/**
 * ELYRA Agent v3 — más inteligente, memoria de contexto, herramientas PC
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const MODEL_FAST = 'llama-3.1-8b-instant';
const MODEL_SMART = 'llama-3.3-70b-versatile';
const MODEL_CHAIN = [MODEL_FAST, 'gemma2-9b-it', MODEL_SMART];

const COMPLEX_RE =
  /\b(analiza|analizar|planifica|planificar|explica|explicar|investiga|investigar|compara|diseña|arquitectura|paso a paso|reporte|informe|estrategia|debug|refactor|resume|resumen|artículo|articulo|ensayo|código|codigo|programa|calcula|resuelve|traduce|traducir|escribe un|redacta)\b/i;

const SYSTEM_PROMPT = `Eres ELYRA, asistente de escritorio del usuario en Windows. Hablas español natural, claro y cercano, como una compañera inteligente.

PERSONALIDAD:
- Entiendes pedidos incompletos o con errores de voz (por ejemplo "abre word" aunque diga "abre work").
- Si el pedido es ambiguo, asumes la intención más útil y actúas.
- Respuestas FINALES para voz: 1 a 3 frases cortas. Sin markdown, sin JSON, sin rutas de Windows, sin listas largas.
- Si una herramienta falla (ERROR), dilo con honestidad. Nunca inventes que algo se abrió o guardó.

CAPACIDADES (usa TOOLS cuando haga falta):
- Abrir apps y carpetas, buscar en web, crear archivos e informes HTML.
- Controlar volumen, multimedia, brillo, portapapeles, capturas, procesos, ventanas.
- Leer/listar archivos, recordar datos, info del sistema.

FORMATO DE HERRAMIENTAS (exacto):
[TOOL: nombre]
parametro: valor
[/TOOL]

Herramientas:
web_search (query), create_file (path, content), create_html_report (path, title, body),
open_app (name), open_folder (name), open_url (url), read_file (path), list_dir (path),
run_command (command), remember (text), recall, get_system_info,
volume (action: up|down|mute), media (action: play|pause|next|prev),
brightness (action: up|down|set, value), clipboard (action: read|write, text),
screenshot, list_processes, kill_process (name), windows (action: minimize_all|lock|screen_off),
input (action: type|click, text)

Cuando el usuario pide algo de conocimiento (quién inventó X, qué es Y, historia, ciencia), usa web_search y responde con lo esencial.
Cuando pide crear documentos, usa create_file o create_html_report en Informes/.
Cuando pide abrir algo, open_app u open_folder de inmediato.`;

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
      JSON.stringify({ apiKey: '', baseUrl: DEFAULT_BASE_URL, model: MODEL_FAST }, null, 2),
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
  // Mensajes largos → modelo más capaz
  if ((userMessage || '').length > 180) return MODEL_SMART;
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
    body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 2500 }),
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
  t = t.replace(/#{1,6}\s*/g, '');
  return t.replace(/\s+/g, ' ').trim();
}

/** Corrección ligera de errores típicos de STT en español */
function normalizeUserIntent(raw) {
  let t = (raw || '').trim();
  const fixes = [
    [/\bwork\b/gi, 'word'],
    [/\bwuar\b/gi, 'word'],
    [/\bgüord\b/gi, 'word'],
    [/\bexcelente\b/gi, 'excel'],
    [/\bnot pad\b/gi, 'notepad'],
    [/\bbloc\b/gi, 'notepad'],
    [/\bcrom\b/gi, 'chrome'],
    [/\bgrome\b/gi, 'chrome'],
    [/\bedch\b/gi, 'edge'],
    [/\bvisual estudio\b/gi, 'code'],
    [/\bvs code\b/gi, 'code'],
    [/\bhaze?\s+una\s+captura\b/gi, 'haz una captura'],
    [/\bsube el vol\b/gi, 'sube el volumen'],
  ];
  for (const [re, rep] of fixes) t = t.replace(re, rep);
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
          const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
          });
          const html = await res.text();
          const re = /class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td)>/gi;
          let sm;
          while ((sm = re.exec(html)) !== null && results.length < 6) {
            const t = sm[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            if (t.length > 25) results.push(t);
          }
        } catch (e) {
          results.push(`(Búsqueda: ${e.message})`);
        }
        try {
          const wr = await fetch(
            `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`,
            { headers: { 'User-Agent': 'ELYRA/3.0' } },
          );
          if (wr.ok) {
            const data = await wr.json();
            if (data.extract) results.unshift(`Wikipedia: ${data.extract}`);
          }
        } catch {}
        return {
          ok: true,
          result: results.length
            ? results.map((r, i) => `${i + 1}. ${r}`).join('\n')
            : `Sin resultados: ${q}`,
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
        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width"/><title>${title.replace(/</g, '')}</title>
<style>body{font-family:Segoe UI,system-ui,sans-serif;max-width:880px;margin:40px auto;padding:0 20px;line-height:1.65;color:#0f172a}h1{color:#0369a1}h2{color:#0c4a6e}.meta{color:#64748b;font-size:14px}</style></head>
<body><h1>${title.replace(/</g, '')}</h1><p class="meta">Generado por ELYRA · ${new Date().toLocaleString('es-ES')}</p>${body}</body></html>`;
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
        const candidates = [
          p,
          path.join(os.homedir(), 'Documents', params.path),
          path.join(os.homedir(), 'Desktop', params.path),
          path.join(os.homedir(), 'Downloads', params.path),
        ];
        const found = candidates.find((c) => c && fs.existsSync(c) && fs.statSync(c).isFile());
        if (!found) return { ok: false, result: `No existe ${params.path}` };
        return {
          ok: true,
          result: `${path.basename(found)}:\n${fs.readFileSync(found, 'utf-8').slice(0, 14000)}`,
        };
      }
      case 'list_dir': {
        let p = params.path || path.join(os.homedir(), 'Documents');
        if (!path.isAbsolute(p)) p = resolveUserPath(p);
        if (!fs.existsSync(p)) return { ok: false, result: 'No existe' };
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
      case 'recall':
        return helpers.recall ? await helpers.recall() : { ok: true, result: 'Sin notas' };
      case 'get_system_info':
        if (helpers.getSystemStats) {
          const s = await helpers.getSystemStats();
          return { ok: true, result: `CPU ${s.cpu}%, RAM ${s.ram}%, disco ${s.disk}%.` };
        }
        return {
          ok: true,
          result: `Equipo ${os.hostname()}, ${os.platform()}, ${Math.round(os.totalmem() / 1e9)} GB RAM.`,
        };
      case 'volume':
        return helpers.pc ? await helpers.pc.volume(params.action, params.value) : { ok: false, result: 'N/A' };
      case 'media':
        return helpers.pc ? await helpers.pc.media(params.action) : { ok: false, result: 'N/A' };
      case 'brightness':
        return helpers.pc
          ? await helpers.pc.brightness(params.action, params.value)
          : { ok: false, result: 'N/A' };
      case 'clipboard':
        return helpers.pc
          ? await helpers.pc.clipboard(params.action, params.text)
          : { ok: false, result: 'N/A' };
      case 'screenshot':
        return helpers.pc ? await helpers.pc.screenshot() : { ok: false, result: 'N/A' };
      case 'list_processes':
        return helpers.pc ? await helpers.pc.listProcesses() : { ok: false, result: 'N/A' };
      case 'kill_process':
        return helpers.pc ? await helpers.pc.killProcess(params.name) : { ok: false, result: 'N/A' };
      case 'windows':
        return helpers.pc ? await helpers.pc.windows(params.action) : { ok: false, result: 'N/A' };
      case 'input':
        return helpers.pc
          ? await helpers.pc.input(params.action, { text: params.text })
          : { ok: false, result: 'N/A' };
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
        'No hay API key configurada. Pon tu clave de Groq en el archivo de configuración de ELYRA.',
      iterations: 0,
    };
  }

  const cleanedUser = normalizeUserIntent(userMessage);
  const preferred = pickModel(cleanedUser, config);

  // Inyectar memoria reciente si existe
  let memoryHint = '';
  try {
    if (helpers.recall) {
      const mem = await helpers.recall();
      if (mem?.result && !/sin notas/i.test(mem.result)) {
        memoryHint = `\n\nMemoria del usuario (contexto): ${mem.result.slice(0, 500)}`;
      }
    }
  } catch {}

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + memoryHint },
    ...history.slice(-12).map((h) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.text,
    })),
    { role: 'user', content: cleanedUser },
  ];

  let finalText = '';
  let iterations = 0;
  const maxIter = 6;

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
        return { response: 'Falta la API key de Groq.', iterations };
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
        'Resultados de herramientas:\n' +
        results.map((r) => `• ${r.tool}: ${r.ok ? 'OK' : 'ERROR'} — ${r.result}`).join('\n') +
        '\n\nDa la respuesta FINAL breve y natural para voz. Si hubo ERROR, dilo. Sin bloques TOOL.',
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
    response: 'Configura tu API key de Groq en el archivo local de ELYRA.',
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
  normalizeUserIntent,
};
