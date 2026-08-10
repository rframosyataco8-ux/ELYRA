/**
 * Contexto conversacional de sesión — ELYRA 1.11
 * Recuerda últimos temas, preferencias ligeras y hechos dichos en la charla.
 */

const MAX_TURNS = 24;
const MAX_FACTS = 40;

let turns = [];
let facts = [];
let lastTopic = null;
let lastUser = null;
let lastAssistant = null;

function pushTurn(role, text) {
  const t = String(text || '').trim().slice(0, 800);
  if (!t) return;
  turns.push({ role, text: t, at: Date.now() });
  if (turns.length > MAX_TURNS) turns = turns.slice(-MAX_TURNS);
  if (role === 'user') lastUser = t;
  if (role === 'assistant') lastAssistant = t;
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
  if (t.length > 100) t = t.slice(0, 100);
  return t || null;
}

function noteUser(text) {
  pushTurn('user', text);
  const topic = extractTopic(text);
  if (topic && topic.split(' ').length >= 1) lastTopic = topic;

  // Hechos explícitos: "me llamo X", "mi nombre es", "trabajo en"
  const nameM = String(text).match(/\b(?:me llamo|mi nombre es|soy)\s+([A-Za-zÁÉÍÓÚáéíóúñÑ]{2,30})\b/i);
  if (nameM && !/elyra|luna|asistente/i.test(nameM[1])) {
    rememberFact('user_name', nameM[1]);
  }
  const workM = String(text).match(/\b(?:trabajo en|trabajo como|soy)\s+(.+?)(?:\.|$)/i);
  if (workM && workM[1].length < 60) {
    rememberFact('user_work', workM[1].trim());
  }
}

function noteAssistant(text) {
  pushTurn('assistant', text);
}

function rememberFact(key, value) {
  facts = facts.filter((f) => f.key !== key);
  facts.push({ key, value: String(value).slice(0, 200), at: Date.now() });
  if (facts.length > MAX_FACTS) facts = facts.slice(-MAX_FACTS);
}

function getFact(key) {
  const f = facts.find((x) => x.key === key);
  return f ? f.value : null;
}

function historyForBrain() {
  return turns.map((t) => ({
    role: t.role === 'assistant' ? 'elyra' : 'user',
    text: t.text,
  }));
}

function contextBlock() {
  const lines = [];
  if (lastTopic) lines.push('Tema reciente: ' + lastTopic);
  const name = getFact('user_name');
  if (name) lines.push('Usuario se llama: ' + name);
  const work = getFact('user_work');
  if (work) lines.push('Contexto laboral: ' + work);
  if (lastAssistant) lines.push('Última respuesta: ' + lastAssistant.slice(0, 200));
  return lines.join('\n');
}

function isFollowUp(text) {
  const t = String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  return /^(y eso|mas|más|mas detalles|más detalles|continua|continúa|sigue|por que|porque|y por que|explicalo|explícalo|resumelo|resúmelo|mas info|más info|ok y|dime mas|dime más|y eso que)$/i.test(
    t,
  ) || (/^(y |entonces |pero )/.test(t) && t.split(' ').length <= 6);
}

function expandFollowUp(text) {
  if (!isFollowUp(text) || !lastTopic) return text;
  const t = String(text).toLowerCase();
  if (/por que|porque/.test(t)) return 'por qué ' + lastTopic;
  if (/mas|más|detalle|info/.test(t)) return lastTopic + ' más detalles';
  if (/resum/.test(t)) return 'resume ' + lastTopic;
  return lastTopic + ' ' + text;
}

function status() {
  return {
    turns: turns.length,
    facts: facts.length,
    lastTopic,
    userName: getFact('user_name'),
  };
}

function clear() {
  turns = [];
  facts = [];
  lastTopic = null;
  lastUser = null;
  lastAssistant = null;
}

module.exports = {
  noteUser,
  noteAssistant,
  rememberFact,
  getFact,
  historyForBrain,
  contextBlock,
  isFollowUp,
  expandFollowUp,
  status,
  clear,
  extractTopic,
};
