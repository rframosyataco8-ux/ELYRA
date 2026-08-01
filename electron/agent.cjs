/**
 * ELYRA Agent v12 — Razonamiento + conversación natural + dominio lab
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { TOOL_DEFINITIONS, toolsPromptSummary } = require('./tools-schema.cjs');
const hooks = require('./agent-hooks.cjs');
const { executeTool } = require('./tool-executor.cjs');

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const MODEL_FAST = 'llama-3.1-8b-instant';
const MODEL_SMART = 'llama-3.3-70b-versatile';
const MODEL_CHAIN_GROQ = [MODEL_FAST, 'gemma2-9b-it', MODEL_SMART];

const COMPLEX_RE =
  /\b(analiza|analizar|planifica|explica|explicar|investiga|compara|diseña|reporte|informe|estrategia|resume|resumen|artículo|ensayo|código|codigo|programa|calcula|resuelve|traduce|escribe|redacta|guarda|archivo|documento|reunión|reunion|excel|pdf|powerpoint|presentación|por qué|porque|cómo funciona|como funciona|diferencia|ventajas|desventajas|opinión|opinion|cadmio|plaguicid|laboratorio|afq|cacao|dashboard|cronograma|interpreta|evaluación|evaluacion)\b/i;

const SYSTEM_PROMPT =
  `Eres ELYRA, asistente personal de escritorio e inteligencia operativa en Windows.

PERSONALIDAD
- Español latino natural, cálido e inteligente: como hablar con una persona real muy capaz.
- Adaptas el tono: breve si es una orden, profunda si piden análisis.
- Corriges en silencio errores de voz u ortografía (work→Word, crhome→Chrome, elira→Elyra).
- No suenas a robot, FAQ ni lista forzada.

RAZONAMIENTO
- Identifica la intención real antes de actuar.
- Tareas multi-paso: planifica, usa herramientas en cadena y solo al final resume.
- Si algo es ambiguo pero hay una interpretación útil clara, avanza; si el riesgo es alto, pregunta una sola cosa.
- Nunca digas que hiciste algo si la herramienta falló: explica y ofrece alternativa.
- Usa memoria (recall/remember) cuando el contexto lo pida.

LABORATORIO
- Conoces el entorno de cacao: Cadmio y Plaguicidas, AFQ, Registro de prensa, productos (torta, grano, licor, manteca, cocoa, % grasa, NIRS).
- Ayudas a interpretar datos, redactar informes y organizar archivos sin inventar números.

VOZ Y TEXTO
- 1–4 frases cuando baste. Evita markdown agresivo, JSON y rutas largas (se oyen mal).
- Confirmaciones de PC humanas: "Listo, abrí Word."

HERRAMIENTAS
Function calling nativo o:
[TOOL: nombre]
parametro: valor
[/TOOL]

` + toolsPromptSummary() + `

GUÍA
- Conocimiento actualizado → web_search y sintetiza en español hablable.
- Archivos → find_files, collect_files, analyze_excel, summarize_pdf, read_docx, write_docx.
- Informes → write_docx / write_pptx / html_dashboard en Informes/.
- PC → open_app, volume, screenshot, procesos, etc.
- Preferencias → remember / recall.

Sé proactiva y completa la cadena de trabajo antes de la respuesta final. Todo debe poder leerse en voz alta.`;

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
  const msg = userMessage || '';
  if (provider === 'groq') {
    if (COMPLEX_RE.test(msg)) return MODEL_SMART;
    if (msg.length > 80) return MODEL_SMART;
    if (/\?$|^(qué|que|cómo|como|por qué|porque|quién|quien|cuál|cual|explícame|explicame|ayúdame|ayudame)/i.test(msg)) {
      return MODEL_SMART;
    }
    if (/cadmio|plaguicid|afq|laboratorio|informe|excel|pdf|analiza|compara/i.test(msg)) {
      return MODEL_SMART;
    }
  }
  return config.model || MODEL_FAST;
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
      max_tokens: 4096,
      temperature: 0.72,
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
    temperature: 0.72,
    max_tokens: 4096,
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
  if (provider === 'anthropic') return callAnthropic(messages, config, model);
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
  if (/rate limit|429/i.test(t)) return 'El servicio de IA está saturado un momento. Intenta de nuevo en unos segundos.';
  t = t.replace(/[A-Za-z]:\\[^\s\]"']+/g, 'Documentos');
  t = t.replace(/\\+/g, ' ');
  t = t.replace(/\*\*?/g, '');
  t = t.replace(/`+/g, '');
  t = t.replace(/```[\s\S]*?```/g, '');
  t = t.replace(/#{1,6}\s*/g, '');
  return t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
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
    [/\bcrhome\b/gi, 'chrome'],
    [/\bgrome\b/gi, 'chrome'],
    [/\bedch\b/gi, 'edge'],
    [/\bvisual estudio\b/gi, 'code'],
    [/\bvs code\b/gi, 'code'],
    [/\bhaze?\s+una\s+captura\b/gi, 'haz una captura'],
    [/\bsube el vol\b/gi, 'sube el volumen'],
    [/\belira\b/gi, 'elyra'],
    [/\beliara\b/gi, 'elyra'],
    [/\bpapeler[ao]\b/gi, 'papelera'],
  ];
  for (const [re, rep] of fixes) t = t.replace(re, rep);
  return t;
}

