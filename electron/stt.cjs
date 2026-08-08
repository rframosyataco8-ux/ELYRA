/**
 * STT — Whisper (Groq) con clave dedicada + fallbacks
 * Nota: la transcripción Whisper en la nube usa API de Groq (gsk_…),
 * independiente de NVIDIA/Gemini para el chat.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getConfig, ensureDefaultConfig } = require('./agent.cjs');

const SPANISH_PROMPT =
  'El usuario habla en español latino con ELYRA, asistente de escritorio y laboratorio. ' +
  'Transcribe exactamente lo dicho. Vocabulario frecuente: abre, cierra, word, excel, chrome, ' +
  'calculadora, volumen, captura, documentos, descargas, hola, gracias, busca, crea, informe, ' +
  'apaga, silencia, bloquea, cadmio, plaguicidas, laboratorio, cronograma, datos, proceso, ' +
  'ventana, escribe, haz clic, ejecuta, powershell, notepad, powerpoint, youtube, google.';

function cleanTranscript(text) {
  if (!text) return '';
  let t = text.trim();
  const junk = [
    /^(thanks for watching[.!]?)\s*$/i,
    /^(thank you[.!]?)\s*$/i,
    /^(gracias por ver[.!]?)\s*$/i,
    /^(subtitles by.*)\s*$/i,
    /^(amara\.org.*)\s*$/i,
    /^(subscribe.*)\s*$/i,
    /^\s*[.…]\s*$/,
  ];
  for (const re of junk) {
    if (re.test(t)) return '';
  }
  const fixes = [
    [/\bwork\b/gi, 'word'],
    [/\bwuar\b/gi, 'word'],
    [/\bcrom\b/gi, 'chrome'],
    [/\bgrome\b/gi, 'chrome'],
    [/\bcrhome\b/gi, 'chrome'],
    [/\bnot pad\b/gi, 'notepad'],
    [/\bvs code\b/gi, 'code'],
    [/\belira\b/gi, 'elyra'],
    [/\beliara\b/gi, 'elyra'],
    [/\byutub\b/gi, 'youtube'],
    [/\bcadmio\b/gi, 'cadmio'],
  ];
  for (const [re, rep] of fixes) t = t.replace(re, rep);
  return t.trim();
}

function resolveSttKey(config) {
  const candidates = [
    config.sttApiKey,
    process.env.ELYRA_STT_KEY,
    process.env.GROQ_API_KEY,
    config.apiKey,
  ];
  for (const k of candidates) {
    const key = (k || '').trim();
    if (key.startsWith('gsk_')) return key;
  }
  // Último recurso: si la clave principal es OpenAI sk- (no sk-ant, no sk-or)
  const main = (config.apiKey || '').trim();
  if (main.startsWith('sk-') && !main.startsWith('sk-ant') && !main.startsWith('sk-or')) {
    return main;
  }
  return '';
}

function sttEndpointForKey(key) {
  if (key.startsWith('gsk_')) {
    return {
      url: 'https://api.groq.com/openai/v1/audio/transcriptions',
      models: ['whisper-large-v3-turbo', 'whisper-large-v3'],
    };
  }
  if (key.startsWith('sk-')) {
    return {
      url: 'https://api.openai.com/v1/audio/transcriptions',
      models: ['whisper-1'],
    };
  }
  return null;
}

async function transcribeWithProvider(buffer, mimeType, apiKey, endpoint, model) {
  const ext = (mimeType || '').includes('mp4')
    ? 'mp4'
    : (mimeType || '').includes('ogg')
      ? 'ogg'
      : (mimeType || '').includes('wav')
        ? 'wav'
        : 'webm';

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType || 'audio/webm' }), `audio.${ext}`);
  form.append('model', model);
  form.append('language', 'es');
  form.append('response_format', 'json');
  form.append('temperature', '0');
  form.append('prompt', SPANISH_PROMPT);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey },
    body: form,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    const err = new Error('HTTP ' + res.status + ' ' + errBody.slice(0, 180));
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return cleanTranscript(data.text || '');
}

async function transcribeBuffer(buffer, mimeType) {
  ensureDefaultConfig();
  const config = getConfig();

  // Ampliar config con sttApiKey si existe en disco
  try {
    const p = path.join(os.homedir(), '.elyra', 'config.json');
    if (fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (raw.sttApiKey) config.sttApiKey = raw.sttApiKey;
    }
  } catch {}

  if (!buffer || buffer.length < 200) {
    return { ok: false, error: 'Audio demasiado corto. Mantén pulsado e habla un poco más.' };
  }

  const apiKey = resolveSttKey(config);
  if (!apiKey) {
    return {
      ok: false,
      error:
        'Para oírte con Whisper necesito una API key de Groq (gsk_…). ' +
        'Puedes usar NVIDIA/Gemini para el chat, pero la voz requiere Groq. ' +
        'Guarda una clave gsk_ en Configuración o define ELYRA_STT_KEY.',
      code: 'NO_STT_KEY',
    };
  }

  const provider = sttEndpointForKey(apiKey);
  if (!provider) {
    return {
      ok: false,
      error: 'La clave actual no sirve para transcribir. Usa una clave Groq (gsk_…).',
      code: 'BAD_STT_KEY',
    };
  }

  let lastErr = '';
  for (const model of provider.models) {
    try {
      const text = await transcribeWithProvider(buffer, mimeType, apiKey, provider.url, model);
      if (!text) {
        return {
          ok: false,
          error: 'No detecté palabras claras. Habla un poco más cerca y un segundo más largo.',
          code: 'EMPTY',
        };
      }
      return { ok: true, text, model };
    } catch (e) {
      lastErr = e.message || String(e);
      if (e.status === 429) {
        return { ok: false, error: 'Límite de uso de voz. Espera 20–30 segundos.', code: 'RATE' };
      }
      if (e.status === 401 || e.status === 403) {
        return {
          ok: false,
          error: 'Clave de voz inválida o sin permiso. Revisa la API key Groq (gsk_…).',
          code: 'AUTH',
        };
      }
      // siguiente modelo
    }
  }

  return {
    ok: false,
    error: lastErr
      ? 'No pude transcribir: ' + lastErr.slice(0, 120)
      : 'No pude transcribir el audio. Prueba de nuevo o usa una clave Groq.',
    code: 'FAIL',
  };
}

module.exports = { transcribeBuffer, cleanTranscript, resolveSttKey };
