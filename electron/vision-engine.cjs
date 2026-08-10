/**
 * ELYRA 0.8 — Vision
 * Análisis de imágenes con proveedores OpenAI-compatibles (GPT-4o, Gemini Flash, etc.)
 * Entrada: ruta local, data URL o captura reciente.
 * No inventa endpoints propietarios; usa chat/completions + content multimodal público.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);

function mimeFor(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.bmp') return 'image/bmp';
  return 'image/jpeg';
}

function resolveImagePath(input) {
  if (!input) return null;
  let p = String(input).trim().replace(/^["']|["']$/g, '');
  if (p.startsWith('data:image')) return { type: 'dataUrl', value: p };
  if (p.startsWith('~')) p = path.join(os.homedir(), p.slice(1));
  if (path.isAbsolute(p) && fs.existsSync(p)) return { type: 'file', value: p };

  const home = os.homedir();
  const docs = path.join(home, 'Documents');
  const candidates = [
    p,
    path.join(docs, p),
    path.join(docs, 'Informes', p),
    path.join(home, 'Downloads', p),
    path.join(home, 'Desktop', p),
    path.join(docs, path.basename(p)),
    path.join(home, 'Downloads', path.basename(p)),
    path.join(home, 'Desktop', path.basename(p)),
    path.join(home, 'Pictures', path.basename(p)),
  ];
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c) && fs.statSync(c).isFile()) {
        return { type: 'file', value: path.resolve(c) };
      }
    } catch {}
  }
  return { type: 'file', value: path.isAbsolute(p) ? p : path.join(docs, p) };
}

function fileToDataUrl(filePath) {
  const buf = fs.readFileSync(filePath);
  // Límite práctico ~4MB base64 para no saturar el request
  if (buf.length > 4.5 * 1024 * 1024) {
    throw new Error('Imagen demasiado grande (máx ~4 MB). Reduce el tamaño o usa otra foto.');
  }
  const b64 = buf.toString('base64');
  return 'data:' + mimeFor(filePath) + ';base64,' + b64;
}

function pickVisionModel(config) {
  const provider = (config.provider || '').toLowerCase();
  const base = (config.baseUrl || '').toLowerCase();
  const current = config.model || '';

  // Si el usuario ya eligió un modelo con visión, respetarlo
  if (/gpt-4o|gpt-4\.1|gemini|claude|vision|llava|pixtral|grok/i.test(current)) {
    return current;
  }

  if (provider === 'gemini' || base.includes('googleapis') || base.includes('generativelanguage')) {
    return 'gemini-2.0-flash';
  }
  if (provider === 'openai' || base.includes('openai.com')) {
    return 'gpt-4o-mini';
  }
  if (provider === 'openrouter' || base.includes('openrouter')) {
    return 'openai/gpt-4o-mini';
  }
  if (provider === 'anthropic' || base.includes('anthropic')) {
    return current || 'claude-sonnet-4-20250514';
  }
  if (provider === 'xai' || base.includes('x.ai')) {
    return current || 'grok-2-vision-latest';
  }
  if (provider === 'groq' || base.includes('groq')) {
    // Groq vision models vary; prefer user model or a known multimodal if any
    return current || 'llama-3.2-11b-vision-preview';
  }
  if (provider === 'nvidia' || base.includes('nvidia')) {
    return current || 'meta/llama-3.2-11b-vision-instruct';
  }
  return current || 'gpt-4o-mini';
}

function llmHeaders(config) {
  const key = (config.apiKey || '').trim();
  const provider = (config.provider || '').toLowerCase();
  const headers = { 'Content-Type': 'application/json' };
  if (provider === 'gemini' || (config.baseUrl || '').includes('googleapis')) {
    headers.Authorization = 'Bearer ' + key;
    headers['x-goog-api-key'] = key;
  } else if (provider === 'anthropic') {
    headers['x-api-key'] = key;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers.Authorization = 'Bearer ' + key;
  }
  return headers;
}

/**
 * @param {{ path?: string, dataUrl?: string, prompt?: string, detail?: string }} opts
 * @param {object} config from agent getConfig()
 */
