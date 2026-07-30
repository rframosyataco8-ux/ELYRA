/**
 * Memoria contextual dinámica — ELYRA
 * Persistencia local + recuperación por relevancia (sin servidor externo).
 * Preparado para evolucionar a embeddings vectoriales.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

function memoryDir() {
  const d = path.join(os.homedir(), '.elyra', 'memory');
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

function storePath() {
  return path.join(memoryDir(), 'cognitive.json');
}

function loadStore() {
  try {
    if (fs.existsSync(storePath())) {
      return JSON.parse(fs.readFileSync(storePath(), 'utf-8'));
    }
  } catch {}
  return {
    preferences: [],
    facts: [],
    files_touched: [],
    episodes: [],
    updated_at: null,
  };
}

function saveStore(data) {
  data.updated_at = new Date().toISOString();
  fs.writeFileSync(storePath(), JSON.stringify(data, null, 2), 'utf-8');
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9áéíóúñü]+/i)
    .filter((w) => w.length > 2);
}

function score(queryTokens, docText) {
  const docTokens = new Set(tokenize(docText));
  if (!queryTokens.length || !docTokens.size) return 0;
  let hit = 0;
  for (const t of queryTokens) if (docTokens.has(t)) hit++;
  return hit / queryTokens.length;
}

function addPreference(text) {
  const store = loadStore();
  const entry = { id: Date.now().toString(36), text: String(text).slice(0, 500), at: new Date().toISOString() };
  store.preferences.push(entry);
  if (store.preferences.length > 80) store.preferences = store.preferences.slice(-80);
  saveStore(store);
  return entry;
}

function addFact(text) {
  const store = loadStore();
  const entry = { id: Date.now().toString(36), text: String(text).slice(0, 800), at: new Date().toISOString() };
  store.facts.push(entry);
  if (store.facts.length > 120) store.facts = store.facts.slice(-120);
  saveStore(store);
  return entry;
}

function noteFile(filePath, summary) {
  const store = loadStore();
  store.files_touched.push({
    path: filePath,
    summary: String(summary || '').slice(0, 400),
    at: new Date().toISOString(),
  });
  if (store.files_touched.length > 100) store.files_touched = store.files_touched.slice(-100);
  saveStore(store);
}

function addEpisode(user, assistant, toolsUsed) {
  const store = loadStore();
  store.episodes.push({
    user: String(user || '').slice(0, 400),
    assistant: String(assistant || '').slice(0, 400),
    tools: toolsUsed || [],
    at: new Date().toISOString(),
  });
  if (store.episodes.length > 60) store.episodes = store.episodes.slice(-60);
  saveStore(store);
}

/** Recuperación por relevancia para inyectar en el system prompt */
function retrieveContext(query, limit = 8) {
  const store = loadStore();
  const q = tokenize(query);
  const candidates = [];

  for (const p of store.preferences || []) {
    candidates.push({ type: 'preferencia', text: p.text, s: score(q, p.text) + 0.15 });
  }
  for (const f of store.facts || []) {
    candidates.push({ type: 'hecho', text: f.text, s: score(q, f.text) });
  }
  for (const ep of (store.episodes || []).slice(-20)) {
    const blob = ep.user + ' ' + ep.assistant;
    candidates.push({ type: 'episodio', text: blob.slice(0, 300), s: score(q, blob) * 0.8 });
  }
  for (const f of (store.files_touched || []).slice(-30)) {
    candidates.push({
      type: 'archivo',
      text: f.path + ': ' + f.summary,
      s: score(q, f.path + ' ' + f.summary),
    });
  }

  candidates.sort((a, b) => b.s - a.s);
  const top = candidates.filter((c) => c.s > 0.05).slice(0, limit);
  if (!top.length && store.preferences.length) {
    return store.preferences
      .slice(-5)
      .map((p) => 'preferencia: ' + p.text)
      .join('\n');
  }
  return top.map((c) => c.type + ': ' + c.text).join('\n');
}

function buildMemoryBlock(query) {
  const ctx = retrieveContext(query);
  if (!ctx) return '';
  return '\n\n[MEMORIA CONTEXTUAL]\n' + ctx + '\n[/MEMORIA]';
}

module.exports = {
  loadStore,
  addPreference,
  addFact,
  noteFile,
  addEpisode,
  retrieveContext,
  buildMemoryBlock,
};
