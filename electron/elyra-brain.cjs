/**
 * ELYRA Brain 1.8 — inteligencia local sin API key de nube
 *
 * No es un LLM entrenado desde cero (eso requiere GPU, datasets y semanas).
 * Es un cerebro híbrido propio de ELYRA:
 *  1) Clasificación de intención
 *  2) Hechos / math / fecha locales
 *  3) Recuperación web multi-fuente (Wiki + DDG)
 *  4) Síntesis conversacional en español
 *  5) Ollama opcional si el usuario lo instaló
 *
 * Objetivo: responder como asistente útil sin depender de OpenAI/Groq/Gemini.
 */

const { deepWebSearch } = require('./web-search-boost.cjs');
const { smartKnowledge } = require('./smart-knowledge.cjs');
const { tryLocalMath } = require('./local-math.cjs');

const OLLAMA_URL = 'http://127.0.0.1:11434';
const OLLAMA_MODELS = ['llama3.2', 'llama3.1', 'llama3', 'mistral', 'qwen2.5', 'phi3', 'gemma2', 'tinyllama'];

let ollamaCache = null;
let ollamaAt = 0;

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyIntent(text) {
  const t = norm(text);
  if (!t) return 'empty';
  if (/^(hola|hey|buenas|buenos dias|buenas tardes|buenas noches|que tal|qué tal)\b/.test(t))
    return 'greeting';
  if (/quien eres|que eres|pres[eé]ntate|tu nombre/.test(t)) return 'identity';
  if (/que puedes|capacidades|como me ayudas|que sabes hacer/.test(t)) return 'capabilities';
  if (/sin api|sin clave|sin key|funcionas sin|necesitas api/.test(t)) return 'nokey';
  if (/que hora|hora es|que dia|fecha de hoy|que fecha/.test(t)) return 'datetime';
  if (tryLocalMath(text)) return 'math';
  if (/\b(abre|abrir|cierra|volumen|brillo|captura|minimiza|apaga|reinicia|chrome|excel|word)\b/.test(t))
    return 'pc';
  if (/\b(explica|como funciona|por que|porque|diferencia entre|ventajas|desventajas)\b/.test(t))
    return 'explain';
  if (/\b(que es|que son|quien es|quien fue|que fue|define|definición|definicion)\b/.test(t))
    return 'define';
  if (/\b(busca|investiga|noticias|actualidad|dime sobre|cuentame|cuéntame)\b/.test(t))
    return 'research';
  if (/\b(consejo|recomienda|deberia|qué hago|que hago)\b/.test(t)) return 'advice';
  if (t.split(' ').length >= 2) return 'general';
  return 'general';
}

function speakify(text) {
  let t = String(text || '')
    .replace(/\*\*?/g, '')
    .replace(/^#+\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > 780) {
    const cut = t.slice(0, 760);
    const last = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('?'));
    t = last > 200 ? cut.slice(0, last + 1) : cut + '…';
  }
  return t;
}

function conversationalWrap(facts, intent, query) {
  const body = speakify(facts);
  if (!body) return null;

  if (intent === 'define') {
    if (/^es un |^es una |^se trata/i.test(body)) return body;
    return body;
  }
  if (intent === 'explain') {
    return body.endsWith('.') ? body : body + '.';
  }
  if (intent === 'research') {
    return body;
  }
  // general: ligera naturalidad
  return body;
}

function localFacts(text) {
  const t = norm(text);

  if (/quien eres|que eres|presentate/.test(t)) {
    return (
      'Soy ELYRA, tu asistente de escritorio. Razono en local, busco en internet y controlo el PC ' +
      'sin depender de una API de pago. Si instalas Ollama, uso un modelo local más potente.'
    );
  }
  if (/que puedes|capacidades|como me ayudas/.test(t)) {
    return (
      'Puedo conversar, explicar temas, buscar en la web, calcular, recordar datos, abrir programas, ' +
      'controlar volumen y ventanas, y analizar documentos. Dime qué necesitas.'
    );
  }
  if (/sin api|sin clave|sin key|funcionas sin/.test(t)) {
    return (
      'Sí: sin API key sigo inteligente con búsqueda web, cálculos, memoria y control del PC. ' +
      'Para razonamiento offline más fuerte: instala Ollama y ejecuta ollama pull llama3.2.'
    );
  }
  if (/que hora|hora es/.test(t)) {
    return (
      'Son las ' +
      new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) +
      '.'
    );
  }
  if (/que dia|fecha de hoy|que fecha/.test(t)) {
    return (
      'Hoy es ' +
      new Date().toLocaleDateString('es-PE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }) +
      '.'
    );
  }
  if (/hola|buenas|hey|que tal/.test(t) && t.split(' ').length <= 4) {
    const opts = [
      'Hola. Dime en qué te ayudo.',
      'Hola, te escucho.',
      'Buenas. ¿Qué necesitas?',
    ];
    return opts[Math.floor(Math.random() * opts.length)];
  }

  const math = tryLocalMath(text);
  if (math) return math;

  return null;
}

