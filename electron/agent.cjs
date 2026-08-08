/**
 * ELYRA Agent v16 — Operador autónomo PC + laboratorio
 * Proveedores: Groq, Gemini, NVIDIA NIM, Claude, OpenAI, xAI, OpenRouter, Ollama
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

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
const GEMINI_MODEL = 'gemini-2.0-flash';

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = 'nvidia/llama-3.1-nemotron-70b-instruct';

const COMPLEX_RE =
  /\b(analiza|analizar|planifica|explica|explicar|investiga|compara|diseña|reporte|informe|estrategia|resume|resumen|artículo|ensayo|código|codigo|programa|calcula|resuelve|traduce|escribe|redacta|guarda|archivo|documento|reunión|reunion|excel|pdf|powerpoint|presentación|por qué|porque|cómo funciona|como funciona|diferencia|ventajas|desventajas|opinión|opinion|cadmio|plaguicid|laboratorio|afq|cacao|dashboard|cronograma|interpreta|evaluación|evaluacion|sensorial|licor|manteca|nirs|plaguicida|protocolo|norma|ntp|detalle|profund|ayúdame a|ayudame a|paso a paso|completo|investiga|busca información|qué opinas|que opinas|ejecuta|comando|powershell|proceso|ventana|mouse|clic|click|teclado)\b/i;

const SYSTEM_PROMPT = require('./agent-prompt.cjs');

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
  if (k.startsWith('AIza') || k.startsWith('AQ.')) {
    return { baseUrl: GEMINI_BASE, model: GEMINI_MODEL, provider: 'gemini' };
  }
  if (k.startsWith('nvapi-')) {
    return { baseUrl: NVIDIA_BASE, model: NVIDIA_MODEL, provider: 'nvidia' };
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
  if (u.includes('integrate.api.nvidia') || u.includes('nvidia.com')) return 'nvidia';
  if (u.includes('groq')) return 'groq';
  if (u.includes('openrouter')) return 'openrouter';
  if (u.includes('x.ai')) return 'xai';
  if (u.includes('openai.com')) return 'openai';
  if (u.includes('localhost') || u.includes('11434')) return 'ollama';
  return 'openai-compatible';
}

function getConfig() {
  ensureDefaultConfig();
  try {
    const raw = JSON.parse(fs.readFileSync(getConfigPath(), 'utf-8'));
    return {
      apiKey: raw.apiKey || '',
      baseUrl: raw.baseUrl || DEFAULT_BASE_URL,
      model: raw.model || MODEL_FAST,
      provider: raw.provider || inferProvider(raw),
    };
  } catch {
    return { apiKey: '', baseUrl: DEFAULT_BASE_URL, model: MODEL_FAST, provider: 'groq' };
  }
}

function saveConfig(partial) {
  const current = getConfig();
  const next = { ...current, ...partial };
  if (partial && partial.apiKey) {
    const det = detectProviderFromKey(partial.apiKey);
    if (det) {
      if (!partial.baseUrl) next.baseUrl = det.baseUrl;
      if (!partial.model) next.model = det.model;
      if (!partial.provider) next.provider = det.provider;
    }
  }
  next.provider = inferProvider(next);
  fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

function isComplexQuery(text) {
  return COMPLEX_RE.test(text || '') || (text || '').length > 160;
}

function selectModel(config, userText) {
  const provider = inferProvider(config);
  if (provider === 'gemini') return config.model || GEMINI_MODEL;
  if (provider === 'nvidia') return config.model || NVIDIA_MODEL;
  if (config.model && config.model !== MODEL_FAST) return config.model;
  if (isComplexQuery(userText)) return MODEL_SMART;
  return config.model || MODEL_FAST;
}

function llmHeaders(config) {
  const key = (config.apiKey || '').trim();
  const provider = inferProvider(config);
  const headers = { 'Content-Type': 'application/json' };
  if (provider === 'gemini') {
    headers.Authorization = 'Bearer ' + key;
    headers['x-goog-api-key'] = key;
  } else if (provider === 'anthropic') {
    headers['x-api-key'] = key;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers.Authorization = 'Bearer ' + key;
  }
  return headers;
}

function providerLabel(provider) {
  const map = {
    gemini: 'Gemini',
    nvidia: 'NVIDIA NIM',
    groq: 'Groq',
    anthropic: 'Claude',
    openai: 'OpenAI',
    xai: 'xAI',
    openrouter: 'OpenRouter',
    ollama: 'Ollama',
  };
  return map[provider] || provider;
}

function fallbackResponse(userText) {
  const t = (userText || '').toLowerCase();
  if (/hola|buenos|buenas/.test(t)) return 'Hola. Estoy lista. ¿En qué te ayudo?';
  if (/gracias/.test(t)) return 'Con gusto.';
  if (/qui[eé]n eres|que eres|qu[eé] eres/.test(t)) {
    return 'Soy ELYRA, operadora de tu PC y del laboratorio. Puedo controlar Windows y apoyarte con cacao, cadmio y AFQ.';
  }
  return 'Puedo abrir apps, usar teclado y mouse, ejecutar comandos, manejar archivos y apoyar el laboratorio. Dime qué necesitas.';
}

function normalizeUserIntent(text) {
  return String(text || '')
    .replace(/\belira\b/gi, 'elyra')
    .replace(/\beliara\b/gi, 'elyra')
    .replace(/\bcrhome\b/gi, 'chrome')
    .replace(/\bwork\b/gi, 'word')
    .trim();
}

async function callLLM(messages, config, model) {
  const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
  const url = baseUrl + '/chat/completions';
  const body = {
    model: model || config.model || MODEL_FAST,
    messages,
    temperature: 0.4,
    max_tokens: 1400,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: llmHeaders(config),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error('LLM ' + res.status + ': ' + errText.slice(0, 280));
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  return { content, raw: data };
}

async function testApiConnection(partial) {
  try {
    const config = { ...getConfig(), ...(partial || {}) };
    if (!config.apiKey) return { ok: false, message: 'Falta la API key.' };
    const provider = inferProvider(config);
    let model = config.model;
    if (!model) {
      if (provider === 'gemini') model = GEMINI_MODEL;
      else if (provider === 'nvidia') model = NVIDIA_MODEL;
      else model = MODEL_FAST;
    }
    const result = await callLLM(
      [
        { role: 'system', content: 'Responde solo: ok' },
        { role: 'user', content: 'ping' },
      ],
      config,
      model,
    );
    return {
      ok: true,
      message: 'Conexión correcta · ' + providerLabel(provider) + ' · ' + model,
      model,
      baseUrl: config.baseUrl,
      provider,
      sample: (result.content || '').slice(0, 80),
    };
  } catch (err) {
    return {
      ok: false,
      message: 'No se pudo conectar: ' + (err.message || String(err)),
      error: String(err),
    };
  }
}

function runOneTool(name, args, helpers) {
  const tool = { name, params: args || {} };
  if (hooks.extendExecute) {
    return hooks.extendExecute(name, args, helpers, (n, p, h) =>
      executeTool({ name: n, params: p || {} }, h),
    );
  }
  return executeTool(tool, helpers);
}

async function runAgent(message, history, helpers) {
  const config = getConfig();
  const cleanedUser = normalizeUserIntent(message);
  if (!config.apiKey) {
    return { response: fallbackResponse(cleanedUser), intelligent: false, via: 'no-key' };
  }

  const systemContent = hooks.enrichSystemPrompt
    ? hooks.enrichSystemPrompt(SYSTEM_PROMPT, cleanedUser)
    : SYSTEM_PROMPT + '\n\n' + (typeof toolsPromptSummary === 'function' ? toolsPromptSummary() : '');

  const messages = [{ role: 'system', content: systemContent }];
  const hist = Array.isArray(history) ? history.slice(-16) : [];
  for (const h of hist) {
    const role = h.role === 'elyra' || h.role === 'assistant' ? 'assistant' : 'user';
    const content = (h.text || h.content || '').trim();
    if (content) messages.push({ role, content });
  }
  messages.push({ role: 'user', content: cleanedUser });

  let model = selectModel(config, cleanedUser);
  const tools = TOOL_DEFINITIONS || [];
  const provider = inferProvider(config);
  const wantsTools =
    /\b(abre|abrir|cierra|cerrar|busca|buscar|pon|reproduce|archivo|excel|pdf|captura|volumen|carpeta|google|youtube|recuerda|analiza|guarda|escribe|crea|genera|ejecuta|comando|powershell|proceso|ventana|minimiza|bloquea|clic|click|tecla|hotkey|mouse|copia|pega|apaga|reinicia|lista|muestra|mata|kill|shell|cmd|instala|descarga)\b/i.test(
      cleanedUser,
    );

  try {
    let reply = '';
    let steps = 0;
    const maxSteps = 16;
    let currentMessages = messages.slice();
    let usedTools = false;

    while (steps < maxSteps) {
      steps += 1;
      const body = {
        model,
        messages: currentMessages,
        temperature: wantsTools || steps > 1 ? 0.2 : 0.35,
        max_tokens: 1800,
      };
      if (tools.length) {
        body.tools = tools;
        body.tool_choice = wantsTools && steps === 1 ? 'auto' : 'auto';
      }

      const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
      const res = await fetch(baseUrl + '/chat/completions', {
        method: 'POST',
        headers: llmHeaders(config),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        if (
          steps === 1 &&
          provider !== 'gemini' &&
          provider !== 'nvidia' &&
          model !== MODEL_FAST
        ) {
          model = MODEL_FAST;
          continue;
        }
        throw new Error('LLM ' + res.status + ' ' + errText.slice(0, 220));
      }

      const data = await res.json();
      const choice = data.choices?.[0]?.message || {};
      const toolCalls = choice.tool_calls || [];

      if (toolCalls.length && helpers) {
        usedTools = true;
        currentMessages.push(choice);
        for (const tc of toolCalls) {
          const name = tc.function?.name || tc.name;
          let args = {};
          try {
            args = JSON.parse(tc.function?.arguments || '{}');
          } catch {
            args = {};
          }
          let toolResult;
          try {
            toolResult = await runOneTool(name, args, helpers);
          } catch (err) {
            toolResult = { ok: false, error: err.message || String(err) };
          }
          currentMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(toolResult).slice(0, 8000),
          });
        }
        continue;
      }

      reply = (choice.content || '').trim();
      if (
        steps < maxSteps &&
        !usedTools &&
        provider !== 'gemini' &&
        provider !== 'nvidia' &&
        model !== MODEL_SMART &&
        (!reply || reply.length < 12 || /no puedo|no sé|no se|as an ai|como ia|no tengo acceso/i.test(reply))
      ) {
        model = MODEL_SMART;
        currentMessages = messages.slice();
        continue;
      }
      break;
    }

    if (!reply) reply = fallbackResponse(cleanedUser);
    reply = reply
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\*\*?/g, '')
      .replace(/^#+\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

    try {
      if (hooks.noteInteraction) hooks.noteInteraction(cleanedUser, reply);
    } catch {}

    return { response: reply, intelligent: true, via: 'agent-v16', model, steps, usedTools };
  } catch (err) {
    return {
      response:
        'Tuve un problema al razonar: ' +
        (err.message || 'error') +
        '. Puedo reintentar o usar control local del PC.',
      intelligent: false,
      via: 'agent-error',
    };
  }
}

module.exports = {
  runAgent,
  getConfig,
  saveConfig,
  fallbackResponse,
  callLLM,
  ensureDefaultConfig,
  normalizeUserIntent,
  testApiConnection,
  detectProviderFromKey,
  SYSTEM_PROMPT,
  MODEL_FAST,
  MODEL_SMART,
  MODEL_CHAIN: MODEL_CHAIN_GROQ,
  GEMINI_BASE,
  GEMINI_MODEL,
  NVIDIA_BASE,
  NVIDIA_MODEL,
};
