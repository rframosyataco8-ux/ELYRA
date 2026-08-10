/**
 * ELYRA 1.1 — Base de datos de sistema
 * Almacén local estructurado para TODO el producto (no solo chat).
 *
 * Motor: JSON document-store versionado en ~/.elyra/system/
 * (sin better-sqlite3: evita rebuild nativo en Electron; API lista para SQLite después)
 *
 * Tablas lógicas:
 *   meta, conversations, messages, memory_items, tool_events,
 *   file_events, search_events, settings_snapshots, audit_events
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const SCHEMA_VERSION = 1;

function systemDir() {
  const d = path.join(os.homedir(), '.elyra', 'system');
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

function dbPath() {
  return path.join(systemDir(), 'elyra-system.json');
}

function id() {
  return Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
}

function emptyDb() {
  return {
    schema: SCHEMA_VERSION,
    created_at: new Date().toISOString(),
    updated_at: null,
    meta: {
      product: 'ELYRA',
      note: 'System database — conversations, memory, tools, files, audit',
    },
    conversations: [],
    messages: [],
    memory_items: [],
    tool_events: [],
    file_events: [],
    search_events: [],
    settings_snapshots: [],
    audit_events: [],
  };
}

let _cache = null;
let _dirty = false;
let _saveTimer = null;

function load() {
  if (_cache) return _cache;
  try {
    if (fs.existsSync(dbPath())) {
      const raw = JSON.parse(fs.readFileSync(dbPath(), 'utf-8'));
      _cache = Object.assign(emptyDb(), raw);
      if (!_cache.schema) _cache.schema = SCHEMA_VERSION;
      return _cache;
    }
  } catch (e) {
    console.warn('[elyra-db] load failed, new db:', e.message);
  }
  _cache = emptyDb();
  persist(true);
  return _cache;
}

function persist(force) {
  if (!_cache) return;
  _cache.updated_at = new Date().toISOString();
  try {
    const tmp = dbPath() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(_cache, null, 0), 'utf-8');
    fs.renameSync(tmp, dbPath());
    _dirty = false;
  } catch (e) {
    console.warn('[elyra-db] persist:', e.message);
  }
}

function scheduleSave() {
  _dirty = true;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => persist(true), 400);
}

function cap(arr, max) {
  if (arr.length > max) {
    arr.splice(0, arr.length - max);
  }
  return arr;
}

// ── Conversations & messages ──────────────────────────────────────────

function startConversation(title) {
  const db = load();
  const conv = {
    id: id(),
    title: String(title || 'Conversación').slice(0, 120),
    started_at: new Date().toISOString(),
    ended_at: null,
    message_count: 0,
  };
  db.conversations.push(conv);
  cap(db.conversations, 200);
  scheduleSave();
  return conv;
}

function getOrCreateActiveConversation() {
  const db = load();
  const last = db.conversations[db.conversations.length - 1];
  if (last && !last.ended_at) {
    // Reutilizar si < 2h
    const age = Date.now() - new Date(last.started_at).getTime();
    if (age < 2 * 60 * 60 * 1000) return last;
    last.ended_at = new Date().toISOString();
  }
  return startConversation('Sesión ' + new Date().toLocaleString('es-ES'));
}

function addMessage({ role, content, conversationId, tools }) {
  const db = load();
  const conv =
    db.conversations.find((c) => c.id === conversationId) || getOrCreateActiveConversation();
  const msg = {
    id: id(),
    conversation_id: conv.id,
    role: role === 'assistant' || role === 'system' ? role : 'user',
    content: String(content || '').slice(0, 8000),
    tools: Array.isArray(tools) ? tools.slice(0, 20) : [],
    at: new Date().toISOString(),
  };
  db.messages.push(msg);
  cap(db.messages, 2000);
  conv.message_count = (conv.message_count || 0) + 1;
  scheduleSave();
  return msg;
}

function recentMessages(limit = 20) {
  const db = load();
  return db.messages.slice(-limit);
}

// ── Memory (system-wide) ──────────────────────────────────────────────

function addMemoryItem({ kind, text, domain, source }) {
  const db = load();
  const item = {
    id: id(),
    kind: kind || 'fact', // fact | preference | episode | note
    text: String(text || '').slice(0, 1000),
    domain: domain || 'general',
    source: source || 'agent',
    at: new Date().toISOString(),
  };
  db.memory_items.push(item);
  cap(db.memory_items, 500);
  scheduleSave();
  return item;
}

function searchMemory(query, limit = 12) {
  const db = load();
  const q = String(query || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\W+/)
    .filter((w) => w.length > 2);
  if (!q.length) return db.memory_items.slice(-limit);

  const scored = db.memory_items.map((m) => {
    const t = (m.text || '').toLowerCase();
    let s = 0;
    for (const w of q) if (t.includes(w)) s++;
    return { m, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored
    .filter((x) => x.s > 0)
    .slice(0, limit)
    .map((x) => x.m);
}

// ── Tool / file / search events ───────────────────────────────────────

function logToolEvent({ name, ok, paramsSummary, resultSummary }) {
  const db = load();
  db.tool_events.push({
    id: id(),
    name: String(name || '').slice(0, 80),
    ok: !!ok,
    params: String(paramsSummary || '').slice(0, 200),
    result: String(resultSummary || '').slice(0, 300),
    at: new Date().toISOString(),
  });
  cap(db.tool_events, 800);
  scheduleSave();
}

function logFileEvent({ path: filePath, action, summary }) {
  const db = load();
  db.file_events.push({
    id: id(),
    path: String(filePath || '').slice(0, 400),
    action: action || 'touch',
    summary: String(summary || '').slice(0, 400),
    at: new Date().toISOString(),
  });
  cap(db.file_events, 400);
  scheduleSave();
}

function logSearchEvent({ query, source, hitCount }) {
  const db = load();
  db.search_events.push({
    id: id(),
    query: String(query || '').slice(0, 300),
    source: source || 'web',
    hit_count: hitCount || 0,
    at: new Date().toISOString(),
  });
  cap(db.search_events, 400);
  scheduleSave();
}

function logAudit(event, detail) {
  const db = load();
  let safe = String(detail || '').slice(0, 500);
  try {
    safe = require('./security-harden.cjs').redactSecrets(safe);
  } catch {}
  db.audit_events.push({
    id: id(),
    event: String(event || 'event').slice(0, 80),
    detail: safe,
    at: new Date().toISOString(),
  });
  cap(db.audit_events, 1000);
  scheduleSave();
}

// ── Migration from legacy JSON memory ─────────────────────────────────

function migrateFromLegacyMemory() {
  const legacyPath = path.join(os.homedir(), '.elyra', 'memory', 'cognitive.json');
  if (!fs.existsSync(legacyPath)) {
    return { ok: true, migrated: 0, reason: 'no legacy file' };
  }
  const db = load();
  if (db.meta.migrated_memory_v1) {
    return { ok: true, migrated: 0, reason: 'already migrated' };
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
  } catch (e) {
    return { ok: false, error: e.message };
  }
  let n = 0;
  for (const p of raw.preferences || []) {
    addMemoryItem({
      kind: 'preference',
      text: p.text,
      domain: p.domain,
      source: 'migration',
    });
    n++;
  }
  for (const f of raw.facts || []) {
    addMemoryItem({ kind: 'fact', text: f.text, domain: f.domain, source: 'migration' });
    n++;
  }
  for (const ep of raw.episodes || []) {
    addMemoryItem({
      kind: 'episode',
      text: 'U: ' + (ep.user || '') + ' | A: ' + (ep.assistant || ''),
      domain: ep.domain,
      source: 'migration',
    });
    n++;
  }
  for (const f of raw.files_touched || []) {
    logFileEvent({ path: f.path, action: 'legacy', summary: f.summary });
    n++;
  }
  db.meta.migrated_memory_v1 = true;
  db.meta.migrated_at = new Date().toISOString();
  persist(true);
  return { ok: true, migrated: n };
}

// ── Stats / export / flush ────────────────────────────────────────────

function stats() {
  const db = load();
  return {
    schema: db.schema,
    path: dbPath(),
    conversations: db.conversations.length,
    messages: db.messages.length,
    memory_items: db.memory_items.length,
    tool_events: db.tool_events.length,
    file_events: db.file_events.length,
    search_events: db.search_events.length,
    audit_events: db.audit_events.length,
    updated_at: db.updated_at,
    migrated_memory: !!db.meta.migrated_memory_v1,
  };
}

function exportSnapshot() {
  const db = load();
  const out = path.join(systemDir(), 'export-' + Date.now() + '.json');
  fs.writeFileSync(out, JSON.stringify(db, null, 2), 'utf-8');
  return { ok: true, path: out };
}

function flush() {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  persist(true);
}

function contextFromDb(query, limit = 8) {
  const items = searchMemory(query, limit);
  if (!items.length) return '';
  return items.map((m) => m.kind + ': ' + m.text).join('\n');
}

// Auto-migrate once on first load
try {
  load();
  migrateFromLegacyMemory();
} catch {}

module.exports = {
  load,
  flush,
  stats,
  startConversation,
  getOrCreateActiveConversation,
  addMessage,
  recentMessages,
  addMemoryItem,
  searchMemory,
  contextFromDb,
  logToolEvent,
  logFileEvent,
  logSearchEvent,
  logAudit,
  migrateFromLegacyMemory,
  exportSnapshot,
  dbPath,
  SCHEMA_VERSION,
};