async function detectOllama() {
  if (ollamaCache && Date.now() - ollamaAt < 45000) return ollamaCache;
  ollamaAt = Date.now();
  try {
    const res = await fetch(OLLAMA_URL + '/api/tags', { signal: AbortSignal.timeout(2000) });
    if (!res.ok) {
      ollamaCache = { ok: false };
      return ollamaCache;
    }
    const data = await res.json();
    const names = (data.models || []).map((m) => (m.name || m.model || '').toLowerCase());
    let chosen = null;
    for (const pref of OLLAMA_MODELS) {
      const hit = names.find((n) => n.startsWith(pref));
      if (hit) {
        chosen = hit;
        break;
      }
    }
    if (!chosen && names[0]) chosen = names[0];
    ollamaCache = chosen ? { ok: true, model: chosen } : { ok: false };
    return ollamaCache;
  } catch {
    ollamaCache = { ok: false };
    return ollamaCache;
  }
}

async function askOllama(userText, history, webContext) {
  const st = await detectOllama();
  if (!st.ok) return null;

  const system =
    'Eres ELYRA, asistente de voz de escritorio en español. Responde claro, natural y breve. ' +
    'Sin markdown ni listas largas. Nunca digas que te llamas Luna. ' +
    (webContext ? 'Usa estos datos verificados si ayudan: ' + webContext.slice(0, 1200) : '');

  const messages = [{ role: 'system', content: system }];
  const hist = Array.isArray(history) ? history.slice(-6) : [];
  for (const h of hist) {
    const role = h.role === 'elyra' || h.role === 'assistant' ? 'assistant' : 'user';
    const content = (h.text || h.content || '').trim().slice(0, 600);
    if (content) messages.push({ role, content });
  }
  messages.push({ role: 'user', content: String(userText).slice(0, 1800) });

  try {
    const res = await fetch(OLLAMA_URL + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: st.model,
        messages,
        stream: false,
        options: { temperature: 0.35, num_predict: 450 },
      }),
      signal: AbortSignal.timeout(55000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = speakify(data.message?.content || data.response || '');
    if (!content || content.length < 2) return null;
    return { ok: true, response: content, via: 'brain-ollama:' + st.model, intelligent: true };
  } catch {
    return null;
  }
}

async function retrieveKnowledge(query) {
  const candidates = [];
  try {
    const deep = await deepWebSearch(query);
    if (deep.ok && deep.response) {
      candidates.push({ text: deep.response, score: 2, source: deep.source || 'web' });
    }
  } catch {}
  try {
    const sk = await smartKnowledge(query);
    if (sk.ok && sk.response) {
      candidates.push({ text: sk.response, score: 1.8, source: sk.source || 'wiki' });
    }
  } catch {}
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

/**
 * Entrada principal del cerebro ELYRA (sin API key cloud LLM)
 */
async function think(userText, history) {
  const text = String(userText || '').trim();
  if (!text) {
    return { ok: true, response: 'Te escucho. ¿En qué te ayudo?', via: 'brain-empty', intelligent: true };
  }

  const intent = classifyIntent(text);

  // Hechos locales inmediatos
  const local = localFacts(text);
  if (local) {
    return { ok: true, response: local, via: 'brain-local:' + intent, intelligent: true };
  }

  // PC intents: dejar que el router de chat maneje (devolver null-ish señal)
  if (intent === 'pc') {
    return { ok: false, response: '', via: 'brain-defer-pc' };
  }

  // Recuperar conocimiento de internet (sin API LLM)
  let knowledge = null;
  if (['define', 'explain', 'research', 'general', 'advice'].includes(intent)) {
    knowledge = await retrieveKnowledge(text);
  }

  // Si hay Ollama: razonar con contexto web
  const ollama = await askOllama(text, history, knowledge && knowledge.text);
  if (ollama) return ollama;

  // Síntesis local a partir de la web
  if (knowledge && knowledge.text) {
    const answer = conversationalWrap(knowledge.text, intent, text);
    if (answer) {
      return {
        ok: true,
        response: answer,
        via: 'brain-web:' + (knowledge.source || 'net'),
        intelligent: true,
      };
    }
  }

  // Último intento: cualquier búsqueda
  try {
    const deep = await deepWebSearch(text);
    if (deep.ok && deep.response) {
      return {
        ok: true,
        response: speakify(deep.response),
        via: 'brain-web-fallback',
        intelligent: true,
      };
    }
  } catch {}

  return {
    ok: true,
    response:
      'Entendí tu pregunta. Sin un modelo local (Ollama) ni clave de nube, ' +
      'puedo controlar el PC y buscar en internet. Prueba preguntarme “qué es…” o “explica…”. ' +
      'Para más inteligencia offline: ollama pull llama3.2',
    via: 'brain-soft-fallback',
    intelligent: true,
  };
}

async function brainStatus() {
  const ol = await detectOllama();
  return {
    name: 'ELYRA Brain',
    version: '1.8',
    ollama: !!ol.ok,
    ollamaModel: ol.model || null,
    web: true,
    math: true,
    mode: 'hybrid-local-web',
  };
}

module.exports = {
  think,
  brainStatus,
  classifyIntent,
  detectOllama,
  askOllama,
};
