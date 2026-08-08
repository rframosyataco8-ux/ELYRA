/**
 * Caché de búsquedas web ELYRA
 * - Memoria + disco (~/.elyra/search-cache.json)
 * - TTL por defecto 6 horas (configurable)
 * - Máximo de entradas para no crecer sin límite
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas
const MAX_ENTRIES = 200;

function cachePath() {
  return path.join(os.homedir(), '.elyra', 'search-cache.json');
}

function configPath() {
  return path.join(os.homedir(), '.elyra', 'config.json');
}

function readTtlMs() {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath(), 'utf-8'));
    if (typeof raw.searchCacheTtlHours === 'number' && raw.searchCacheTtlHours > 0) {
      return Math.min(72, raw.searchCacheTtlHours) * 60 * 60 * 1000;
    }
    if (raw.searchCacheTtlMs && Number(raw.searchCacheTtlMs) > 0) {
      return Math.min(72 * 60 * 60 * 1000, Number(raw.searchCacheTtlMs));
    }
  } catch {}
  return DEFAULT_TTL_MS;
}

function normalizeKey(query) {
  return String(query || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let memory = null;

function load() {
  if (memory) return memory;
  try {
    const p = cachePath();
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      memory = data && typeof data === 'object' ? data : {};
    } else {
      memory = {};
    }
  } catch {
    memory = {};
  }
  return memory;
}

function save() {
  try {
    const dir = path.dirname(cachePath());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cachePath(), JSON.stringify(memory || {}, null, 0), 'utf-8');
  } catch {}
}

function prune(ttlMs) {
  const store = load();
  const now = Date.now();
  const keys = Object.keys(store);
  for (const k of keys) {
    const e = store[k];
    if (!e || !e.at || now - e.at > ttlMs) delete store[k];
  }
  // Si sigue grande, borrar las más antiguas
  const remaining = Object.keys(store);
  if (remaining.length > MAX_ENTRIES) {
    remaining
      .map((k) => ({ k, at: store[k].at || 0 }))
      .sort((a, b) => a.at - b.at)
      .slice(0, remaining.length - MAX_ENTRIES)
      .forEach(({ k }) => delete store[k]);
  }
}

function get(query) {
  const key = normalizeKey(query);
  if (!key) return null;
  const ttl = readTtlMs();
  const store = load();
  const entry = store[key];
  if (!entry || !entry.response) return null;
  if (Date.now() - (entry.at || 0) > ttl) {
    delete store[key];
    save();
    return null;
  }
  return {
    ok: true,
    response: entry.response,
    source: (entry.source || 'cache') + '+cache',
    query: entry.query || query,
    cached: true,
    ageMs: Date.now() - entry.at,
  };
}

function set(query, result) {
  if (!result || !result.ok || !result.response) return;
  const key = normalizeKey(query);
  if (!key) return;
  const ttl = readTtlMs();
  const store = load();
  prune(ttl);
  store[key] = {
    at: Date.now(),
    response: String(result.response).slice(0, 2000),
    source: result.source || 'deep-web',
    query: String(query).slice(0, 200),
  };
  save();
}

function clear() {
  memory = {};
  try {
    if (fs.existsSync(cachePath())) fs.unlinkSync(cachePath());
  } catch {}
}

function stats() {
  const store = load();
  const keys = Object.keys(store);
  return {
    entries: keys.length,
    ttlMs: readTtlMs(),
    path: cachePath(),
  };
}

module.exports = {
  get,
  set,
  clear,
  stats,
  normalizeKey,
  DEFAULT_TTL_MS,
};
