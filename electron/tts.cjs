/**
 * Natural Spanish TTS using edge-tts (Microsoft neural voices).
 * Falls back to a simple message if edge-tts is not installed.
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);

const VOICE = 'es-ES-ElviraNeural'; // Natural female Spanish (Spain)
// Alternatives: es-MX-DaliaNeural, es-ES-AlvaroNeural (male), es-AR-ElenaNeural

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
      edgeTtsAvailable = false;
    }
  }
  return edgeTtsAvailable;
}

/**
 * Speak text with natural neural voice. Returns a Promise that resolves when playback ends.
 */
function speakNatural(text, options = {}) {
  return new Promise(async (resolve, reject) => {
    const mode = checkEdgeTts();
    if (!mode) {
      reject(new Error('edge-tts no instalado. Ejecuta: pip install edge-tts'));
      return;
    }

    const tmpDir = os.tmpdir();
    const outFile = path.join(tmpDir, `elyra-tts-${Date.now()}.mp3`);
    const voice = options.voice || VOICE;
    const rate = options.rate || '+0%';
    const pitch = options.pitch || '+0Hz';

    try {
      const cmd =
        mode === 'python'
          ? `python -m edge_tts --voice "${voice}" --rate="${rate}" --pitch="${pitch}" --text ${JSON.stringify(text)} --write-media "${outFile}"`
          : `edge-tts --voice "${voice}" --rate="${rate}" --pitch="${pitch}" --text ${JSON.stringify(text)} --write-media "${outFile}"`;

      await execAsync(cmd, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 });

      if (!fs.existsSync(outFile)) {
        reject(new Error('No se generó el audio'));
        return;
      }

      // Play with platform-native player
      let playCmd;
      if (process.platform === 'win32') {
        // PowerShell Media.SoundPlayer doesn't do mp3 well; use start with default assoc or ffplay
        playCmd = `powershell -c "(New-Object Media.SoundPlayer '${outFile}').PlaySync()"`;
        // Better: use Windows Media Foundation via a small approach
        playCmd = `powershell -c "Add-Type -AssemblyName presentationCore; $p = New-Object System.Windows.Media.MediaPlayer; $p.Open([uri]'${outFile.replace(/\\/g, '/')}'); $p.Play(); Start-Sleep -Seconds (Get-Item '${outFile}').Length / 16000; $p.Stop()"`;
      } else if (process.platform === 'darwin') {
        playCmd = `afplay "${outFile}"`;
      } else {
        playCmd = `ffplay -nodisp -autoexit -loglevel quiet "${outFile}" || aplay "${outFile}" || paplay "${outFile}"`;
      }

      // Simpler cross-platform: use electron's approach - return file path and let renderer play
      // For main process we play here
      if (process.platform === 'win32') {
        // Use start / wait with a VBScript or just leave file for renderer
        // Most reliable on Windows without extra deps: return path
        resolve({ file: outFile, method: 'file' });
        return;
      }

      await execAsync(playCmd, { timeout: 120000 });
      try { fs.unlinkSync(outFile); } catch {}
      resolve({ method: 'played' });
    } catch (err) {
      try { if (fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch {}
      reject(err);
    }
  });
}

/**
 * Generate MP3 file and return path (for renderer to play with HTMLAudioElement — more reliable).
 */
async function synthesizeToFile(text, options = {}) {
  const mode = checkEdgeTts();
  if (!mode) throw new Error('edge-tts no instalado. Ejecuta: pip install edge-tts');

  const tmpDir = os.tmpdir();
  const outFile = path.join(tmpDir, `elyra-tts-${Date.now()}.mp3`);
  const voice = options.voice || VOICE;
  const rate = options.rate || '+5%'; // slightly faster = more natural
  const pitch = options.pitch || '+0Hz';

  const cmd =
    mode === 'python'
      ? `python -m edge_tts --voice "${voice}" --rate="${rate}" --pitch="${pitch}" --text ${JSON.stringify(text)} --write-media "${outFile}"`
      : `edge-tts --voice "${voice}" --rate="${rate}" --pitch="${pitch}" --text ${JSON.stringify(text)} --write-media "${outFile}"`;

  await execAsync(cmd, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
  if (!fs.existsSync(outFile)) throw new Error('No se generó el audio');
  return outFile;
}

module.exports = { speakNatural, synthesizeToFile, checkEdgeTts, VOICE };
