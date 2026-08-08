/**
 * ELYRA TTS — voz neural natural sin ElevenLabs
 * Motor: Microsoft Edge neural (es-MX-DaliaNeural)
 * Calibrada para conversación humana en español latino.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { promisify } = require('util');
const { exec, execSync } = require('child_process');
const execAsync = promisify(exec);

/* Voz principal: Dalia (México) — la más natural en edge-tts para es-LATAM */
const EDGE_VOICE = 'es-MX-DaliaNeural';
const EDGE_FALLBACKS = [
  'es-MX-RenataNeural',
  'es-MX-CarlotaNeural',
  'es-MX-NuriaNeural',
  'es-ES-XimenaNeural',
  'es-ES-ElviraNeural',
];

/* Calibración conversacional (más lenta + tono ligeramente cálido) */
const DEFAULT_RATE = '-7%';
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

  // Abreviaturas y símbolos a palabras hablables
  t = t.replace(/\bOK\b/gi, 'de acuerdo');
  t = t.replace(/\bPDF\b/g, 'pe de efe');
  t = t.replace(/\bURL\b/g, 'enlace');
  t = t.replace(/\bAPI\b/g, 'a pe i');
  t = t.replace(/\bCPU\b/g, 'procesador');
  t = t.replace(/\bRAM\b/g, 'memoria');
  t = t.replace(/\bGB\b/g, 'gigas');
  t = t.replace(/\bMB\b/g, 'megas');
  t = t.replace(/\b%\b/g, ' por ciento');
  t = t.replace(/\b(\d+)\s*%/g, '$1 por ciento');
  t = t.replace(/\b(\d+)\s*°\s*C\b/gi, '$1 grados');

  t = t.replace(/\s+/g, ' ').trim();

  if (t.length > 1400) {
    t = t.slice(0, 1400);
    const last = t.lastIndexOf('.');
    if (last > 500) t = t.slice(0, last + 1);
    else t += '.';
  }

  return t;
}

/**
 * Prosodia conversacional: pausas, respiración, ritmo humano.
 * Las voces neurales de Edge responden muy bien a comas y puntos bien colocados.
 */
function humanizePunctuation(text) {
  let t = text;

  // Espacio tras puntuación
  t = t.replace(/([.,;:!?])([A-Za-zÁÉÍÓÚáéíóúñÑ0-9])/g, '$1 $2');

  // Evitar puntos múltiples
  t = t.replace(/\.{2,}/g, '.');
  t = t.replace(/!{2,}/g, '!');
  t = t.replace(/\?{2,}/g, '?');

  // "y" → ", y" para pausa natural en listas
  t = t.replace(/\s+y\s+/gi, ', y ');
  t = t.replace(/,\s*,/g, ',');

  // Frases largas: cortar antes de conectores
  t = t.replace(
    /([^.!?]{75,}?)\s+(y|pero|aunque|además|también|entonces|así que|porque|cuando|donde)\s+/gi,
    '$1. $2 ',
  );

  // Tras dos puntos, respiración
  t = t.replace(/:\s*/g, '. ');

  // Punto y coma → punto (mejor para TTS neural)
  t = t.replace(/;/g, '.');

  // Mayúsculas gritonas → título suave
  t = t.replace(/\b([A-ZÁÉÍÓÚÑ]{5,})\b/g, (m) => m.charAt(0) + m.slice(1).toLowerCase());

  // Números sueltos comunes
  t = t.replace(/\b100\b/g, 'cien');
  t = t.replace(/\b1\b(?=\s+(archivo|paso|cosa|vez))/gi, 'un');

  // Asegurar que termina con puntuación (cierre de frase natural)
  t = t.replace(/\s+/g, ' ').trim();
  if (t && !/[.!?…]$/.test(t)) t += '.';

  return t;
}

/**
 * Divide en oraciones para que el motor neural respire entre frases
 * (mejor naturalidad en textos largos).
 */
