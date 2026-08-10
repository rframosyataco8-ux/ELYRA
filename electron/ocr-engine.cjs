/**
 * ELYRA 1.4 — OCR local + extract PDF inteligente
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const OCR_SCRIPT = path.join(__dirname, 'python_tools', 'ocr_runner.py');

function findPython() {
  return process.platform === 'win32' ? 'py' : 'python3';
}

function runOcrTool(tool, args, timeoutMs = 120000) {
  return new Promise((resolve) => {
    if (!fs.existsSync(OCR_SCRIPT)) {
      resolve({ ok: false, result: 'ocr_runner.py no encontrado' });
      return;
    }
    const payload = JSON.stringify({ tool, args });
    const child = spawn(findPython(), [OCR_SCRIPT], {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {}
      resolve({ ok: false, result: 'Timeout OCR' });
    }, timeoutMs);
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, result: 'Python OCR: ' + err.message });
    });
    child.on('close', () => {
      clearTimeout(timer);
      try {
        const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop() || '';
        resolve(JSON.parse(line));
      } catch {
        resolve({
          ok: false,
          result: (stderr || stdout || 'Error OCR').slice(0, 600),
        });
      }
    });
    child.stdin.write(payload);
    child.stdin.end();
  });
}

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
    return { ok: false, result: 'Imagen no encontrada.' };
  }
  return runOcrTool('ocr_image', { path: resolved, lang: params.lang || 'spa+eng' });
}

async function ocrPdf(params) {
  const resolved = resolveImage(params.path || params.file);
  if (!resolved || !fs.existsSync(resolved)) {
    return { ok: false, result: 'PDF no encontrado.' };
  }
  return runOcrTool(
    'ocr_pdf',
    {
      path: resolved,
      max_pages: params.max_pages || 5,
      lang: params.lang || 'spa+eng',
    },
    180000,
  );
}

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
      ' · Alternativa: analyze_image con modelo multimodal.',
    via: 'failed',
  };
}

/**
 * Diálogo nativo + visión o OCR
 */
async function pickAndAnalyze(prompt, getConfig) {
  const { dialog } = require('electron');
  const result = dialog.showOpenDialogSync({
    title: 'ELYRA — Seleccionar imagen',
    filters: [
      { name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] },
      { name: 'Todos', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (!result || !result[0]) {
    return { ok: false, result: 'No se seleccionó imagen.' };
  }
  return analyzePath(result[0], prompt, getConfig);
}

async function analyzePath(filePath, prompt, getConfig) {
  const vision = require('./vision-engine.cjs');
  const cfg = typeof getConfig === 'function' ? getConfig() : getConfig || {};
  if (cfg.apiKey) {
    const v = await vision.analyzeImage(
      {
        path: filePath,
        prompt: prompt || 'Describe la imagen y transcribe cualquier texto visible en español.',
      },
      cfg,
    );
    if (v.ok) return { ...v, path: filePath, via: 'vision' };
  }
  const o = await ocrImage({ path: filePath });
  if (o.ok) return { ...o, path: filePath, via: 'ocr' };
  return {
    ok: false,
    result:
      (o.result || 'No pude analizar la imagen.') +
      (cfg.apiKey ? '' : ' Configura API key multimodal o instala Tesseract.'),
    path: filePath,
  };
}

module.exports = {
  ocrImage,
  ocrPdf,
  extractPdfSmart,
  resolveImage,
  pickAndAnalyze,
  analyzePath,
};
