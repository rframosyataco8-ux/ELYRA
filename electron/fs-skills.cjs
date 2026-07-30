/**
 * Skills de archivos nativos — capacidades tipo OpenClaw sin demonio externo.
 * Buscar, copiar, mover, listar por extensión, informes multi-paso.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const DOCS = path.join(HOME, 'Documents');
const DOWNLOADS = path.join(HOME, 'Downloads');
const DESKTOP = path.join(HOME, 'Desktop');
const INFORMES = path.join(DOCS, 'Informes');

const ALIASES = {
  descargas: DOWNLOADS,
  downloads: DOWNLOADS,
  documentos: DOCS,
  documents: DOCS,
  escritorio: DESKTOP,
  desktop: DESKTOP,
  informes: INFORMES,
  home: HOME,
};

function resolveRoot(root) {
  if (!root) return DOCS;
  const key = String(root).toLowerCase().trim();
  if (ALIASES[key]) return ALIASES[key];
  if (path.isAbsolute(root)) return root;
  return path.join(DOCS, root);
}

function isUnderUserHome(p) {
  const resolved = path.resolve(p);
  const home = path.resolve(HOME);
  return resolved === home || resolved.startsWith(home + path.sep);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Busca archivos por extensión y/o texto en el nombre.
 */
function findFiles({ root, ext, query, limit = 40, maxDepth = 6 }) {
  const base = resolveRoot(root);
  if (!fs.existsSync(base)) return { ok: false, result: 'No existe: ' + base };

  const exts = (ext || '')
    .split(/[,;\s]+/)
    .map((e) => e.replace(/^\./, '').toLowerCase())
    .filter(Boolean);
  const q = (query || '').toLowerCase();
  const found = [];

  function walk(dir, depth) {
    if (depth > maxDepth || found.length >= limit) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (found.length >= limit) break;
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'AppData') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full, depth + 1);
      } else if (e.isFile()) {
        const lower = e.name.toLowerCase();
        const fileExt = path.extname(lower).slice(1);
        if (exts.length && !exts.includes(fileExt)) continue;
        if (q && !lower.includes(q)) continue;
        try {
          const st = fs.statSync(full);
          found.push({
            path: full,
            name: e.name,
            size: st.size,
            mtime: st.mtime.toISOString(),
          });
        } catch {}
      }
    }
  }

  walk(base, 0);
  if (!found.length) {
    return {
      ok: true,
      result:
        'Sin resultados en ' +
        path.basename(base) +
        (exts.length ? ' (.' + exts.join(', .') + ')' : '') +
        (q ? ' filtro "' + q + '"' : ''),
      files: [],
    };
  }
  const lines = found.map(
    (f, i) =>
      i +
      1 +
      '. ' +
      f.name +
      ' (' +
      Math.round(f.size / 1024) +
      ' KB) — ' +
      f.path,
  );
  return {
    ok: true,
    result: 'Encontrados ' + found.length + ':\n' + lines.join('\n'),
    files: found,
  };
}

function copyFile(src, destDir) {
  if (!src || !fs.existsSync(src)) return { ok: false, result: 'Origen no existe' };
  const destRoot = resolveRoot(destDir || 'informes');
  if (!isUnderUserHome(src) || !isUnderUserHome(destRoot)) {
    return { ok: false, result: 'Solo rutas dentro del perfil de usuario' };
  }
  ensureDir(destRoot);
  const dest = path.join(destRoot, path.basename(src));
  fs.copyFileSync(src, dest);
  return { ok: true, result: 'Copiado a ' + dest, path: dest };
}

function copyMany(paths, destDir) {
  const list = Array.isArray(paths) ? paths : String(paths || '').split(/\n/).map((s) => s.trim()).filter(Boolean);
  if (!list.length) return { ok: false, result: 'Sin rutas' };
  const out = [];
  for (const p of list.slice(0, 50)) {
    const r = copyFile(p, destDir);
    out.push((r.ok ? 'OK ' : 'ERR ') + path.basename(p) + ': ' + r.result);
  }
  return { ok: true, result: out.join('\n') };
}

function moveFile(src, destDir) {
  if (!src || !fs.existsSync(src)) return { ok: false, result: 'Origen no existe' };
  const destRoot = resolveRoot(destDir || 'informes');
  if (!isUnderUserHome(src) || !isUnderUserHome(destRoot)) {
    return { ok: false, result: 'Solo perfil de usuario' };
  }
  ensureDir(destRoot);
  const dest = path.join(destRoot, path.basename(src));
  fs.renameSync(src, dest);
  return { ok: true, result: 'Movido a ' + dest, path: dest };
}

function deleteFile(filePath) {
  if (!filePath) return { ok: false, result: 'Falta path' };
  const p = path.isAbsolute(filePath) ? filePath : path.join(DOCS, filePath);
  if (!isUnderUserHome(p)) return { ok: false, result: 'Ruta no permitida' };
  if (!fs.existsSync(p)) return { ok: false, result: 'No existe' };
  const st = fs.statSync(p);
  if (st.isDirectory()) return { ok: false, result: 'No borro carpetas enteras por seguridad' };
  fs.unlinkSync(p);
  return { ok: true, result: 'Eliminado ' + path.basename(p) };
}

function mkdir(name) {
  const dir = resolveRoot(name || 'informes');
  if (!isUnderUserHome(dir)) return { ok: false, result: 'Ruta no permitida' };
  ensureDir(dir);
  return { ok: true, result: 'Carpeta lista: ' + dir, path: dir };
}

/**
 * Skill compuesto: busca por extensión, copia a destino, genera resumen texto.
 * Ej: PDFs de Descargas → Informes/PDF_colectados
 */
function collectByExtension({ root, ext, dest, query }) {
  const search = findFiles({
    root: root || 'descargas',
    ext: ext || 'pdf',
    query,
    limit: 30,
  });
  if (!search.ok || !search.files?.length) return search;

  const destName = dest || path.join('Informes', (ext || 'pdf').toUpperCase() + '_colectados');
  const destRoot = resolveRoot(destName);
  ensureDir(destRoot);

  const copied = [];
  for (const f of search.files) {
    try {
      const target = path.join(destRoot, f.name);
      fs.copyFileSync(f.path, target);
      copied.push(f.name);
    } catch (e) {
      copied.push('ERR ' + f.name + ': ' + e.message);
    }
  }

  const reportPath = path.join(destRoot, 'resumen-' + Date.now() + '.txt');
  const report =
    'ELYRA — Colección de archivos\n' +
    'Fecha: ' + new Date().toLocaleString('es-ES') + '\n' +
    'Origen: ' + resolveRoot(root || 'descargas') + '\n' +
    'Extensión: .' + (ext || 'pdf') + '\n' +
    'Copiados: ' + copied.length + '\n\n' +
    copied.map((n, i) => i + 1 + '. ' + n).join('\n');
  fs.writeFileSync(reportPath, report, 'utf-8');

  return {
    ok: true,
    result:
      'Copié ' +
      copied.length +
      ' archivo(s) .' +
      (ext || 'pdf') +
      ' a ' +
      destRoot +
      '. Resumen: ' +
      path.basename(reportPath),
    path: destRoot,
    reportPath,
    count: copied.length,
  };
}

module.exports = {
  findFiles,
  copyFile,
  copyMany,
  moveFile,
  deleteFile,
  mkdir,
  collectByExtension,
  resolveRoot,
  ALIASES,
};
