/**
 * ELYRA 1.4 — OCR local (opcional)
 * Usa Python: Pillow + pytesseract si están instalados.
 * Si no hay Tesseract: mensaje claro + sugiere vision API.
 */
const { runPythonTool } = require('./python-bridge.cjs');
const path = require('path');
const fs = require('fs');
const os = require('os');

function resolveImage(input) {
  if (!input) return null;
  let p = String(input).trim().replace(/^["']|["']$/g, '');
  if (p.startsWith('~')) p = path.join(os.homedir(), p.slice(1));
  if (path.isAbsolute(p) && fs.existsSync(p)) return p;
  const home = os.homedir();
  const docs = path.join(home, 'Documents');
  for (const c of [
    p,
    path.join(docs, p),
    path.join(docs, 'Informes', p),
    path.join(home, 'Downloads', p),
    path.join(home, 'Desktop', p),
    path.join(home, 'Pictures', p),
    path.join(docs, path.basename(p)),
    path.join(home, 'Downloads', path.basename(p)),
  ]) {
    try {
      if (c && fs.existsSync(c) && fs.statSync(c).isFile()) return path.resolve(c);
    } catch {}
  }
  return path.isAbsolute(p) ? p : path.join(docs, p);
}

async function ocrImage(params) {
  const resolved = resolveImage(params.path || params.file || params.image);
  if (!resolved || !fs.existsSync(resolved)) {
    return {
      ok: false,
      result:
        'No encuentro la imagen. Indica ruta o ponla en Documentos/Descargas/Escritorio.',
    };
  }
  return runPythonTool(
    'ocr_image',
    {
      path: resolved,
      lang: params.lang || 'spa+eng',
    },
    120000,
  );
}

async function ocrPdf(params) {
  const resolved = resolveImage(params.path || params.file);
  if (!resolved || !fs.existsSync(resolved)) {
    return { ok: false, result: 'PDF no encontrado: ' + (params.path || '') };
  }
  return runPythonTool(
    'ocr_pdf',
    {
      path: resolved,
      max_pages: params.max_pages || 5,
      lang: params.lang || 'spa+eng',
    },
    180000,
  );
}

/**
 * Flujo inteligente: texto nativo PDF → si vacío, OCR → si falla, sugiere vision
 */
async function extractPdfSmart(params) {
  const files = require('./files-reliability.cjs');
  const native = await files.summarizePdfSafe({
    path: params.path,
    max_pages: params.max_pages || 20,
  });
  if (native.ok && native.result && !/sin texto extraíble|escaneado/i.test(native.result)) {
    return { ...native, via: 'pdf-native' };
  }
  const ocr = await ocrPdf(params);
  if (ocr.ok) return { ...ocr, via: 'ocr' };
  return {
    ok: false,
    result:
      (ocr.result || native.result || 'Sin texto') +
      ' · Alternativa: usa analyze_image / visión multimodal si tienes API key.',
    via: 'failed',
  };
}

module.exports = {
  ocrImage,
  ocrPdf,
  extractPdfSmart,
  resolveImage,
};
