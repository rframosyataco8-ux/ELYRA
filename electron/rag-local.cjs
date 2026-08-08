/**
 * ELYRA 0.5 — RAG local sobre documentos del usuario
 * Índice en ~/.elyra/rag/index.json (sin servidor externo).
 * Texto plano: Node. PDF/DOCX: extracción vía python_tools cuando está disponible.
 *
 * Esto NO es la base de datos global del sistema (eso queda para decisión futura).
 * Solo indexa y recupera fragmentos de archivos locales para fundamentar respuestas.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const TEXT_EXT = new Set(['.txt', '.md', '.csv', '.json', '.log', '.xml', '.html', '.htm']);
const RICH_EXT = new Set(['.pdf', '.docx']);
const MAX_FILE_BYTES = 2.5 * 1024 * 1024;
const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 120;
const MAX_FILES_SCAN = 400;
const MAX_CHUNKS = 2500;

function ragDir() {
  const d = path.join(os.homedir(), '.elyra', 'rag');
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

function indexPath() {
  return path.join(ragDir(), 'index.json');
}

function defaultRoots() {
  const home = os.homedir();
  const docs = path.join(home, 'Documents');
  return [
    docs,
    path.join(docs, 'Informes'),
    path.join(home, 'Desktop'),
    path.join(home, 'Downloads'),
  ].filter((p) => fs.existsSync(p));
}

function emptyIndex() {
  return {
    version: 1,
    updated_at: null,
    roots: [],
    files: {},
    chunks: [],
  };
}

function loadIndex() {
  try {
    if (fs.existsSync(indexPath())) {
      return Object.assign(emptyIndex(), JSON.parse(fs.readFileSync(indexPath(), 'utf-8')));
    }
  } catch {}
  return emptyIndex();
}

function saveIndex(idx) {
  idx.updated_at = new Date().toISOString();
  // Cap chunks
  if (idx.chunks.length > MAX_CHUNKS) {
    idx.chunks = idx.chunks.slice(-MAX_CHUNKS);
  }
  fs.writeFileSync(indexPath(), JSON.stringify(idx), 'utf-8');
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9áéíóúñü]+/i)
    .filter((w) => w.length > 2);
}

function chunkText(text, source) {
  const clean = String(text || '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!clean) return [];
  const chunks = [];
  let i = 0;
  while (i < clean.length) {
    const slice = clean.slice(i, i + CHUNK_SIZE);
    chunks.push({
      id: source + '#' + i,
      source,
      text: slice,
      tokens: tokenize(slice),
    });
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

function walkFiles(root, out, depth) {
  if (out.length >= MAX_FILES_SCAN || depth > 6) return;
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (out.length >= MAX_FILES_SCAN) break;
    if (e.name.startsWith('.')) continue;
    if (/node_modules|AppData|\.git|Windows|Program Files/i.test(e.name)) continue;
    const full = path.join(root, e.name);
    try {
      if (e.isDirectory()) {
        walkFiles(full, out, depth + 1);
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (TEXT_EXT.has(ext) || RICH_EXT.has(ext)) {
          const st = fs.statSync(full);
          if (st.size > 0 && st.size <= MAX_FILE_BYTES) {
            out.push({ path: full, ext, mtime: st.mtimeMs, size: st.size });
          }
        }
      }
    } catch {
      /* skip */
    }
  }
}

function readTextFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    try {
      return fs.readFileSync(filePath, 'latin1');
    } catch {
      return '';
    }
  }
}

async function extractRich(filePath, ext) {
  try {
    const { runPythonTool } = require('./python-bridge.cjs');
    if (ext === '.pdf') {
      const r = await runPythonTool('summarize_pdf', { path: filePath, max_pages: 40 });
      if (r && r.ok && r.result) return String(r.result);
    }
    if (ext === '.docx') {
      const r = await runPythonTool('read_docx', { path: filePath });
      if (r && r.ok && r.result) return String(r.result);
    }
  } catch {}
  return '';
}

/**
 * Reconstruye el índice. force=true ignora mtime.
 */
