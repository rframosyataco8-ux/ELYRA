/**
 * Natural Spanish TTS using edge-tts (Microsoft neural voices).
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { promisify } = require('util');
const { exec, execSync } = require('child_process');
const execAsync = promisify(exec);

const VOICE = 'es-ES-ElviraNeural';
// Otras opciones: es-MX-DaliaNeural, es-ES-AlvaroNeural, es-AR-ElenaNeural, es-MX-JorgeNeural

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
 * Generate MP3 and return as base64 data URL (reliable across platforms in Electron).
 */
async function synthesizeToBase64(text, options = {}) {
  const mode = checkEdgeTts();
  if (!mode) throw new Error('edge-tts no instalado. Ejecuta: pip install edge-tts');

  const tmpDir = os.tmpdir();
  const outFile = path.join(tmpDir, `elyra-tts-${Date.now()}.mp3`);
  const voice = options.voice || VOICE;
  const rate = options.rate || '+5%';
  const pitch = options.pitch || '+0Hz';

  // Limit length for TTS (very long texts can fail)
  const safeText = text.length > 2000 ? text.slice(0, 2000) + '...' : text;

  let bin = 'edge-tts';
  if (mode === 'python') bin = 'python -m edge_tts';
  if (mode === 'py') bin = 'py -m edge_tts';

  const cmd = `${bin} --voice "${voice}" --rate="${rate}" --pitch="${pitch}" --text ${JSON.stringify(safeText)} --write-media "${outFile}"`;

  await execAsync(cmd, { timeout: 90000, maxBuffer: 20 * 1024 * 1024 });

  if (!fs.existsSync(outFile)) throw new Error('No se generó el audio');

  const buf = fs.readFileSync(outFile);
  const base64 = buf.toString('base64');

  try { fs.unlinkSync(outFile); } catch {}

  return `data:audio/mpeg;base64,${base64}`;
}

module.exports = { synthesizeToBase64, checkEdgeTts, VOICE };
