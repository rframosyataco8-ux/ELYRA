/**
 * ELYRA TTS — voz masculina natural estilo JARVIS (calmada, clara, consistente).
 * Usa edge-tts con una sola voz fija: es-ES-AlvaroNeural
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { promisify } = require('util');
const { exec, execSync } = require('child_process');
const execAsync = promisify(exec);

// Voz única y estable (hombre, español España, natural)
const VOICE = 'es-ES-AlvaroNeural';
// Ritmo más pausado y tono ligeramente grave = sensación tipo JARVIS
const DEFAULT_RATE = '-10%';
const DEFAULT_PITCH = '-3Hz';

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

/**
 * Limpia el texto para que NO se lean rutas, barras invertidas, markdown, etc.
 */
function cleanForSpeech(text) {
  if (!text) return '';
  let t = String(text);

  // Bloques de código
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/`([^`]+)`/g, '$1');

  // Markdown
  t = t.replace(/\*\*?([^*]+)\*\*?/g, '$1');
  t = t.replace(/__?([^_]+)__?/g, '$1');
  t = t.replace(/^#+\s+/gm, '');
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // URLs
  t = t.replace(/https?:\/\/[^\s]+/g, ' un enlace ');

  // Rutas Windows (C:\Users\...)
  t = t.replace(/[A-Za-z]:\\[^\s\]"']+/g, ' la carpeta de documentos ');
  // Barras invertidas sueltas o restantes
  t = t.replace(/\\+/g, ' ');
  // Rutas estilo Unix largas
  t = t.replace(/\/(?:Users|home|Documents|Informes)[^\s]*/gi, ' la ruta del archivo ');

  // Caracteres que el TTS deletrea mal
  t = t.replace(/[_|<>{}\[\]#~^]/g, ' ');
  t = t.replace(/&/g, ' y ');
  t = t.replace(/\//g, ' ');

  // Espacios múltiples
  t = t.replace(/\s+/g, ' ').trim();

  // Límite razonable para voz
  if (t.length > 1200) {
    t = t.slice(0, 1200);
    const last = t.lastIndexOf('.');
    if (last > 400) t = t.slice(0, last + 1);
    else t += '.';
  }

  return t;
}

async function synthesizeToBase64(text, options = {}) {
  const mode = checkEdgeTts();
  if (!mode) throw new Error('edge-tts no instalado. Ejecuta: pip install edge-tts');

  const safeText = cleanForSpeech(text);
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