function splitSentences(text) {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [text];
  // Agrupar frases cortas para no fragmentar de más
  const groups = [];
  let buf = '';
  for (const p of parts) {
    if ((buf + ' ' + p).trim().length < 180) {
      buf = (buf + ' ' + p).trim();
    } else {
      if (buf) groups.push(buf);
      buf = p;
    }
  }
  if (buf) groups.push(buf);
  return groups.length ? groups : [text];
}

function resolveBin(mode) {
  if (mode === 'python') return 'python -m edge_tts';
  if (mode === 'py') return 'py -m edge_tts';
  return 'edge-tts';
}

async function synthesizeOnce(bin, voice, rate, pitch, volume, safeText, outFile) {
  const cmd =
    `${bin} --voice "${voice}" --rate="${rate}" --pitch="${pitch}" --volume="${volume}" ` +
    `--text ${JSON.stringify(safeText)} --write-media "${outFile}"`;
  await execAsync(cmd, { timeout: 90000, maxBuffer: 20 * 1024 * 1024 });
  if (!fs.existsSync(outFile) || fs.statSync(outFile).size < 64) {
    throw new Error('No se generó el audio');
  }
}

async function synthesizeEdge(text, cfg) {
  const mode = checkEdgeTts();
  if (!mode) {
    throw new Error('edge-tts no instalado. Ejecuta en PowerShell: pip install edge-tts');
  }

  const bin = resolveBin(mode);
  const rate = cfg.rate || DEFAULT_RATE;
  const pitch = cfg.pitch || DEFAULT_PITCH;
  const volume = cfg.volume || DEFAULT_VOLUME;
  const voices = [cfg.edgeVoice || EDGE_VOICE, ...EDGE_FALLBACKS.filter((v) => v !== cfg.edgeVoice)];

  const tmpDir = os.tmpdir();
  const chunks = splitSentences(text);
  const partFiles = [];

  try {
    for (let i = 0; i < chunks.length; i++) {
      const outFile = path.join(tmpDir, `elyra-tts-${Date.now()}-${i}.mp3`);
      let lastErr;
      let ok = false;
      for (const voice of voices) {
        try {
          await synthesizeOnce(bin, voice, rate, pitch, volume, chunks[i], outFile);
          partFiles.push(outFile);
          ok = true;
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          try {
            if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
          } catch {}
        }
      }
      if (!ok) throw lastErr || new Error('Fallo TTS');
    }

    // Un solo chunk → devolver directo
    if (partFiles.length === 1) {
      const buf = fs.readFileSync(partFiles[0]);
      try {
        fs.unlinkSync(partFiles[0]);
      } catch {}
      return 'data:audio/mpeg;base64,' + buf.toString('base64');
    }

    // Varios chunks → concatenar MP3 (frames seguidos; edge genera MPEG sin ID3 problemático)
    const buffers = partFiles.map((f) => fs.readFileSync(f));
    const merged = Buffer.concat(buffers);
    for (const f of partFiles) {
      try {
        fs.unlinkSync(f);
      } catch {}
    }
    return 'data:audio/mpeg;base64,' + merged.toString('base64');
  } catch (err) {
    for (const f of partFiles) {
      try {
        fs.unlinkSync(f);
      } catch {}
    }
    throw err;
  }
}

async function synthesizeToBase64(text, options = {}) {
  const cfg = { ...readTtsConfig(), ...options };
  const safeText = humanizePunctuation(cleanForSpeech(text));
  if (!safeText) throw new Error('Texto vacío tras limpiar');
  return synthesizeEdge(safeText, cfg);
}

function ttsStatus() {
  const cfg = readTtsConfig();
  const mode = checkEdgeTts();
  return {
    edgeTts: !!mode,
    elevenLabs: false,
    voice: cfg.edgeVoice || EDGE_VOICE,
    engine: mode ? 'edge-tts' : 'none',
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
