/**
 * ELYRA Agent v7 — multi-IA + Function Calling nativo + fallback [TOOL]
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { TOOL_DEFINITIONS, toolsPromptSummary } = require('./tools-schema.cjs');

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const MODEL_FAST = 'llama-3.1-8b-instant';
const MODEL_SMART = 'llama-3.3-70b-versatile';
const MODEL_CHAIN_GROQ = [MODEL_FAST, 'gemma2-9b-it', MODEL_SMART];

const COMPLEX_RE =
  /\b(analiza|analizar|planifica|planificar|explica|explicar|investiga|investigar|compara|diseña|arquitectura|paso a paso|reporte|informe|estrategia|debug|refactor|resume|resumen|artículo|articulo|ensayo|código|codigo|programa|calcula|resuelve|traduce|traducir|escribe un|redacta|guarda|archivo|documento)\b/i;

const SYSTEM_PROMPT =
  `Eres ELYRA, asistente de escritorio del usuario en Windows. Español natural, preciso, estilo sistema de élite (tipo JARVIS): útil, breve y honesto.

PERSONALIDAD:
- Entiendes errores de voz ("abre work" → Word).
- Si es ambiguo, eliges la acción más útil y actúas.
- Respuesta FINAL para voz: 1 a 3 frases. Sin markdown, sin JSON, sin rutas largas.
- Si una herramienta falla, dilo. Nunca inventes éxitos.
- Si piden información + guardar/resumir en archivo: busca y luego create_file o create_html_report en Informes/.

Puedes usar function calling nativo cuando esté disponible.
También puedes usar el formato texto:
[TOOL: nombre]
parametro: valor
[/TOOL]

Herramientas:\n` + toolsPromptSummary() + `

Reglas:
- Conocimiento → web_search.
- Documentos/resúmenes → create_file o create_html_report en Informes/.
- Abrir → open_app / open_folder / open_url de inmediato.
- Apagar/reiniciar → power.`;

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
      JSON.stringify({ apiKey: '', baseUrl: DEFAULT_BASE_URL, model: MODEL_FAST, provider: 'groq' }, null, 2),
      'utf-8',
    );
  }
}

function detectProviderFromKey(apiKey) {
  const k = (apiKey || '').trim();
  if (k.startsWith('gsk_')) {
    return { baseUrl: 'https://api.groq.com/openai/v1', model: MODEL_FAST, provider: 'groq' };
  }
  if (k.startsWith('sk-ant-')) {
    return {
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
    };
  }
  if (k.startsWith('AIza')) {
    return {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      model: 'gemini-2.0-flash',
      provider: 'gemini',
    };
  }
  if (k.startsWith('sk-or-') || k.startsWith('sk-or-v1-')) {
    return { baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini', provider: 'openrouter' };
  }
  if (k.startsWith('xai-')) {
    return { baseUrl: 'https://api.x.ai/v1', model: 'grok-2-latest', provider: 'xai' };
  }
  if (k.startsWith('sk-') && k.length > 20) {
    return { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', provider: 'openai' };
  }
  return null;
}

function inferProvider(config) {
  if (config.provider) return config.provider;
  const u = (config.baseUrl || '').toLowerCase();
  if (u.includes('anthropic')) return 'anthropic';
  if (u.includes('generativelanguage') || u.includes('googleapis')) return 'gemini';
  if (u.includes('groq')) return 'groq';
  if (u.includes('openrouter')) return 'openrouter';
  if (u.includes('x.ai')) return 'xai';
  if (u.includes('openai.com')) return 'openai';
  if (u.includes('localhost') || u.includes('11434')) return 'ollama';
  return 'openai-compatible';
}

function supportsNativeTools(config) {
  const p = inferProvider(config);
  // Groq, OpenAI, OpenRouter, xAI suelen soportar tools; Gemini compat variable; Anthropic distinto
  return p === 'groq' || p === 'openai' || p === 'openrouter' || p === 'xai' || p === 'openai-compatible';
}

function getConfig() {
  ensureDefaultConfig();
  try {
    const c = JSON.parse(fs.readFileSync(getConfigPath(), 'utf-8'));
    const apiKey = (c.apiKey || process.env.GROQ_API_KEY || process.env.ELYRA_API_KEY || '').trim();
    const baseUrl = c.baseUrl || process.env.ELYRA_BASE_URL || DEFAULT_BASE_URL;
    const model = c.model || process.env.ELYRA_MODEL || MODEL_FAST;
    let provider = c.provider || null;
    if (!provider) {
      const d = detectProviderFromKey(apiKey);
      provider = d?.provider || inferProvider({ baseUrl });
    }
    return { apiKey, baseUrl, model, provider };
  } catch {
    return {
      apiKey: (process.env.GROQ_API_KEY || process.env.ELYRA_API_KEY || '').trim(),
      baseUrl: DEFAULT_BASE_URL,
      model: MODEL_FAST,
      provider: 'groq',
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
      if (!partial.provider) next.provider = detected.provider;
    }
  }
  if (partial.baseUrl && !partial.provider) {
    next.provider = inferProvider(next);
  }
  fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

function pickModel(userMessage, config) {
  const provider = inferProvider(config);
  if (provider === 'groq') {
    if (COMPLEX_RE.test(userMessage || '')) return MODEL_SMART;
    if ((userMessage || '').length > 180) return MODEL_SMART;
  }
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

async function callAnthropic(messages, config, model) {
  const systemParts = [];
  const chat = [];
  for (const m of messages) {
    if (m.role === 'system') systemParts.push(m.content);
    else if (m.role === 'tool') {
      chat.push({
        role: 'user',
        content: 'Resultado herramienta ' + (m.name || '') + ': ' + m.content,
      });
    } else {
      chat.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      });
    }
  }
  const merged = [];
  for (const m of chat) {
    if (merged.length && merged[merged.length - 1].role === m.role) {
      merged[merged.length - 1].content += '\n\n' + m.content;
    } else {
      merged.push({ ...m });
    }
  }
  if (merged.length && merged[0].role !== 'user') {
    merged.unshift({ role: 'user', content: '(continúa)' });
  }

  const url = (config.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '') + '/v1/messages';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || config.model || 'claude-3-5-sonnet-20241022',
      max_tokens: 2800,
      temperature: 0.35,
      system: systemParts.join('\n\n') || undefined,
      messages: merged,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    const err = new Error('LLM ' + res.status + ': ' + errText.slice(0, 280));
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const blocks = data.content || [];
  const text = blocks.map((b) => (b.type === 'text' ? b.text : '')).join('') || '';
  return { content: text, tool_calls: null, rawMessage: { role: 'assistant', content: text } };
}

async function callOpenAICompat(messages, config, model, useTools) {
  let base = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
  if (inferProvider(config) === 'gemini' && !base.includes('/openai')) {
    base = 'https://generativelanguage.googleapis.com/v1beta/openai';
  }
  const url = base + '/chat/completions';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + config.apiKey,
  };
  if (inferProvider(config) === 'openrouter') {
    headers['HTTP-Referer'] = 'https://elyra.local';
    headers['X-Title'] = 'ELYRA';
  }

  const body = {
    model: model || config.model,
    messages: messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: m.tool_call_id || m.id || 'call_0',
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        };
      }
      if (m.tool_calls) {
        return { role: 'assistant', content: m.content || null, tool_calls: m.tool_calls };
      }
      return { role: m.role, content: m.content };
    }),
    temperature: 0.35,
    max_tokens: 2800,
  };

  if (useTools && supportsNativeTools(config)) {
    body.tools = TOOL_DEFINITIONS;
    body.tool_choice = 'auto';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    // Si el proveedor rechaza tools, reintentar sin tools una vez
    if (useTools && (res.status === 400 || res.status === 422) && /tool/i.test(errText)) {
      return callOpenAICompat(messages, config, model, false);
    }
    const err = new Error('LLM ' + res.status + ': ' + errText.slice(0, 280));
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const msg = data.choices?.[0]?.message || {};
  return {
    content: msg.content || '',
    tool_calls: msg.tool_calls || null,
    rawMessage: msg,
  };
}

async function callLLMOnce(messages, config, model, useTools) {
  const provider = inferProvider(config);
  if (provider === 'anthropic') {
    return callAnthropic(messages, config, model);
  }
  return callOpenAICompat(messages, config, model, !!useTools);
}

async function callLLM(messages, config, preferredModel, useTools) {
  if (!config.apiKey) throw new Error('NO_API_KEY');
  const preferred = preferredModel || config.model || MODEL_FAST;
  const provider = inferProvider(config);
  const chain =
    provider === 'groq'
      ? [preferred, ...MODEL_CHAIN_GROQ.filter((m) => m !== preferred)]
      : [preferred];
  let lastErr;
  for (const model of chain) {
    try {
      return await callLLMOnce(messages, config, model, useTools);
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
    const out = await callLLMOnce(
      [{ role: 'user', content: 'Di solo: ok' }],
      config,
      config.model,
      false,
    );
    return {
      ok: true,
      message: 'Conexión correcta. IA lista (' + inferProvider(config) + ').',
      model: config.model,
      baseUrl: config.baseUrl,
      sample: String(out.content || '').slice(0, 40),
    };
  } catch (e) {
    const msg = String(e.message || e);
    let hint = msg.slice(0, 160);
    if (/401|invalid|unauthorized|authentication/i.test(msg)) hint = 'API key inválida o revocada.';
    else if (/403/i.test(msg)) hint = 'Acceso denegado. Revisa la key o el plan.';
    else if (/429/i.test(msg)) hint = 'Límite de uso alcanzado. Espera un momento.';
    else if (/404|model/i.test(msg)) hint = 'Modelo no encontrado. Cambia el modelo en Configuración.';
    else if (/fetch|network|ENOTFOUND/i.test(msg)) hint = 'No se pudo conectar. Revisa internet o la Base URL.';
    return {
      ok: false,
      error: e.status ? String(e.status) : 'ERROR',
      message: hint,
      detail: msg.slice(0, 200),
    };
  }
}

function parseTools(text) {
  const tools = [];
  const re = /\[TOOL:\s*([\w_]+)\]([\s\S]*?)\[\/TOOL\]/gi;
  let m;
  while ((m = re.exec(text || '')) !== null) {
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

function parseNativeToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls) || !toolCalls.length) return [];
  return toolCalls.map((tc) => {
    let params = {};
    try {
      params = JSON.parse(tc.function?.arguments || '{}');
    } catch {
      params = {};
    }
    return {
      name: (tc.function?.name || '').toLowerCase(),
      params,
      id: tc.id,
    };
  });
}

function stripTools(text) {
  return (text || '')
    .replace(/\[TOOL:\s*[\w_]+\][\s\S]*?\[\/TOOL\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
          const res = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), {
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
          results.push('(Busqueda: ' + e.message + ')');
        }
        try {
          const wr = await fetch(
            'https://es.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(q),
            { headers: { 'User-Agent': 'ELYRA/7.0' } },
          );
          if (wr.ok) {
            const data = await wr.json();
            if (data.extract) results.unshift('Wikipedia: ' + data.extract);
          }
        } catch {}
        return {
          ok: true,
          result: results.length
            ? results.map((r, i) => i + 1 + '. ' + r).join('\n')
            : 'Sin resultados: ' + q,
        };
      }
      case 'create_file': {
        const filePath = resolveUserPath(params.path || 'elyra-output.txt');
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, params.content || '', 'utf-8');
        return { ok: true, result: 'Creado ' + path.basename(filePath) + ' en Documentos' };
      }
      case 'create_html_report': {
        const filePath = resolveUserPath(params.path || 'Informes/reporte.html');
        const title = params.title || 'Reporte ELYRA';
        const body = params.body || '<p>Sin contenido</p>';
        const html =
          '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>' +
          title.replace(/</g, '') +
          '</title><style>body{font-family:Segoe UI,system-ui,sans-serif;max-width:880px;margin:40px auto;padding:0 20px;line-height:1.65;color:#0f172a;background:#f8fafc}h1{color:#0369a1}</style></head><body><h1>' +
          title.replace(/</g, '') +
          '</h1><p>Generado por ELYRA · ' +
          new Date().toLocaleString('es-ES') +
          '</p>' +
          body +
          '</body></html>';
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const finalPath = filePath.toLowerCase().endsWith('.html') ? filePath : filePath + '.html';
        fs.writeFileSync(finalPath, html, 'utf-8');
        return { ok: true, result: 'Reporte ' + path.basename(finalPath) + ' listo en Informes' };
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
        if (!found) return { ok: false, result: 'No existe ' + params.path };
        return {
          ok: true,
          result: path.basename(found) + ':\n' + fs.readFileSync(found, 'utf-8').slice(0, 14000),
        };
      }
      case 'list_dir': {
        let p = params.path || path.join(os.homedir(), 'Documents');
        if (!path.isAbsolute(p)) p = resolveUserPath(p);
        if (!fs.existsSync(p)) return { ok: false, result: 'No existe' };
        const items = fs.readdirSync(p, { withFileTypes: true }).slice(0, 80);
        return {
          ok: true,
          result: items.map((d) => (d.isDirectory() ? '[DIR] ' : '[FILE] ') + d.name).join('\n'),
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
          return { ok: true, result: 'CPU ' + s.cpu + '%, RAM ' + s.ram + '%, disco ' + s.disk + '%.' };
        }
        return {
          ok: true,
          result:
            'Equipo ' +
            os.hostname() +
            ', ' +
            os.platform() +
            ', ' +
            Math.round(os.totalmem() / 1e9) +
            ' GB RAM.',
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
        return { ok: false, result: 'Desconocida: ' + name };
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
        'No hay API key configurada. Ve a Configuración, elige proveedor, pega tu clave y pulsa Guardar.',
      iterations: 0,
    };
  }

  const cleanedUser = normalizeUserIntent(userMessage);
  const preferred = pickModel(cleanedUser, config);
  const native = supportsNativeTools(config);

  let memoryHint = '';
  try {
    if (helpers.recall) {
      const mem = await helpers.recall();
      if (mem?.result && !/sin notas/i.test(mem.result)) {
        memoryHint = '\n\nMemoria del usuario (contexto): ' + mem.result.slice(0, 500);
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
    let out;
    try {
      out = await callLLM(messages, config, preferred, native && iterations <= 4);
    } catch (e) {
      if (/429|rate limit/i.test(String(e.message))) {
        return { response: 'El servicio está saturado un momento.', iterations };
      }
      if (String(e.message) === 'NO_API_KEY') {
        return { response: 'Falta la API key. Configúrala en la pestaña Configuración.', iterations };
      }
      if (/401|invalid|unauthorized|authentication/i.test(String(e.message))) {
        return { response: 'La API key no es válida. Revísala en Configuración.', iterations };
      }
      return { response: 'No pude conectar ahora.', iterations };
    }

    const nativeTools = parseNativeToolCalls(out.tool_calls);
    const textTools = parseTools(out.content || '');
    const tools = nativeTools.length ? nativeTools : textTools;

    if (tools.length === 0) {
      finalText = polishForSpeech(out.content || '');
      break;
    }

    const results = [];
    for (const t of tools) {
      results.push({ tool: t.name, id: t.id, ...(await executeTool(t, helpers)) });
    }

    if (nativeTools.length && out.rawMessage) {
      messages.push({
        role: 'assistant',
        content: out.content || null,
        tool_calls: out.tool_calls,
      });
      for (const r of results) {
        messages.push({
          role: 'tool',
          tool_call_id: r.id || 'call_0',
          name: r.tool,
          content: (r.ok ? 'OK: ' : 'ERROR: ') + r.result,
        });
      }
    } else {
      messages.push({ role: 'assistant', content: out.content || '' });
      messages.push({
        role: 'user',
        content:
          'Resultados de herramientas:\n' +
          results.map((r) => '• ' + r.tool + ': ' + (r.ok ? 'OK' : 'ERROR') + ' — ' + r.result).join('\n') +
          '\n\nDa la respuesta FINAL breve y natural para voz. Si hubo ERROR, dilo. Sin bloques TOOL.',
      });
    }
  }

  if (!finalText) {
    const last = [...messages].reverse().find((m) => m.role === 'assistant' && m.content);
    finalText = last ? polishForSpeech(String(last.content)) : 'Listo.';
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
  MODEL_CHAIN: MODEL_CHAIN_GROQ,
  MODEL_FAST,
  MODEL_SMART,
  normalizeUserIntent,
  TOOL_DEFINITIONS,
};
