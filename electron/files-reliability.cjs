/**
 * ELYRA 0.7 — capa de fiabilidad para archivos/datos
 * Resolución de rutas, mensajes claros, health de Python tools.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { runPythonTool } = require('./python-bridge.cjs');

function userRoots() {
  const home = os.homedir();
  const docs = path.join(home, 'Documents');
  const docsAlt = path.join(home, 'Documentos');
  return {
    home,
    docs: fs.existsSync(docs) ? docs : fs.existsSync(docsAlt) ? docsAlt : home,
    downloads: path.join(home, 'Downloads'),
    desktop: path.join(home, 'Desktop'),
    informes: path.join(fs.existsSync(docs) ? docs : home, 'Informes'),
  };
}

function resolveUserFile(input) {
  if (!input) return null;
  let p = String(input).trim().replace(/^["']|["']$/g, '');
  if (p.startsWith('~')) p = path.join(os.homedir(), p.slice(1));
  if (path.isAbsolute(p) && fs.existsSync(p)) return p;

  const roots = userRoots();
  const candidates = [
    p,
    path.join(roots.docs, p),
    path.join(roots.informes, p),
    path.join(roots.downloads, p),
    path.join(roots.desktop, p),
    path.join(roots.docs, path.basename(p)),
    path.join(roots.informes, path.basename(p)),
    path.join(roots.downloads, path.basename(p)),
    path.join(roots.desktop, path.basename(p)),
  ];
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c) && fs.statSync(c).isFile()) return path.resolve(c);
    } catch {}
  }
  return path.isAbsolute(p) ? p : path.join(roots.docs, p);
}

async function pythonHealth() {
  return runPythonTool('health', {}, 20000);
}

async function analyzeExcelSafe(params) {
  const resolved = resolveUserFile(params.path);
  if (!resolved || !fs.existsSync(resolved)) {
    return {
      ok: false,
      result:
        'No encuentro el archivo. Ponlo en Documentos o Informes, o dame la ruta completa. Probé: ' +
        (params.path || '(vacío)'),
    };
  }
  return runPythonTool('analyze_excel', {
    path: resolved,
    export: params.export === true || params.export === 'true',
    sheet: params.sheet,
  });
}

async function summarizePdfSafe(params) {
  const resolved = resolveUserFile(params.path);
  if (!resolved || !fs.existsSync(resolved)) {
    return { ok: false, result: 'PDF no encontrado: ' + (params.path || '') };
  }
  return runPythonTool('summarize_pdf', {
    path: resolved,
    max_pages: params.max_pages || 40,
  });
}

async function readDocxSafe(params) {
  const resolved = resolveUserFile(params.path);
  if (!resolved || !fs.existsSync(resolved)) {
    return { ok: false, result: 'DOCX no encontrado: ' + (params.path || '') };
  }
  return runPythonTool('read_docx', { path: resolved });
}

module.exports = {
  userRoots,
  resolveUserFile,
  pythonHealth,
  analyzeExcelSafe,
  summarizePdfSafe,
  readDocxSafe,
};
