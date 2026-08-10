/**
 * ELYRA Brain 1.9 — inteligencia local sin API key (v2)
 *
 * Mejoras vs 1.8:
 *  - Resolución de follow-ups («y eso?», «más detalles», «por qué»)
 *  - Fusión multi-fuente (wiki + web + RAG documentos)
 *  - Respuestas más estructuradas y naturales en español
 *  - Memoria corta de tema de conversación
 *  - Ollama con más contexto
 */

const { deepWebSearch } = require('./web-search-boost.cjs');
const { smartKnowledge } = require('./smart-knowledge.cjs');
const { tryLocalMath } = require('./local-math.cjs');

const OLLAMA_URL = 'http://127.0.0.1:11434';
const OLLAMA_MODELS = [
  'llama3.2',
  'llama3.1',
  'llama3',
  'mistral',
  'qwen2.5',
  'phi3',
  'gemma2',
  'tinyllama',
];

let ollamaCache = null;
let ollamaAt = 0;
/** Memoria corta de sesión (tema actual) */
let sessionTopic = null;
let sessionLastAnswer = null;

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function speakify(text) {
  let t = String(text || '')
    .replace(/\*\*?/g, '')
    .replace(/^#+\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > 900) {
    const cut = t.slice(0, 870);
    const last = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('?'));
    t = last > 220 ? cut.slice(0, last + 1) : cut + '…';
  }
  return t;
}

function isFollowUp(text) {
  const t = norm(text);
  if (t.length < 2) return true;
  return /^(y eso|y eso que|mas|más|mas detalles|más detalles|continua|continúa|sigue|por que|porque|y por que|explicalo|explícalo|resumelo|resúmelo|mas info|más info|y luego|que mas|qué más|ok y|si y|dime mas|dime más)$/i.test(
    t,
  ) || /^(y |entonces |pero )/.test(t) && t.split(' ').length <= 6;
}

function expandWithHistory(text, history) {
  const raw = String(text || '').trim();
  if (!isFollowUp(raw) && !/\b(eso|esto|aquello|lo mismo|el tema)\b/i.test(raw)) {
    return raw;
  }
  // Usar tema de sesión o último mensaje del usuario con sustancia
  if (sessionTopic && isFollowUp(raw)) {
    if (/por que|porque/.test(norm(raw))) return 'por qué ' + sessionTopic;
    if (/mas|más|detalle/.test(norm(raw))) return sessionTopic + ' más detalles';
    if (/resum/.test(norm(raw))) return 'resume ' + sessionTopic;
    return sessionTopic + ' ' + raw;
  }
  const hist = Array.isArray(history) ? history : [];
  for (let i = hist.length - 1; i >= 0; i--) {
    const h = hist[i];
    const role = h.role === 'elyra' || h.role === 'assistant' ? 'assistant' : 'user';
    const content = (h.text || h.content || '').trim();
    if (role === 'user' && content.length > 8 && !isFollowUp(content)) {
      if (isFollowUp(raw)) return content + ' — ' + raw;
      return raw.replace(/\b(eso|esto|aquello)\b/gi, content);
    }
  }
  if (sessionTopic) return sessionTopic + ' ' + raw;
  return raw;
}

function extractTopic(text) {
  let t = String(text || '')
    .replace(/^(oye|hey|elyra|por favor|porfa)\s+/i, '')
    .replace(
      /^(dime|cuéntame|cuentame|explícame|explicame|busca|buscar|investiga|qué es|que es|quién es|quien es|qué fue|que fue)\s+/i,
      '',
    )
    .replace(/^(sobre|de|acerca de)\s+/i, '')
    .replace(/[¿?¡!]+/g, '')
    .trim();
  if (t.length > 120) t = t.slice(0, 120);
  return t || null;
}

