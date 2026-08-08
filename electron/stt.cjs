/**
 * STT — Whisper (Groq) orientado a conversación natural en español
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getConfig, ensureDefaultConfig } = require('./agent.cjs');

const SPANISH_PROMPT =
  'Conversación en español latino entre el usuario y ELYRA, asistente de voz del escritorio. ' +
  'Transcribe tal como se habla: natural, con muletillas si las hay. ' +
  'Palabras frecuentes: oye, abre, cierra, word, excel, chrome, calculadora, volumen, captura, ' +
  'documentos, descargas, busca, crea, informe, apaga, silencia, bloquea, cadmio, plaguicidas, ' +
  'laboratorio, cronograma, datos, proceso, ventana, escribe, haz clic, ejecuta, notepad, ' +
  'powerpoint, youtube, google, gracias, por favor, listo, espera, dime, explícame.';

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
    [/\bgüord\b/gi, 'word'],
    [/\bcrom\b/gi, 'chrome'],
    [/\bgrome\b/gi, 'chrome'],
    [/\bcrhome\b/gi, 'chrome'],
    [/\bnot pad\b/gi, 'notepad'],
    [/\bvs code\b/gi, 'code'],
    [/\belira\b/gi, 'elyra'],
    [/\beliara\b/gi, 'elyra'],
    [/\beliara\b/gi, 'elyra'],
    [/\byutub\b/gi, 'youtube'],
    [/\byutube\b/gi, 'youtube'],
    [/\bcadmio\b/gi, 'cadmio'],
    [/\bexcelente\b/gi, 'excel'],
    [/\bpoder point\b/gi, 'powerpoint'],
    [/\bgoogol\b/gi, 'google'],
    [/\bguagol\b/gi, 'google'],
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

  try {
    const p = path.join(os.homedir(), '.elyra', 'config.json');
    if (fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (raw.sttApiKey) config.sttApiKey = raw.sttApiKey;
    }
  } catch {}

  if (!buffer || buffer.length < 200) {
    return { ok: false, error: 'Audio demasiado corto. Habla un segundo más cerca del micrófono.' };
  }

  const apiKey = resolveSttKey(config);
  if (!apiKey) {
    return {
      ok: false,
      error:
        'Para entenderte por voz necesito una API key de Groq (gsk_…). ' +
        'El chat puede usar NVIDIA o Gemini; la escucha usa Groq. ' +
        'Guarda sttApiKey o define ELYRA_STT_KEY.',
      code: 'NO_STT_KEY',
    };
  }

  const provider = sttEndpointForKey(apiKey);
  if (!provider) {
    return {
      ok: false,
      error: 'La clave no sirve para transcribir. Usa una clave Groq (gsk_…).',
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
          error: 'No capté bien lo que dijiste. Habla un poco más claro y cerca.',
          code: 'EMPTY',
        };
      }
      return { ok: true, text, model };
    } catch (e) {
      lastErr = e.message || String(e);
      if (e.status === 429) {
        return { ok: false, error: 'Límite de voz un momento. Espera 20 segundos.', code: 'RATE' };
      }
      if (e.status === 401 || e.status === 403) {
        return {
          ok: false,
          error: 'Clave de voz inválida. Revisa la API key Groq (gsk_…).',
          code: 'AUTH',
        };
      }
    }
  }

  return {
    ok: false,
    error: lastErr
      ? 'No pude transcribir: ' + lastErr.slice(0, 120)
      : 'No pude entender el audio. Prueba otra vez.',
    code: 'FAIL',
  };
}

module.exports = { transcribeBuffer, cleanTranscript, resolveSttKey };
