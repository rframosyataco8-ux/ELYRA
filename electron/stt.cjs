/**
 * STT helpers — Whisper turbo con prompt en español + fallback
 */
const { getConfig, ensureDefaultConfig } = require('./agent.cjs');

const SPANISH_PROMPT =
  'Conversación en español. El usuario habla con un asistente de escritorio llamado ELYRA. ' +
  'Palabras frecuentes: abre, word, excel, chrome, calculadora, volumen, captura, documentos, descargas, ' +
  'hola, gracias, busca, crea, informe, apaga, silencia, bloquea.';

function cleanTranscript(text) {
  if (!text) return '';
  let t = text.trim();
  // Quitar muletillas típicas de alucinación de Whisper en silencio
  const junk = [
    /^(thanks for watching[.!]?)\s*$/i,
    /^(thank you[.!]?)\s*$/i,
    /^(gracias por ver[.!]?)\s*$/i,
    /^(subtitles by.*)\s*$/i,
    /^(amara\.org.*)\s*$/i,
    /^\s*[.…]\s*$/,
  ];
  for (const re of junk) {
    if (re.test(t)) return '';
  }
  // Corrección ligera STT
  const fixes = [
    [/\bwork\b/gi, 'word'],
    [/\bwuar\b/gi, 'word'],
    [/\bcrom\b/gi, 'chrome'],
    [/\bgrome\b/gi, 'chrome'],
    [/\bnot pad\b/gi, 'notepad'],
    [/\bvs code\b/gi, 'code'],
  ];
  for (const [re, rep] of fixes) t = t.replace(re, rep);
  return t.trim();
}

async function transcribeBuffer(buffer, mimeType) {
  ensureDefaultConfig();
  const config = getConfig();
  if (!config.apiKey) return { ok: false, error: 'Sin API key en configuración de ELYRA' };

  const ext = (mimeType || '').includes('mp4')
    ? 'mp4'
    : (mimeType || '').includes('ogg')
    ? 'ogg'
    : (mimeType || '').includes('wav')
    ? 'wav'
    : 'webm';

  const models = ['whisper-large-v3-turbo', 'whisper-large-v3'];

  for (const model of models) {
    try {
      const form = new FormData();
      form.append('file', new Blob([buffer], { type: mimeType || 'audio/webm' }), `audio.${ext}`);
      form.append('model', model);
      form.append('language', 'es');
      form.append('response_format', 'json');
      form.append('temperature', '0');
      form.append('prompt', SPANISH_PROMPT);

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}` },
        body: form,
      });

      if (!res.ok) {
        if (res.status === 429) {
          return { ok: false, error: 'Límite de uso de voz. Espera un momento.' };
        }
        // probar siguiente modelo
        continue;
      }

      const data = await res.json();
      const text = cleanTranscript(data.text || '');
      if (!text) {
        return {
          ok: false,
          error: 'No detecté palabras claras. Habla un poco más cerca y despacio.',
        };
      }
      return { ok: true, text, model };
    } catch (e) {
      if (model === models[models.length - 1]) {
        return { ok: false, error: e.message || 'Error de reconocimiento' };
      }
    }
  }

  return { ok: false, error: 'No pude transcribir el audio.' };
}

module.exports = { transcribeBuffer, cleanTranscript };
