/**
 * ELYRA TTS — voz neural máxima naturalidad (sin ElevenLabs)
 * Preferencia: tts_speak.py (edge-tts) → CLI edge-tts → error claro
 * Voz: es-MX-DaliaNeural calibrada para conversación latina.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { promisify } = require('util');
const { exec, execSync, spawn } = require('child_process');
const execAsync = promisify(exec);

const EDGE_VOICE = 'es-MX-DaliaNeural';
const EDGE_FALLBACKS = [
  'es-MX-RenataNeural',
  'es-MX-CarlotaNeural',
  'es-MX-NuriaNeural',
  'es-ES-XimenaNeural',
  'es-ES-ElviraNeural',
];

/* Calibración fina: un poco más lenta, tono cálido */
const DEFAULT_RATE = '-8%';
const DEFAULT_PITCH = '+2Hz';
const DEFAULT_VOLUME = '+0%';

let edgeTtsAvailable = null;

function getConfigPath() {
  return path.join(os.homedir(), '.elyra', 'config.json');
}

function readTtsConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(getConfigPath(), 'utf-8'));
    return {
      edgeVoice: raw.edgeVoice || EDGE_VOICE,
      rate: raw.ttsRate || DEFAULT_RATE,
      pitch: raw.ttsPitch || DEFAULT_PITCH,
      volume: raw.ttsVolume || DEFAULT_VOLUME,
    };
  } catch {
    return {
      edgeVoice: EDGE_VOICE,
      rate: DEFAULT_RATE,
      pitch: DEFAULT_PITCH,
      volume: DEFAULT_VOLUME,
    };
  }
}

