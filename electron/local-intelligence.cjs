/**
 * Motor de inteligencia LOCAL de ELYRA — delega en ELYRA Brain 1.8
 * Sin API key de nube. Compatible con chat-router y agent.
 */
const brain = require('./elyra-brain.cjs');
const { deepWebSearch } = require('./web-search-boost.cjs');
const { smartKnowledge } = require('./smart-knowledge.cjs');
const { tryLocalMath } = require('./local-math.cjs');

async function runLocalIntelligence(userText, history) {
  try {
    const result = await brain.think(userText, history);
    if (result && result.ok && result.response) return result;
    // Si el brain deferió (PC), intentar web genérica
    if (result && result.via === 'brain-defer-pc') {
      return {
        ok: false,
        response: '',
        via: 'local-defer-pc',
      };
    }
  } catch (e) {
    // fallback legacy
  }

  const text = String(userText || '').trim();
  if (!text) return { ok: true, response: 'Te escucho.', via: 'local-empty' };

  const math = tryLocalMath(text);
  if (math) return { ok: true, response: math, via: 'local-math', intelligent: true };

  try {
    const deep = await deepWebSearch(text);
    if (deep.ok && deep.response) {
      return { ok: true, response: deep.response, via: 'local-web', intelligent: true };
    }
    const sk = await smartKnowledge(text);
    if (sk.ok && sk.response) {
      return { ok: true, response: sk.response, via: 'local-wiki', intelligent: true };
    }
  } catch {}

  return {
    ok: true,
    response:
      'Puedo buscar en internet y controlar el PC sin API key. ' +
      'Para un modelo local más fuerte: ollama pull llama3.2',
    via: 'local-fallback',
    intelligent: true,
  };
}

async function localStatus() {
  return brain.brainStatus();
}

async function detectOllama() {
  return brain.detectOllama();
}

async function askOllama(userText, history) {
  return brain.askOllama(userText, history, null);
}

module.exports = {
  runLocalIntelligence,
  detectOllama,
  localStatus,
  askOllama,
};
