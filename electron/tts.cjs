/**
 * ELYRA TTS — voz neural conversacional (casi humana).
 * Primary: es-MX-DaliaNeural (Microsoft Edge neural).
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { promisify } = require('util');
const { exec, execSync } = require('child_process');
const execAsync = promisify(exec);

const VOICE = 'es-MX-DaliaNeural';
const VOICE_FALLBACKS = [
  'es-MX-RenataNeural',
  'es-ES-XimenaNeural',
  'es-MX-CarlotaNeural',
  'es-ES-ElviraNeural',
];

/* Un poco más lenta y cálida = más natural */
const DEFAULT_RATE = '-6%';
const DEFAULT_PITCH = '+1Hz';

let edgeTtsAvailable = null;

function checkEdgeTts() {
  if (edgeTtsAvailable !== null) return edgeTtsAvailable;
  try {
    execSync('edge-tts --version', { stdio: 'ignore', timeout: 5000 });
    edgeTtsAvailable = true;
  } catch {
    try {
      execSync('python -m edge_tts --version', { stdio: 'ignore', timeout: 5000 });
      edgeTtsAvailable = 'python';
    } catch {
      try {
        execSync('py -m edge_tts --version', { stdio: 'ignore', timeout: 5000 });
        edgeTtsAvailable = 'py';
      } catch {
        edgeTtsAvailable = false;
      }
    }
  }
  return edgeTtsAvailable;
}

function cleanForSpeech(text) {
  if (!text) return '';
  let t = String(text);

  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/`([^`]+)`/g, '$1');
  t = t.replace(/\*\*?([^*]+)\*\*?/g, '$1');
  t = t.replace(/__?([^_]+)__?/g, '$1');
  t = t.replace(/^#+\s+/gm, '');
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  if (/rate limit|429|tokens per day|TPD/i.test(t)) {
    return 'He alcanzado un límite temporal. Espera un momento e inténtalo de nuevo.';
  }
  if (/LLM\s*\d{3}|Error del modelo/i.test(t) && t.length > 120) {
    return 'Hubo un problema al conectar con la inteligencia. Inténtalo de nuevo en unos segundos.';
  }

  t = t.replace(/https?:\/\/[^\s]+/g, ' un enlace ');
  t = t.replace(/[A-Za-z]:\\[^\s\]"']+/g, ' la carpeta de documentos ');
  t = t.replace(/\\+/g, ' ');
  t = t.replace(/\/(?:Users|home|Documents|Informes)[^\s]*/gi, ' la ruta del archivo ');
  t = t.replace(/[_|<>{}\[\]#~^]/g, ' ');
  t = t.replace(/&/g, ' y ');
  t = t.replace(/\//g, ' ');
  t = t.replace(/\{[\s\S]*\}/g, ' ');
  t = t.replace(/org_[a-zA-Z0-9]+/g, ' ');
  t = t.replace(/gsk_[a-zA-Z0-9]+/g, ' ');
  t = t.replace(/nvapi-[a-zA-Z0-9]+/g, ' ');

  t = t.replace(/\s+/g, ' ').trim();

  if (t.length > 1100) {
    t = t.slice(0, 1100);
    const last = t.lastIndexOf('.');
    if (last > 400) t = t.slice(0, last + 1);
    else t += '.';
  }

  return t;
}

/**
 * Hace el texto más hablable: pausas, respiración, menos robótico.
 */
function humanizePunctuation(text) {
  let t = text;
  t = t.replace(/([.,;:!?])([A-Za-zÁÉÍÓÚáéíóúñÑ])/g, '$1 $2');
  t = t.replace(/\.{2,}/g, '.');
  t = t.replace(/\s+y\s+/gi, ', y ');
  t = t.replace(/,\s*,/g, ',');
  // Frases largas → punto natural
  t = t.replace(/([^.!?]{90,}?)\s+(y|pero|aunque|además|también|entonces|así que)\s+/gi, '$1. $2 ');
  // Evitar mayúsculas agresivas
  t = t.replace(/\b([A-ZÁÉÍÓÚÑ]{4,})\b/g, (m) => m.charAt(0) + m.slice(1).toLowerCase());
  // Números simples a palabras cortas
  t = t.replace(/\b100%\b/g, 'cien por ciento');
  t = t.replace(/\bOK\b/gi, 'de acuerdo');
  return t.replace(/\s+/g, ' ').trim();
}

async function synthesizeOnce(bin, voice, rate, pitch, safeText, outFile) {
  const cmd =
    `${bin} --voice "${voice}" --rate="${rate}" --pitch="${pitch}" ` +
    `--text ${JSON.stringify(safeText)} --write-media "${outFile}"`;
  await execAsync(cmd, { timeout: 90000, maxBuffer: 20 * 1024 * 1024 });
  if (!fs.existsSync(outFile)) throw new Error('No se generó el audio');
}

async function synthesizeToBase64(text, options = {}) {
  const mode = checkEdgeTts();
  if (!mode) throw new Error('edge-tts no instalado. Ejecuta: pip install edge-tts');

  let safeText = humanizePunctuation(cleanForSpeech(text));
  if (!safeText) throw new Error('Texto vacío tras limpiar');

  const tmpDir = os.tmpdir();
  const outFile = path.join(tmpDir, `elyra-tts-${Date.now()}.mp3`);
  const rate = options.rate || DEFAULT_RATE;
  const pitch = options.pitch || DEFAULT_PITCH;

  let bin = 'edge-tts';
  if (mode === 'python') bin = 'python -m edge_tts';
  if (mode === 'py') bin = 'py -m edge_tts';

  const voices = [options.voice || VOICE, ...VOICE_FALLBACKS];
  let lastErr;
  for (const voice of voices) {
    try {
      await synthesizeOnce(bin, voice, rate, pitch, safeText, outFile);
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      try {
        if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
      } catch {}
    }
  }
  if (lastErr) throw lastErr;

  const buf = fs.readFileSync(outFile);
  const base64 = buf.toString('base64');
  try {
    fs.unlinkSync(outFile);
  } catch {}

  return `data:audio/mpeg;base64,${base64}`;
}

module.exports = {
  synthesizeToBase64,
  checkEdgeTts,
  cleanForSpeech,
  VOICE,
  DEFAULT_RATE,
  DEFAULT_PITCH,
};