function classifyIntent(text) {
  const t = norm(text);
  if (!t) return 'empty';
  if (/^(hola|hey|buenas|buenos dias|buenas tardes|buenas noches|que tal)\b/.test(t)) return 'greeting';
  if (/quien eres|que eres|presentate|tu nombre/.test(t)) return 'identity';
  if (/que puedes|capacidades|como me ayudas|que sabes hacer/.test(t)) return 'capabilities';
  if (/sin api|sin clave|sin key|funcionas sin|necesitas api/.test(t)) return 'nokey';
  if (/que hora|hora es|que dia|fecha de hoy|que fecha/.test(t)) return 'datetime';
  if (tryLocalMath(text)) return 'math';
  if (/\b(abre|abrir|cierra|volumen|brillo|captura|minimiza|apaga|reinicia)\b/.test(t)) return 'pc';
  if (/\b(compara|diferencia entre|versus|vs\b)\b/.test(t)) return 'compare';
  if (/\b(como se|cómo se|como hacer|cómo hacer|pasos para|tutorial)\b/.test(t)) return 'howto';
  if (/\b(explica|como funciona|por que|porque|ventajas|desventajas)\b/.test(t)) return 'explain';
  if (/\b(que es|que son|quien es|quien fue|que fue|define|definición)\b/.test(t)) return 'define';
  if (/\b(busca|investiga|noticias|actualidad|dime sobre|cuentame)\b/.test(t)) return 'research';
  if (/\b(consejo|recomienda|deberia|qué hago|que hago)\b/.test(t)) return 'advice';
  if (/\b(documento|informe|pdf|mis archivos|según el|protocolo)\b/.test(t)) return 'docs';
  return 'general';
}

function localFacts(text) {
  const t = norm(text);

  if (/quien eres|que eres|presentate/.test(t)) {
    return (
      'Soy ELYRA. Razono en local, busco en internet, uso tus documentos si están indexados ' +
      'y controlo el PC sin API de pago. Con Ollama gano más profundidad. ¿Qué necesitas?'
    );
  }
  if (/que puedes|capacidades|como me ayudas/.test(t)) {
    return (
      'Puedo explicar temas, comparar ideas, buscar en la web, leer fragmentos de tus documentos, ' +
      'calcular, recordar datos y manejar el PC. Pregunta con naturalidad.'
    );
  }
  if (/sin api|sin clave|sin key|funcionas sin/.test(t)) {
    return (
      'Sí. Sin API key uso mi cerebro local: web, documentos, cálculos y control del sistema. ' +
      'Opcional: ollama pull llama3.2 para un modelo local más fuerte.'
    );
  }
  if (/que hora|hora es/.test(t)) {
    return 'Son las ' + new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) + '.';
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
    const opts = ['Hola. Dime en qué te ayudo.', 'Hola, te escucho.', 'Buenas. ¿Qué hacemos?'];
    return opts[Math.floor(Math.random() * opts.length)];
  }
  const math = tryLocalMath(text);
  if (math) return math;
  return null;
}

