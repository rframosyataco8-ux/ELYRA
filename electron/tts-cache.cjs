/**
 * Caché en memoria de frases TTS cortas (0.6)
 * Reduce latencia en confirmaciones repetidas: Listo, Hecho, etc.
 */
const crypto = require('crypto');

const MAX_ENTRIES = 48;
const store = new Map();

function keyFor(text, voice, rate) {
  return crypto
    .createHash('sha1')
    .update(String(voice || '') + '|' + String(rate || '') + '|' + String(text || ''))
    .digest('hex');
}

function get(text, voice, rate) {
  const k = keyFor(text, voice, rate);
  const hit = store.get(k);
  if (!hit) return null;
  // LRU touch
  store.delete(k);
  store.set(k, hit);
  return hit;
}

function set(text, voice, rate, dataUrl) {
  if (!dataUrl || !text || text.length > 180) return;
  const k = keyFor(text, voice, rate);
  if (store.has(k)) store.delete(k);
  store.set(k, dataUrl);
  while (store.size > MAX_ENTRIES) {
    const first = store.keys().next().value;
    store.delete(first);
  }
}

function stats() {
  return { entries: store.size, max: MAX_ENTRIES };
}

module.exports = { get, set, stats, keyFor };
