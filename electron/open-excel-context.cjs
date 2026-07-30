/**
 * Localiza archivos Excel recientes / en uso para "analiza el excel abierto".
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

function recentFromFolder(dir, limit = 8) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile()) continue;
      if (!/\.(xlsx|xls|csv)$/i.test(e.name)) continue;
      const full = path.join(dir, e.name);
      try {
        const st = fs.statSync(full);
        out.push({ path: full, mtime: st.mtimeMs, name: e.name });
      } catch {}
    }
  } catch {}
  return out.sort((a, b) => b.mtime - a.mtime).slice(0, limit);
}

async function findExcelCandidates() {
  const home = os.homedir();
  const dirs = [
    path.join(home, 'Documents'),
    path.join(home, 'Desktop'),
    path.join(home, 'Downloads'),
    path.join(home, 'Documents', 'Informes'),
  ];
  let all = [];
  for (const d of dirs) all = all.concat(recentFromFolder(d, 10));

  // Recent files de Office (si existe)
  try {
    const recent =
      process.env.APPDATA &&
      path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Recent');
    if (recent && fs.existsSync(recent)) {
      const links = fs.readdirSync(recent).filter((n) => /\.(xlsx|xls|csv)\.lnk$/i.test(n) || /\.(xlsx|xls|csv)$/i.test(n));
      for (const n of links.slice(0, 15)) {
        all.push({
          path: path.join(recent, n),
          mtime: fs.statSync(path.join(recent, n)).mtimeMs,
          name: n.replace(/\.lnk$/i, ''),
          recent: true,
        });
      }
    }
  } catch {}

  // Procesos Excel + título de ventana (aproximación)
  try {
    const { stdout } = await execAsync(
      'powershell -NoProfile -WindowStyle Hidden -Command "Get-Process EXCEL -ErrorAction SilentlyContinue | Select-Object -ExpandProperty MainWindowTitle"',
      { windowsHide: true, timeout: 5000 },
    );
    const titles = String(stdout || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const t of titles) {
      // "Libro1 - Excel" o "archivo.xlsx - Excel"
      const m = t.match(/^(.+?)\s+-\s+Excel/i);
      if (m) {
        const base = m[1].replace(/\s*\[Compatibilidad\]/i, '').trim();
        if (/\.(xlsx|xls|csv)$/i.test(base)) {
          const hit = all.find((a) => a.name.toLowerCase() === base.toLowerCase());
          if (hit) hit.priority = 1;
          else all.unshift({ path: base, name: base, mtime: Date.now(), fromTitle: true });
        } else {
          const hit = all.find((a) => a.name.toLowerCase().includes(base.toLowerCase()));
          if (hit) hit.priority = 1;
        }
      }
    }
  } catch {}

  all.sort((a, b) => (b.priority || 0) - (a.priority || 0) || b.mtime - a.mtime);
  // Filtrar .lnk raros sin path real de archivo
  return all.filter((a) => a.path && (a.fromTitle || fs.existsSync(a.path)));
}

async function resolveOpenExcelPath() {
  const list = await findExcelCandidates();
  const real = list.find((a) => fs.existsSync(a.path) && /\.(xlsx|xls|csv)$/i.test(a.path));
  if (real) return { ok: true, path: real.path, name: real.name };
  if (list.length) {
    return {
      ok: false,
      candidates: list.slice(0, 5).map((a) => a.name || a.path),
      result: 'Encontré posibles archivos: ' + list.slice(0, 5).map((a) => a.name).join(', '),
    };
  }
  return { ok: false, result: 'No encontré un Excel reciente en Documentos, Escritorio o Descargas.' };
}

module.exports = { findExcelCandidates, resolveOpenExcelPath };