function mergeSources(parts, intent) {
  const cleaned = parts
    .map((p) => speakify(p))
    .filter((p) => p && p.length > 40);
  if (!cleaned.length) return null;

  // Dedup por inicio similar
  const uniq = [];
  for (const p of cleaned) {
    if (uniq.some((u) => u.slice(0, 60) === p.slice(0, 60))) continue;
    uniq.push(p);
  }

  let body = uniq[0];
  if (uniq[1] && body.length < 420) {
    const extra = uniq[1];
    // Añadir frase complementaria si aporta
    if (!body.includes(extra.slice(0, 40))) {
      const sentence = extra.split(/(?<=\.)\s+/).find((s) => s.length > 40 && !body.includes(s.slice(0, 30)));
      if (sentence) body = body + ' ' + sentence;
    }
  }

  if (intent === 'howto' && !/paso|primero|debes|puedes/i.test(body)) {
    body = body;
  }
  if (intent === 'compare' && uniq[1]) {
    body = uniq[0].slice(0, 400) + ' Por otro lado, ' + uniq[1].slice(0, 350);
  }

  return speakify(body);
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

async function askOllama(userText, history, contextBlock) {
  const st = await detectOllama();
  if (!st.ok) return null;

  const system =
    'Eres ELYRA, asistente de voz de escritorio en español peruano/latino. ' +
    'Responde claro, natural, útil y relativamente breve (máx ~120 palabras salvo que pidan detalle). ' +
    'Sin markdown. Nunca digas que te llamas Luna. Si el contexto aporta datos, úsalos; no inventes cifras. ' +
    (contextBlock ? '\n\nContexto disponible:\n' + contextBlock.slice(0, 2200) : '');

  const messages = [{ role: 'system', content: system }];
  const hist = Array.isArray(history) ? history.slice(-8) : [];
  for (const h of hist) {
    const role = h.role === 'elyra' || h.role === 'assistant' ? 'assistant' : 'user';
    const content = (h.text || h.content || '').trim().slice(0, 700);
    if (content) messages.push({ role, content });
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
        options: { temperature: 0.32, num_predict: 500 },
      }),
      signal: AbortSignal.timeout(60000),
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

async function retrieveAll(query, intent) {
  const parts = [];
  const sources = [];

  // Parallel-ish sequential with timeouts handled inside modules
  try {
    const deep = await deepWebSearch(query);
    if (deep.ok && deep.response) {
      parts.push(deep.response);
      sources.push(deep.source || 'web');
    }
  } catch {}

  try {
    const sk = await smartKnowledge(query);
    if (sk.ok && sk.response) {
      parts.push(sk.response);
      sources.push(sk.source || 'wiki');
    }
  } catch {}

  // RAG local documentos
  try {
    const rag = require('./rag-local.cjs');
    if (intent === 'docs' || rag.looksLikeDocQuery(query) || parts.length === 0) {
      const block = rag.buildRagBlock(query);
      if (block) {
        parts.push(block.replace(/\[DOCUMENTOS LOCALES[\s\S]*?\]\n/, '').replace(/\[\/RAG\][\s\S]*/, ''));
        sources.push('rag');
      } else if (intent === 'docs') {
        const search = await rag.searchDocs(query, 4);
        if (search.ok && search.hits && search.hits.length) {
          parts.push(search.hits.map((h) => h.excerpt).join(' '));
          sources.push('rag');
        }
      }
    }
  } catch {}

  return { parts, sources };
}

async function think(userText, history) {
  const original = String(userText || '').trim();
  if (!original) {
    return { ok: true, response: 'Te escucho. ¿En qué te ayudo?', via: 'brain-empty', intelligent: true };
  }

  const expanded = expandWithHistory(original, history);
  const intent = classifyIntent(expanded);

  const local = localFacts(original) || (expanded !== original ? localFacts(expanded) : null);
  if (local) {
    sessionLastAnswer = local;
    return { ok: true, response: local, via: 'brain-local:' + intent, intelligent: true };
  }

  if (intent === 'pc') {
    return { ok: false, response: '', via: 'brain-defer-pc' };
  }

  const topic = extractTopic(expanded);
  if (topic && topic.length > 2) sessionTopic = topic;

  const { parts, sources } = await retrieveAll(expanded, intent);
  const merged = mergeSources(parts, intent);
  const contextBlock = parts.join('\n---\n').slice(0, 2400);

  // Ollama primero si existe (mejor calidad)
  const ollama = await askOllama(expanded, history, contextBlock);
  if (ollama) {
    sessionLastAnswer = ollama.response;
    return ollama;
  }

  if (merged) {
    let response = merged;
    // Toque conversacional según intención
    if (intent === 'define' && !/^(es |la |el |un |una )/i.test(response)) {
      /* leave as is — wiki usually starts well */
    }
    if (intent === 'advice' && response.length < 500) {
      response = response + ' Si quieres, dime tu caso concreto y lo afinamos.';
    }
    sessionLastAnswer = response;
    return {
      ok: true,
      response,
      via: 'brain-v2:' + (sources[0] || 'net'),
      intelligent: true,
      sources,
    };
  }

  // Follow-up sin datos nuevos: reusar última respuesta ampliada
  if (isFollowUp(original) && sessionLastAnswer) {
    return {
      ok: true,
      response:
        'Sobre eso: ' +
        speakify(sessionLastAnswer).slice(0, 500) +
        ' Si quieres otro ángulo, pregunta con más detalle.',
      via: 'brain-session',
      intelligent: true,
    };
  }

  return {
    ok: true,
    response:
      'No encontré un resumen sólido todavía. Reformula en una frase clara, por ejemplo ' +
      '“qué es X” o “explica Y”. También puedo controlar el PC. Para más potencia: ollama pull llama3.2',
    via: 'brain-soft-fallback',
    intelligent: true,
  };
}

async function brainStatus() {
  const ol = await detectOllama();
  let ragChunks = 0;
  try {
    ragChunks = require('./rag-local.cjs').indexStats().chunks || 0;
  } catch {}
  return {
    name: 'ELYRA Brain',
    version: '1.9',
    ollama: !!ol.ok,
    ollamaModel: ol.model || null,
    web: true,
    math: true,
    ragChunks,
    sessionTopic,
    mode: 'hybrid-local-web-rag-v2',
  };
}

module.exports = {
  think,
  brainStatus,
  classifyIntent,
  detectOllama,
  askOllama,
  expandWithHistory,
};