function humanizeLlmError(e) {
  const msg = String(e?.message || e || '');
  if (msg === 'NO_API_KEY' || /NO_API_KEY/.test(msg)) {
    return 'Falta la API key. Ve a Configuración, pégala y pulsa Probar conexión.';
  }
  if (/401|invalid|unauthorized|authentication/i.test(msg)) {
    return 'La API key no es válida o está revocada. Revísala en Configuración.';
  }
  if (/403/i.test(msg)) return 'Acceso denegado al modelo. Revisa el plan de tu proveedor.';
  if (/429|rate limit/i.test(msg)) return 'El servicio de IA está saturado. Espera unos segundos e inténtalo de nuevo.';
  if (/404|model/i.test(msg)) return 'El modelo configurado no existe. Cambia el modelo en Configuración.';
  if (/fetch|network|ENOTFOUND|ECONNREFUSED|timeout/i.test(msg)) {
    return 'No hay conexión con el servidor de IA. Revisa internet o la Base URL.';
  }
  return 'No pude completar la consulta con el modelo (' + msg.slice(0, 60) + '). Puedo seguir controlando el PC.';
}

async function runAgent(userMessage, history, helpers) {
  const config = getConfig();
  if (!config.apiKey) {
    return {
      response:
        'No hay API key configurada. Ve a Configuración, elige proveedor, pega tu clave y pulsa Guardar y Probar conexión.',
      iterations: 0,
    };
  }

  const cleanedUser = normalizeUserIntent(userMessage);
  const preferred = pickModel(cleanedUser, config);
  const native = supportsNativeTools(config);
  const usedTools = [];

  const systemContent = hooks.enrichSystemPrompt(SYSTEM_PROMPT, cleanedUser);

  const messages = [
    { role: 'system', content: systemContent },
    ...history.slice(-20).map((h) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.text,
    })),
    { role: 'user', content: cleanedUser },
  ];

  let finalText = '';
  let iterations = 0;
  const maxIter = 10;

  while (iterations < maxIter) {
    iterations++;
    let out;
    try {
      out = await callLLM(messages, config, preferred, native && iterations <= 6);
    } catch (e) {
      return { response: humanizeLlmError(e), iterations };
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
      usedTools.push(t.name);
      results.push({ tool: t.name, id: t.id, ...(await executeTool(t, helpers)) });
    }

    const obs =
      'OBSERVATION (resultados internos):\n' +
      results.map((r) => '• ' + r.tool + ': ' + (r.ok ? 'OK' : 'ERROR') + ' — ' + r.result).join('\n') +
      '\n\nSi falta algo, llama más herramientas. Si ya está listo, da la respuesta FINAL en español natural y hablable (sin bloques TOOL, sin JSON, sin markdown pesado).';

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
      messages.push({ role: 'user', content: obs });
    } else {
      messages.push({ role: 'assistant', content: out.content || '' });
      messages.push({ role: 'user', content: obs });
    }
  }

  if (!finalText) {
    const last = [...messages].reverse().find((m) => m.role === 'assistant' && m.content);
    finalText = last ? polishForSpeech(String(last.content)) : 'Listo.';
  }

  hooks.recordEpisode(cleanedUser, finalText, usedTools);
  return { response: finalText, iterations, tools: usedTools };
}

function fallbackResponse() {
  return {
    response:
      'Configura tu API key en Configuración de ELYRA y pulsa Probar conexión. Mientras tanto puedo abrir apps y controlar el PC.',
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