async function buildIndex(opts) {
  const options = opts || {};
  const roots = options.roots && options.roots.length ? options.roots : defaultRoots();
  const force = !!options.force;
  const prev = loadIndex();
  const filesMeta = [];
  for (const root of roots) walkFiles(root, filesMeta, 0);

  const newChunks = [];
  const files = {};
  let indexed = 0;
  let skipped = 0;

  for (const f of filesMeta) {
    const prevFile = prev.files && prev.files[f.path];
    if (!force && prevFile && prevFile.mtime === f.mtime && prevFile.size === f.size) {
      // Reuse chunks from previous index
      const reused = (prev.chunks || []).filter((c) => c.source === f.path);
      if (reused.length) {
        newChunks.push(...reused);
        files[f.path] = prevFile;
        skipped++;
        continue;
      }
    }

    let text = '';
    if (TEXT_EXT.has(f.ext)) {
      text = readTextFile(f.path);
    } else if (RICH_EXT.has(f.ext)) {
      text = await extractRich(f.path, f.ext);
    }
    if (!text || text.length < 40) {
      files[f.path] = { mtime: f.mtime, size: f.size, chunks: 0, skipped: true };
      continue;
    }

    const chunks = chunkText(text.slice(0, 120000), f.path);
    newChunks.push(...chunks);
    files[f.path] = { mtime: f.mtime, size: f.size, chunks: chunks.length };
    indexed++;
  }

  const idx = {
    version: 1,
    updated_at: new Date().toISOString(),
    roots,
    files,
    chunks: newChunks.slice(0, MAX_CHUNKS),
  };
  saveIndex(idx);
  return {
    ok: true,
    result:
      'Índice RAG listo: ' +
      indexed +
      ' archivos nuevos/actualizados, ' +
      skipped +
      ' reutilizados, ' +
      idx.chunks.length +
      ' fragmentos. Raíces: ' +
      roots.join(', '),
    indexed,
    skipped,
    chunks: idx.chunks.length,
  };
}

function scoreChunk(queryTokens, chunk) {
  if (!queryTokens.length || !chunk.tokens || !chunk.tokens.length) return 0;
  const set = new Set(chunk.tokens);
  let hit = 0;
  for (const t of queryTokens) if (set.has(t)) hit++;
  if (!hit) return 0;
  return hit / queryTokens.length + Math.min(0.25, hit * 0.03);
}

/**
 * Busca fragmentos relevantes. Si no hay índice, construye uno ligero (solo texto).
 */
async function searchDocs(query, limit) {
  const lim = Math.min(12, Math.max(3, limit || 6));
  let idx = loadIndex();
  if (!idx.chunks.length) {
    // First-time: text-only quick index (skip heavy PDF to keep latency low)
    await buildIndex({ force: false });
    idx = loadIndex();
  }
  const qTokens = tokenize(query);
  if (!qTokens.length) {
    return { ok: false, result: 'Consulta vacía', hits: [] };
  }

  const scored = [];
  for (const c of idx.chunks || []) {
    const s = scoreChunk(qTokens, c);
    if (s > 0.06) scored.push({ s, source: c.source, text: c.text });
  }
  scored.sort((a, b) => b.s - a.s);
  const hits = scored.slice(0, lim);

  if (!hits.length) {
    return {
      ok: true,
      result:
        'No encontré fragmentos relevantes en el índice local. Puedes decir «reindexar documentos» o indicar la ruta del archivo.',
      hits: [],
    };
  }

  const lines = hits.map((h, i) => {
    const name = path.basename(h.source);
    return (
      '[' +
      (i + 1) +
      '] ' +
      name +
      ' (score ' +
      h.s.toFixed(2) +
      ')\n' +
      h.text.trim().slice(0, 500)
    );
  });

  return {
    ok: true,
    result: 'Fragmentos de tus documentos:\n\n' + lines.join('\n\n---\n\n'),
    hits: hits.map((h) => ({ source: h.source, score: h.s, excerpt: h.text.slice(0, 280) })),
  };
}

function buildRagBlock(query) {
  // Sync path for prompt: use existing index only (no await)
  const idx = loadIndex();
  if (!idx.chunks || !idx.chunks.length) return '';
  const qTokens = tokenize(query);
  if (!qTokens.length) return '';
  const scored = [];
  for (const c of idx.chunks) {
    const s = scoreChunk(qTokens, c);
    if (s > 0.08) scored.push({ s, source: c.source, text: c.text });
  }
  scored.sort((a, b) => b.s - a.s);
  const top = scored.slice(0, 4);
  if (!top.length) return '';
  return (
    '\n\n[DOCUMENTOS LOCALES — RAG]\n' +
    top
      .map((h) => path.basename(h.source) + ': ' + h.text.trim().slice(0, 350))
      .join('\n---\n') +
    '\n[/RAG] Usa estos fragmentos si responden la pregunta; no inventes datos de archivos.'
  );
}

function indexStats() {
  const idx = loadIndex();
  return {
    chunks: (idx.chunks || []).length,
    files: Object.keys(idx.files || {}).length,
    updated_at: idx.updated_at,
    roots: idx.roots || [],
  };
}

function looksLikeDocQuery(text) {
  return /\b(documento|documentos|archivo|archivos|informe|informes|pdf|docx|mis notas|en mis|según el|segun el|protocolo|norma|excel|lo que dice|reindexar)\b/i.test(
    String(text || ''),
  );
}

module.exports = {
  buildIndex,
  searchDocs,
  buildRagBlock,
  indexStats,
  looksLikeDocQuery,
  loadIndex,
  defaultRoots,
};