function checkEdgeTts() {
  if (edgeTtsAvailable !== null) return edgeTtsAvailable;
  try {
    execSync('edge-tts --version', { stdio: 'ignore', timeout: 5000 });
    edgeTtsAvailable = true;
  } catch {
    try {
      execSync('python -c "import edge_tts"', { stdio: 'ignore', timeout: 5000 });
      edgeTtsAvailable = 'python';
    } catch {
      try {
        execSync('py -c "import edge_tts"', { stdio: 'ignore', timeout: 5000 });
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
  t = t.replace(/^[-•*]\s+/gm, '');
  t = t.replace(/\|\s*/g, ', ');

  if (/rate limit|429|tokens per day|TPD/i.test(t)) {
    return 'He alcanzado un límite temporal. Espera un momento e inténtalo de nuevo.';
  }
  if (/LLM\s*\d{3}|Error del modelo/i.test(t) && t.length > 120) {
    return 'Hubo un problema al conectar con la inteligencia. Inténtalo de nuevo en unos segundos.';
  }

  t = t.replace(/https?:\/\/[^\s]+/g, ' un enlace ');
  t = t.replace(/[A-Za-z]:\\[^\s\]"']+/g, ' la carpeta ');
  t = t.replace(/\\+/g, ' ');
  t = t.replace(/\/(?:Users|home|Documents|Informes)[^\s]*/gi, ' la ruta ');
  t = t.replace(/[_|<>{}\[\]#~^]/g, ' ');
  t = t.replace(/&/g, ' y ');
  t = t.replace(/\//g, ' ');
  t = t.replace(/\{[\s\S]*\}/g, ' ');
  t = t.replace(/org_[a-zA-Z0-9]+/g, ' ');
  t = t.replace(/gsk_[a-zA-Z0-9]+/g, ' ');
  t = t.replace(/nvapi-[a-zA-Z0-9_-]+/g, ' ');

  t = t.replace(/\bOK\b/gi, 'de acuerdo');
  t = t.replace(/\bPDF\b/g, 'pe de efe');
  t = t.replace(/\bURL\b/g, 'enlace');
  t = t.replace(/\bAPI\b/g, 'a pe i');
  t = t.replace(/\bCPU\b/g, 'procesador');
  t = t.replace(/\bRAM\b/g, 'memoria');
  t = t.replace(/\bGB\b/g, 'gigas');
  t = t.replace(/\bMB\b/g, 'megas');
  t = t.replace(/\b(\d+)\s*%/g, '$1 por ciento');
  t = t.replace(/\b(\d+)\s*°\s*C\b/gi, '$1 grados');

  // Frases de sistema más hablables
  t = t.replace(/\bListo\.?\b/gi, 'Listo.');
  t = t.replace(/\bHecho\.?\b/gi, 'Hecho.');
  t = t.replace(/\bCorrecto\.?\b/gi, 'Correcto.');

  t = t.replace(/\s+/g, ' ').trim();

  if (t.length > 1400) {
    t = t.slice(0, 1400);
    const last = t.lastIndexOf('.');
    if (last > 500) t = t.slice(0, last + 1);
    else t += '.';
  }
  return t;
}

function humanizePunctuation(text) {
  let t = text;
  t = t.replace(/([.,;:!?])([A-Za-zÁÉÍÓÚáéíóúñÑ0-9])/g, '$1 $2');
  t = t.replace(/\.{2,}/g, '.');
  t = t.replace(/!{2,}/g, '!');
  t = t.replace(/\?{2,}/g, '?');
  t = t.replace(/\s+y\s+/gi, ', y ');
  t = t.replace(/,\s*,/g, ',');
  t = t.replace(
    /([^.!?]{65,}?)\s+(y|pero|aunque|además|también|entonces|así que|porque|cuando|donde)\s+/gi,
    '$1. $2 ',
  );
  t = t.replace(/:\s*/g, '. ');
  t = t.replace(/;/g, '.');
  t = t.replace(/\b([A-ZÁÉÍÓÚÑ]{5,})\b/g, (m) => m.charAt(0) + m.slice(1).toLowerCase());
  t = t.replace(/\b100\b/g, 'cien');
  t = t.replace(/\s+/g, ' ').trim();
  if (t && !/[.!?…]$/.test(t)) t += '.';
  return t;
}

function resolveBin(mode) {
  if (mode === 'python') return 'python -m edge_tts';
  if (mode === 'py') return 'py -m edge_tts';
  return 'edge-tts';
}

function findPython() {
  for (const cmd of ['python', 'py', 'python3']) {
    try {
      execSync(cmd + ' -c "import edge_tts"', { stdio: 'ignore', timeout: 5000 });
      return cmd;
    } catch {}
  }
  return null;
}

function runPythonTts(text, outFile, cfg) {
  return new Promise((resolve, reject) => {
    const py = findPython();
    if (!py) return reject(new Error('python+edge_tts no disponible'));
    const script = path.join(__dirname, 'tts_speak.py');
    if (!fs.existsSync(script)) return reject(new Error('tts_speak.py no encontrado'));

    const args = [
      script,
      '--text',
      text,
      '--out',
      outFile,
      '--voice',
      cfg.edgeVoice || EDGE_VOICE,
      '--rate',
      cfg.rate || DEFAULT_RATE,
      '--pitch',
      cfg.pitch || DEFAULT_PITCH,
      '--volume',
      cfg.volume || DEFAULT_VOLUME,
    ];

    const child = spawn(py, args, { windowsHide: true });
    let err = '';
    child.stderr.on('data', (d) => {
      err += d.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(outFile) && fs.statSync(outFile).size > 64) {
        resolve(outFile);
      } else {
        reject(new Error(err.trim() || 'tts_speak.py falló (' + code + ')'));
      }
    });
  });
}

async function synthesizeOnceCli(bin, voice, rate, pitch, volume, safeText, outFile) {
  const cmd =
    `${bin} --voice "${voice}" --rate="${rate}" --pitch="${pitch}" --volume="${volume}" ` +
    `--text ${JSON.stringify(safeText)} --write-media "${outFile}"`;
  await execAsync(cmd, { timeout: 90000, maxBuffer: 20 * 1024 * 1024 });
  if (!fs.existsSync(outFile) || fs.statSync(outFile).size < 64) {
    throw new Error('No se generó el audio');
  }
}

async function synthesizeEdgeCli(text, cfg) {
  const mode = checkEdgeTts();
  if (!mode) throw new Error('edge-tts no instalado. Ejecuta: pip install edge-tts');

  const bin = resolveBin(mode);
  const rate = cfg.rate || DEFAULT_RATE;
  const pitch = cfg.pitch || DEFAULT_PITCH;
  const volume = cfg.volume || DEFAULT_VOLUME;
  const voices = [cfg.edgeVoice || EDGE_VOICE, ...EDGE_FALLBACKS.filter((v) => v !== cfg.edgeVoice)];
  const tmpDir = os.tmpdir();
  const outFile = path.join(tmpDir, 'elyra-tts-' + Date.now() + '.mp3');

  let lastErr;
  for (const voice of voices) {
    try {
      await synthesizeOnceCli(bin, voice, rate, pitch, volume, text, outFile);
      const buf = fs.readFileSync(outFile);
      try {
        fs.unlinkSync(outFile);
      } catch {}
      return 'data:audio/mpeg;base64,' + buf.toString('base64');
    } catch (e) {
      lastErr = e;
      try {
        if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
      } catch {}
    }
  }
  throw lastErr || new Error('Fallo TTS');
}

async function synthesizeToBase64(text, options = {}) {
  const cfg = { ...readTtsConfig(), ...options };
  const safeText = humanizePunctuation(cleanForSpeech(text));
  if (!safeText) throw new Error('Texto vacío tras limpiar');

  const tmpDir = os.tmpdir();
  const outFile = path.join(tmpDir, 'elyra-tts-py-' + Date.now() + '.mp3');

  // 1) Python helper (mejor prosodia / chunks)
  try {
    await runPythonTts(safeText, outFile, cfg);
    const buf = fs.readFileSync(outFile);
    try {
      fs.unlinkSync(outFile);
    } catch {}
    return 'data:audio/mpeg;base64,' + buf.toString('base64');
  } catch (e) {
    try {
      if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
    } catch {}
    // 2) CLI fallback
    return synthesizeEdgeCli(safeText, cfg);
  }
}

function ttsStatus() {
  const cfg = readTtsConfig();
  const mode = checkEdgeTts();
  const py = findPython();
  return {
    edgeTts: !!mode || !!py,
    elevenLabs: false,
    voice: cfg.edgeVoice || EDGE_VOICE,
    engine: py ? 'edge-tts-python' : mode ? 'edge-tts-cli' : 'none',
    rate: cfg.rate,
    pitch: cfg.pitch,
    volume: cfg.volume,
  };
}

module.exports = {
  synthesizeToBase64,
  checkEdgeTts,
  cleanForSpeech,
  humanizePunctuation,
  ttsStatus,
  VOICE: EDGE_VOICE,
  DEFAULT_RATE,
  DEFAULT_PITCH,
  DEFAULT_VOLUME,
};
