/**
 * ELYRA TTS — voz femenina natural (casi humana).
 * Voz fija: es-MX-DaliaNeural (Microsoft neural, español México)
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { promisify } = require('util');
const { exec, execSync } = require('child_process');
const execAsync = promisify(exec);

// Voz femenina muy natural (México). Alternativa España: es-ES-ElviraNeural
const VOICE = 'es-MX-DaliaNeural';
// Ritmo y tono cercanos a una persona real hablando con calma
const DEFAULT_RATE = '+2%';
const DEFAULT_PITCH = '+0Hz';

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

  // Errores técnicos crudos → frase humana
  if (/rate limit|429|tokens per day|TPD/i.test(t)) {
    return 'He alcanzado el límite temporal del modelo. Espera un momento e inténtalo de nuevo, o prueba con una frase más corta.';
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

  // Números de error / JSON feo
  t = t.replace(/\{[\s\S]*\}/g, ' ');
  t = t.replace(/org_[a-zA-Z0-9]+/g, ' ');
  t = t.replace(/gsk_[a-zA-Z0-9]+/g, ' ');

  t = t.replace(/\s+/g, ' ').trim();

  if (t.length > 900) {
    t = t.slice(0, 900);
    const last = t.lastIndexOf('.');
    if (last > 300) t = t.slice(0, last + 1);
    else t += '.';
  }

  return t;
}

/**
 * Divide en frases para síntesis más natural (pausas humanas).
 * edge-tts no tiene SSML completo en CLI simple; usamos el texto limpio
 * con puntuación clara que la voz neural respeta bien.
 */
function humanizePunctuation(text) {
  let t = text;
  // Asegurar espacios tras puntuación
  t = t.replace(/([.,;:!?])([A-Za-zÁÉÍÓÚáéíóúñÑ])/g, '$1 $2');
  // Evitar puntos repetidos
  t = t.replace(/\.{2,}/g, '.');
  return t.replace(/\s+/g, ' ').trim();
}

async function synthesizeToBase64(text, options = {}) {
  const mode = checkEdgeTts();
  if (!mode) throw new Error('edge-tts no instalado. Ejecuta: pip install edge-tts');

  let safeText = humanizePunctuation(cleanForSpeech(text));
  if (!safeText) throw new Error('Texto vacío tras limpiar');

  const tmpDir = os.tmpdir();
  const outFile = path.join(tmpDir, `elyra-tts-${Date.now()}.mp3`);
  const voice = options.voice || VOICE;
  const rate = options.rate || DEFAULT_RATE;
  const pitch = options.pitch || DEFAULT_PITCH;

  let bin = 'edge-tts';
  if (mode === 'python') bin = 'python -m edge_tts';
  if (mode === 'py') bin = 'py -m edge_tts';

  const cmd = `${bin} --voice "${voice}" --rate="${rate}" --pitch="${pitch}" --text ${JSON.stringify(safeText)} --write-media "${outFile}"`;

  await execAsync(cmd, { timeout: 90000, maxBuffer: 20 * 1024 * 1024 });

  if (!fs.existsSync(outFile)) throw new Error('No se generó el audio');

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
