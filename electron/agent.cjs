/**
 * ELYRA Agent v5 — más herramientas, más inteligencia operativa
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

const SYSTEM_PROMPT = `Eres ELYRA, asistente de escritorio del usuario en Windows. Español natural, preciso, estilo sistema de élite (tipo JARVIS): útil, breve y honesto.

PERSONALIDAD:
- Entiendes errores de voz ("abre work" → Word).
- Si es ambiguo, eliges la acción más útil y actúas.
- Respuesta FINAL para voz: 1 a 3 frases. Sin markdown, sin JSON, sin rutas largas.
- Si una herramienta falla, dilo. Nunca inventes éxitos.

HERRAMIENTAS — formato exacto:
[TOOL: nombre]
parametro: valor
[/TOOL]

Lista:
web_search (query)
create_file (path, content)
create_html_report (path, title, body)
open_app (name) · open_folder (name) · open_url (url)
read_file (path) · list_dir (path) · search_files (query, root opcional)
run_command (command)
remember (text) · recall
get_system_info · battery · network_info · disk_space · uptime
volume (action: up|down|mute|set, value)
media (action: play|pause|next|prev|stop)
brightness (action: up|down|set, value)
clipboard (action: read|write|clear, text)
screenshot · list_processes · kill_process (name)
windows (action: minimize_all|lock|screen_off)
input (action: type|click|enter|escape, text)
notify (title, message)
open_settings (page: system|display|sound|wifi|bluetooth|privacy|apps|update|power)
empty_recycle
power (action: shutdown|restart|sleep|cancel, minutes opcional)

Reglas:
- Conocimiento → web_search.
- Documentos → create_file / create_html_report en Informes/.
- Abrir → open_app / open_folder de inmediato.
- Apagar/reiniciar: usa power con minutes (por defecto pocos segundos de gracia).`;

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

function detectProviderFromKey(apiKey) {
  const k = (apiKey || '').trim();
  if (k.startsWith('gsk_')) {
    return { baseUrl: 'https://api.groq.com/openai/v1', model: MODEL_FAST, provider: 'groq' };
  }
  if (k.startsWith('sk-or-') || k.startsWith('sk-or-v1-')) {
    return { baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini', provider: 'openrouter' };
  }
  if (k.startsWith('sk-') && k.length > 20) {
    return { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', provider: 'openai' };
  }
  if (k.startsWith('xai-')) {
    return { baseUrl: 'https://api.x.ai/v1', model: 'grok-2-latest', provider: 'xai' };
  }
  return null;
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
  const prev = getConfig();
  const next = { ...prev, ...partial };
  if (partial.apiKey === undefined || partial.apiKey === '') {
    next.apiKey = prev.apiKey;
  } else {
    next.apiKey = String(partial.apiKey).trim();
    const detected = detectProviderFromKey(next.apiKey);
    if (detected) {
      if (!partial.baseUrl) next.baseUrl = detected.baseUrl;
      if (!partial.model) next.model = detected.model;
    }
  }
  fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

function pickModel(userMessage, config) {
  if (COMPLEX_RE.test(userMessage || '')) return MODEL_SMART;
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
    body: JSON.stringify({ model, messages, temperature: 0.35, max_tokens: 2800 }),
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
      if (e.status === 400 || e.status === 404) continue;
      throw e;
    }
  }
  throw lastErr || new Error('Límite de uso');
}

async function testApiConnection(override = {}) {
  const config = { ...getConfig(), ...override };
  if (override.apiKey === '') config.apiKey = getConfig().apiKey;
  if (!config.apiKey) {
    return { ok: false, error: 'NO_API_KEY', message: 'No hay API key configurada.' };
  }
  try {
    const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || MODEL_FAST,
        messages: [{ role: 'user', content: 'Di solo: ok' }],
        max_tokens: 8,
        temperature: 0,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      let hint = `Error ${res.status}`;
      if (res.status === 401) hint = 'API key inválida o revocada.';
      else if (res.status === 403) hint = 'Acceso denegado. Revisa la key o el plan.';
      else if (res.status === 429) hint = 'Límite de uso alcanzado. Espera un momento.';
      else if (res.status === 404) hint = 'Modelo no encontrado. Cambia el modelo en Configuración.';
      return { ok: false, error: String(res.status), message: hint, detail: errText.slice(0, 200) };
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    return {
      ok: true,
      message: 'Conexión correcta. IA lista.',
      model: config.model,
      baseUrl: config.baseUrl,
      sample: text.slice(0, 40),
    };
  } catch (e) {
    return {
      ok: false,
      error: 'NETWORK',
      message: 'No se pudo conectar al proveedor. Revisa internet o la Base URL.',
      detail: String(e.message || e).slice(0, 200),
    };
  }
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
    [/\belira\b/gi, 'elyra'],
    [/\bpapeler[ao]\b/gi, 'papelera'],
  ];
  for (const [re, rep] of fixes) t = t.replace(re, rep);
  return t;
}

async function executeTool(tool, helpers) {
  const { name, params } = tool;
  const pc = helpers.pc;
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
            { headers: { 'User-Agent': 'ELYRA/5.0' } },
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
<style>body{font-family:Segoe UI,system-ui,sans-serif;max-width:880px;margin:40px auto;padding:0 20px;line-height:1.65;color:#0f172a;background:#f8fafc}h1{color:#0369a1;border-bottom:2px solid #bae6fd;padding-bottom:8px}h2{color:#0c4a6e}.meta{color:#64748b;font-size:14px}</style></head>
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
      case 'search_files':
        return pc ? await pc.searchFiles(params.query, params.root) : { ok: false, result: 'N/A' };
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
      case 'battery':
        return pc ? await pc.battery() : { ok: false, result: 'N/A' };
      case 'network_info':
        return pc ? await pc.networkInfo() : { ok: false, result: 'N/A' };
      case 'disk_space':
        return pc ? await pc.systemExtras('disk_space') : { ok: false, result: 'N/A' };
      case 'uptime':
        return pc ? await pc.systemExtras('uptime') : { ok: false, result: 'N/A' };
      case 'volume':
        return pc ? await pc.volume(params.action, params.value) : { ok: false, result: 'N/A' };
      case 'media':
        return pc ? await pc.media(params.action) : { ok: false, result: 'N/A' };
      case 'brightness':
        return pc ? await pc.brightness(params.action, params.value) : { ok: false, result: 'N/A' };
      case 'clipboard':
        return pc ? await pc.clipboard(params.action, params.text) : { ok: false, result: 'N/A' };
      case 'screenshot':
        return pc ? await pc.screenshot() : { ok: false, result: 'N/A' };
      case 'list_processes':
        return pc ? await pc.listProcesses() : { ok: false, result: 'N/A' };
      case 'kill_process':
        return pc ? await pc.killProcess(params.name) : { ok: false, result: 'N/A' };
      case 'windows':
        return pc ? await pc.windows(params.action) : { ok: false, result: 'N/A' };
      case 'input':
        return pc ? await pc.input(params.action, { text: params.text }) : { ok: false, result: 'N/A' };
      case 'notify':
        return pc ? await pc.notify(params.title, params.message) : { ok: false, result: 'N/A' };
      case 'open_settings':
        return pc ? await pc.openSettings(params.page || params.name) : { ok: false, result: 'N/A' };
      case 'empty_recycle':
        return pc ? await pc.emptyRecycle() : { ok: false, result: 'N/A' };
      case 'power':
        return pc ? await pc.power(params.action, params.minutes) : { ok: false, result: 'N/A' };
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
        'No hay API key configurada. Ve a Configuración, pega tu clave de Groq y pulsa Guardar.',
      iterations: 0,
    };
  }

  const cleanedUser = normalizeUserIntent(userMessage);
  const preferred = pickModel(cleanedUser, config);

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
        return { response: 'Falta la API key. Configúrala en la pestaña Configuración.', iterations };
      }
      if (/401|invalid|unauthorized/i.test(String(e.message))) {
        return { response: 'La API key no es válida. Revísala en Configuración.', iterations };
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
    response: 'Configura tu API key en la pestaña Configuración de ELYRA.',
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
  testApiConnection,
  detectProviderFromKey,
  MODEL_CHAIN,
  MODEL_FAST,
  MODEL_SMART,
  normalizeUserIntent,
};