async function analyzeImage(opts, config) {
  const cfg = config || {};
  if (!cfg.apiKey) {
    return {
      ok: false,
      result:
        'Para visión necesitas una API key de un modelo multimodal (OpenAI GPT-4o, Gemini, etc.) en Configuración.',
    };
  }

  let dataUrl = opts.dataUrl || null;
  if (!dataUrl && opts.path) {
    const resolved = resolveImagePath(opts.path);
    if (!resolved) {
      return { ok: false, result: 'No se indicó imagen.' };
    }
    if (resolved.type === 'dataUrl') {
      dataUrl = resolved.value;
    } else {
      if (!fs.existsSync(resolved.value)) {
        return {
          ok: false,
          result:
            'No encuentro la imagen: ' +
            resolved.value +
            '. Ponla en Documentos, Descargas o Escritorio.',
        };
      }
      const ext = path.extname(resolved.value).toLowerCase();
      if (!IMAGE_EXT.has(ext)) {
        return { ok: false, result: 'Formato no soportado. Usa PNG, JPG, WEBP o GIF.' };
      }
      try {
        dataUrl = fileToDataUrl(resolved.value);
      } catch (e) {
        return { ok: false, result: e.message || String(e) };
      }
    }
  }

  if (!dataUrl) {
    return { ok: false, result: 'Falta path o dataUrl de la imagen.' };
  }

  const prompt =
    opts.prompt ||
    'Describe la imagen con claridad en español. Si hay texto legible, transcríbelo. Si parece un gráfico o tabla, resume los datos principales.';

  const model = pickVisionModel(cfg);
  const baseUrl = (cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');

  const body = {
    model,
    max_tokens: 1200,
    temperature: 0.2,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: dataUrl,
              detail: opts.detail === 'high' ? 'high' : 'auto',
            },
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(baseUrl + '/chat/completions', {
      method: 'POST',
      headers: llmHeaders(cfg),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = text.slice(0, 400);
      try {
        const j = JSON.parse(text);
        msg = j.error?.message || j.message || msg;
      } catch {}
      if (/vision|image|multimodal|not support/i.test(msg)) {
        return {
          ok: false,
          result:
            'Este modelo/proveedor no acepta imágenes. En Configuración elige GPT-4o, Gemini 2.0 Flash u otro con visión. Detalle: ' +
            msg.slice(0, 180),
        };
      }
      return { ok: false, result: 'Vision API ' + res.status + ': ' + msg.slice(0, 280) };
    }
    const data = JSON.parse(text);
    const content = data.choices?.[0]?.message?.content || '';
    if (!content) {
      return { ok: false, result: 'El modelo no devolvió descripción.' };
    }
    return {
      ok: true,
      result: String(content).trim(),
      model,
      via: 'vision-0.8',
    };
  } catch (e) {
    return {
      ok: false,
      result: 'Error de visión: ' + (e.message || String(e)).slice(0, 280),
    };
  }
}

/** Usa la última captura si pc.screenshot guarda ruta; si no, pide path */
async function analyzeScreenshot(prompt, helpers, config) {
  if (helpers && helpers.pc && typeof helpers.pc.screenshot === 'function') {
    const shot = await helpers.pc.screenshot();
    if (shot && shot.ok && shot.path && fs.existsSync(shot.path)) {
      return analyzeImage({ path: shot.path, prompt: prompt || 'Describe esta captura de pantalla.' }, config);
    }
    if (shot && shot.path) {
      return analyzeImage({ path: shot.path, prompt }, config);
    }
    return {
      ok: false,
      result:
        (shot && shot.result) ||
        'No pude obtener la captura. Indica la ruta de una imagen o guarda un screenshot.',
    };
  }
  return { ok: false, result: 'Captura no disponible en este entorno.' };
}

module.exports = {
  analyzeImage,
  analyzeScreenshot,
  resolveImagePath,
  pickVisionModel,
  fileToDataUrl,
};
