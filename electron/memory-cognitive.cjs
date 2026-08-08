/**
 * Memoria cognitiva ELYRA 0.4
 * Preferencias · hechos · episodios · archivos · dominios (laboratorio)
 * Persistencia: ~/.elyra/memory/cognitive.json
 * Retrieval léxico (preparado para embeddings en 0.5 RAG)
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

function emptyStore() {
  return {
    version: 4,
    preferences: [],
    facts: [],
    files_touched: [],
    episodes: [],
    domains: {},
    updated_at: null,
  };
}

function loadStore() {
  try {
    if (fs.existsSync(storePath())) {
      const raw = JSON.parse(fs.readFileSync(storePath(), 'utf-8'));
      return Object.assign(emptyStore(), raw);
    }
  } catch {}
  return emptyStore();
}

function saveStore(data) {
  data.updated_at = new Date().toISOString();
  data.version = 4;
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
  const docTokens = tokenize(docText);
  if (!queryTokens.length || !docTokens.length) return 0;
  const set = new Set(docTokens);
  let hit = 0;
  for (const t of queryTokens) if (set.has(t)) hit++;
  // Densidad + cobertura
  return hit / queryTokens.length + Math.min(0.2, hit * 0.02);
}

function detectDomain(text) {
  const t = String(text || '').toLowerCase();
  if (/cadmio|cacao|afq|plaguicid|laboratorio|nirs|manteca|licor|sensorial/.test(t))
    return 'laboratorio';
  if (/excel|pdf|informe|documento|pptx|dashboard/.test(t)) return 'documentos';
  if (/chrome|ventana|volumen|proceso|apaga|reinicia|captura/.test(t)) return 'pc';
  return 'general';
}

function pushCapped(arr, entry, max) {
  arr.push(entry);
  if (arr.length > max) {
    return arr.slice(-max);
  }
  return arr;
}

function addPreference(text) {
  const store = loadStore();
  const entry = {
    id: Date.now().toString(36),
    text: String(text).slice(0, 500),
    domain: detectDomain(text),
    at: new Date().toISOString(),
  };
  store.preferences = pushCapped(store.preferences, entry, 100);
  saveStore(store);
  return entry;
}

function addFact(text) {
  const store = loadStore();
  const entry = {
    id: Date.now().toString(36),
    text: String(text).slice(0, 800),
    domain: detectDomain(text),
    at: new Date().toISOString(),
  };
  store.facts = pushCapped(store.facts, entry, 150);
  const dom = entry.domain;
  if (!store.domains[dom]) store.domains[dom] = [];
  store.domains[dom] = pushCapped(store.domains[dom], entry.text, 40);
  saveStore(store);
  return entry;
}

function noteFile(filePath, summary) {
  const store = loadStore();
  store.files_touched = pushCapped(
    store.files_touched,
    {
      path: filePath,
      summary: String(summary || '').slice(0, 400),
      at: new Date().toISOString(),
    },
    100,
  );
  saveStore(store);
}

function addEpisode(user, assistant, toolsUsed) {
  const store = loadStore();
  store.episodes = pushCapped(
    store.episodes,
    {
      user: String(user || '').slice(0, 400),
      assistant: String(assistant || '').slice(0, 400),
      tools: toolsUsed || [],
      domain: detectDomain(user),
      at: new Date().toISOString(),
    },
    80,
  );
  saveStore(store);
}

function retrieveContext(query, limit = 10) {
  const store = loadStore();
  const q = tokenize(query);
  const domain = detectDomain(query);
  const candidates = [];

  for (const p of store.preferences || []) {
    candidates.push({
      type: 'preferencia',
      text: p.text,
      s: score(q, p.text) + 0.2 + (p.domain === domain ? 0.1 : 0),
    });
  }
  for (const f of store.facts || []) {
    candidates.push({
      type: 'hecho',
      text: f.text,
      s: score(q, f.text) + (f.domain === domain ? 0.12 : 0),
    });
  }
  for (const ep of (store.episodes || []).slice(-25)) {
    const blob = ep.user + ' ' + ep.assistant;
    candidates.push({
      type: 'episodio',
      text: blob.slice(0, 320),
      s: score(q, blob) * 0.85 + (ep.domain === domain ? 0.08 : 0),
    });
  }
  for (const f of (store.files_touched || []).slice(-40)) {
    candidates.push({
      type: 'archivo',
      text: f.path + ': ' + f.summary,
      s: score(q, f.path + ' ' + f.summary),
    });
  }

  // Boost dominio activo
  const domainFacts = (store.domains && store.domains[domain]) || [];
  for (const t of domainFacts.slice(-8)) {
    candidates.push({ type: 'dominio:' + domain, text: t, s: 0.25 + score(q, t) });
  }

  candidates.sort((a, b) => b.s - a.s);
  const seen = new Set();
  const top = [];
  for (const c of candidates) {
    if (c.s < 0.04) continue;
    const key = c.text.slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    top.push(c);
    if (top.length >= limit) break;
  }

  if (!top.length && store.preferences.length) {
    return store.preferences
      .slice(-5)
      .map((p) => 'preferencia: ' + p.text)
      .join('\n');
  }
  return top.map((c) => c.type + ': ' + c.text).join('\n');
}

/** Alias usado por agent-hooks */
function buildContextSnippet(query) {
  return retrieveContext(query, 10);
}

function buildMemoryBlock(query) {
  const ctx = retrieveContext(query);
  if (!ctx) return '';
  return '\n\n[MEMORIA CONTEXTUAL]\n' + ctx + '\n[/MEMORIA]';
}

function stats() {
  const s = loadStore();
  return {
    preferences: (s.preferences || []).length,
    facts: (s.facts || []).length,
    episodes: (s.episodes || []).length,
    files: (s.files_touched || []).length,
    domains: Object.keys(s.domains || {}),
    updated_at: s.updated_at,
  };
}

module.exports = {
  loadStore,
  addPreference,
  addFact,
  noteFile,
  addEpisode,
  retrieveContext,
  buildContextSnippet,
  buildMemoryBlock,
  detectDomain,
  stats,
};
