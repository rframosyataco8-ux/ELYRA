/**
 * Motor de inteligencia LOCAL ELYRA 1.11
 * Brain + contexto de conversación + web
 */
const brain = require('./elyra-brain.cjs');
const ctx = require('./conversation-context.cjs');
const { deepWebSearch } = require('./web-search-boost.cjs');
const { smartKnowledge } = require('./smart-knowledge.cjs');
const { tryLocalMath } = require('./local-math.cjs');

async function runLocalIntelligence(userText, history) {
  const text = String(userText || '').trim();
  if (!text) return { ok: true, response: 'Te escucho.', via: 'local-empty' };

  ctx.noteUser(text);
  const expanded = ctx.expandFollowUp(text);
  const hist = (history && history.length ? history : ctx.historyForBrain()).slice(-10);

  // Nombre del usuario en saludos
  const name = ctx.getFact('user_name');
  if (/^(hola|buenas|hey|que tal)\b/i.test(text) && text.split(/\s+/).length <= 4 && name) {
    const r = { ok: true, response: 'Hola, ' + name + '. ¿En qué te ayudo?', via: 'ctx-greet', intelligent: true };
    ctx.noteAssistant(r.response);
    return r;
  }

  try {
    const result = await brain.think(expanded, hist);
    if (result && result.ok && result.response) {
      ctx.noteAssistant(result.response);
      return result;
    }
    if (result && result.via === 'brain-defer-pc') {
      return { ok: false, response: '', via: 'local-defer-pc' };
    }
  } catch {}

  const math = tryLocalMath(text);
  if (math) {
    ctx.noteAssistant(math);
    return { ok: true, response: math, via: 'local-math', intelligent: true };
  }

  try {
    const deep = await deepWebSearch(expanded);
    if (deep.ok && deep.response) {
      ctx.noteAssistant(deep.response);
      return { ok: true, response: deep.response, via: 'local-web', intelligent: true };
    }
    const sk = await smartKnowledge(expanded);
    if (sk.ok && sk.response) {
      ctx.noteAssistant(sk.response);
      return { ok: true, response: sk.response, via: 'local-wiki', intelligent: true };
    }
  } catch {}

  const fallback =
    'Puedo buscar en internet y controlar el PC sin API key. ' +
    'Prueba «qué es…» o un comando del sistema. Opcional: ollama pull llama3.2';
  ctx.noteAssistant(fallback);
  return { ok: true, response: fallback, via: 'local-fallback', intelligent: true };
}

async function localStatus() {
  const b = await brain.brainStatus();
  return { ...b, conversation: ctx.status() };
}

async function detectOllama() {
  return brain.detectOllama();
}

async function askOllama(userText, history) {
  return brain.askOllama(userText, history, ctx.contextBlock());
}

module.exports = {
  runLocalIntelligence,
  detectOllama,
  localStatus,
  askOllama,
};
