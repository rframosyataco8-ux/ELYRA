/**
 * Motor de inteligencia LOCAL de ELYRA (sin API key de pago)
 *
 * Capas (en orden):
 * 1) Respuestas estructuradas / identidad / capacidades
 * 2) Matemáticas y hechos locales
 * 3) Ollama local (si está instalado en :11434)
 * 4) Búsqueda web profunda (Wikipedia + DDG) — no requiere API key LLM
 *
 * Honestidad: esto NO es un modelo entrenado al nivel Claude/GPT.
 * Es un sistema autónomo offline/híbrido lo más capaz posible sin clave de nube.
 */
const { deepWebSearch } = require('./web-search-boost.cjs');
const { smartKnowledge } = require('./smart-knowledge.cjs');
const { tryLocalMath } = require('./local-math.cjs');

const OLLAMA_URL = 'http://127.0.0.1:11434';
const OLLAMA_MODELS_PREFER = [
  'llama3.2',
  'llama3.1',
  'llama3',
  'mistral',
  'qwen2.5',
  'phi3',
  'gemma2',
];

let ollamaStatus = null; // { ok, model } | { ok: false }
let ollamaCheckedAt = 0;

async function detectOllama() {
  if (ollamaStatus && Date.now() - ollamaCheckedAt < 60000) return ollamaStatus;
  ollamaCheckedAt = Date.now();
  try {
    const res = await fetch(OLLAMA_URL + '/api/tags', {
      method: 'GET',
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      ollamaStatus = { ok: false };
      return ollamaStatus;
    }
    const data = await res.json();
    const names = (data.models || []).map((m) => m.name || m.model || '');
    let chosen = null;
    for (const pref of OLLAMA_MODELS_PREFER) {
      const hit = names.find((n) => n.toLowerCase().startsWith(pref));
      if (hit) {
        chosen = hit;
        break;
      }
    }
    if (!chosen && names[0]) chosen = names[0];
    ollamaStatus = chosen ? { ok: true, model: chosen, models: names } : { ok: false };
    return ollamaStatus;
  } catch {
    ollamaStatus = { ok: false };
    return ollamaStatus;
  }
}

async function askOllama(userText, history) {
  const st = await detectOllama();
  if (!st.ok) return null;

  const messages = [
    {
      role: 'system',
      content:
        'Eres ELYRA, asistente de voz de escritorio en español. Responde claro, breve y útil. ' +
        'Sin markdown. Si no sabes un hecho actual, dilo. Nunca digas que te llamas Luna.',
    },
  ];
  const hist = Array.isArray(history) ? history.slice(-8) : [];
  for (const h of hist) {
    const role = h.role === 'elyra' || h.role === 'assistant' ? 'assistant' : 'user';
    const content = (h.text || h.content || '').trim();
    if (content) messages.push({ role, content: content.slice(0, 800) });
  }
  messages.push({ role: 'user', content: String(userText).slice(0, 2000) });

  try {
    const res = await fetch(OLLAMA_URL + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: st.model,
        messages,
        stream: false,
        options: { temperature: 0.4, num_predict: 400 },
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = (data.message?.content || data.response || '').trim();
    if (!content || content.length < 2) return null;
    return {
      ok: true,
      response: content.replace(/\*\*?/g, '').replace(/^#+\s+/gm, '').replace(/\s+/g, ' ').trim(),
      via: 'ollama:' + st.model,
      intelligent: true,
    };
  } catch {
    return null;
  }
}

function localStructured(text) {
  const t = String(text || '').toLowerCase().trim();

  if (/qui[eé]n eres|que eres|qu[eé] eres|pres[eé]ntate/.test(t)) {
    return {
      ok: true,
      response:
        'Soy ELYRA. Asistente de voz de tu escritorio. Controlo el PC, busco en internet y razono en local sin depender siempre de una API de pago. ¿En qué te ayudo?',
      via: 'local-identity',
    };
  }

  if (/qu[eé] puedes hacer|capacidades|c[oó]mo me ayudas/.test(t)) {
    return {
      ok: true,
      response:
        'Puedo abrir apps y carpetas, controlar volumen y ventanas, calcular, recordar datos, buscar en internet y, si tienes Ollama instalado, razonar con un modelo local. ¿Qué necesitas?',
      via: 'local-caps',
    };
  }

  if (/tienes (api|clave|key)|sin (api|clave|key)|funcionas sin/.test(t)) {
    return {
      ok: true,
      response:
        'Sí. Sin API key puedo controlar el PC, calcular, usar memoria y buscar información en internet. Si instalas Ollama con un modelo local, también razono offline con ese modelo.',
      via: 'local-nokey',
    };
  }

  return null;
}

function looksKnowledge(t) {
  return /\b(qué|que|quién|quien|cómo|como|por qué|porque|cuándo|cuando|dónde|donde|explica|cuéntame|historia|guerra|significa|inventó|invento)\b/i.test(
    t,
  );
}

/**
 * Punto de entrada: inteligencia sin API key de nube
 */
async function runLocalIntelligence(userText, history) {
  const text = String(userText || '').trim();
  if (!text) {
    return { ok: true, response: 'Te escucho. ¿Qué necesitas?', via: 'local-empty' };
  }

  // 1) Estructurado
  const structured = localStructured(text);
  if (structured) return structured;

  // 2) Matemáticas
  const math = tryLocalMath(text);
  if (math) return { ok: true, response: math, via: 'local-math', intelligent: true };

  // 3) Ollama (modelo local real)
  const ollama = await askOllama(text, history);
  if (ollama) return ollama;

  // 4) Web (no necesita API key LLM)
  if (looksKnowledge(text) || text.split(/\s+/).length >= 3) {
    try {
      const deep = await deepWebSearch(text);
      if (deep.ok && deep.response) {
        return {
          ok: true,
          response: deep.response,
          via: 'local-web:' + (deep.source || 'deep'),
          intelligent: true,
        };
      }
      const sk = await smartKnowledge(text);
      if (sk.ok && sk.response) {
        return {
          ok: true,
          response: sk.response,
          via: 'local-wiki',
          intelligent: true,
        };
      }
    } catch {}
  }

  return {
    ok: true,
    response:
      'Puedo ayudarte con el PC, cálculos y búsquedas en internet. ' +
      'Para razonar más profundo offline, instala Ollama y un modelo (por ejemplo: ollama pull llama3.2). ' +
      '¿Qué quieres hacer?',
    via: 'local-fallback',
    intelligent: false,
  };
}

async function localStatus() {
  const ol = await detectOllama();
  return {
    ollama: !!ol.ok,
    ollamaModel: ol.model || null,
    web: true,
    math: true,
    mode: 'local-intelligence-v1',
  };
}

module.exports = {
  runLocalIntelligence,
  detectOllama,
  localStatus,
  askOllama,
};
