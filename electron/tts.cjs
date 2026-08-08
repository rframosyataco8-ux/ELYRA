/**
 * ELYRA TTS v2 — voz humana de máxima calidad
 * 1) ElevenLabs (si hay API key) — realistic
 * 2) edge-tts Dalia neural — gratis / offline-friendly
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { promisify } = require('util');
const { exec, execSync } = require('child_process');
const execAsync = promisify(exec);

const EDGE_VOICE = 'es-MX-DaliaNeural';
const EDGE_FALLBACKS = [
  'es-MX-RenataNeural',
  'es-ES-XimenaNeural',
  'es-MX-CarlotaNeural',
  'es-ES-ElviraNeural',
];

const DEFAULT_RATE = '-5%';
const DEFAULT_PITCH = '+1Hz';

/* ElevenLabs — Grace (mexicana) por defecto */
const ELEVEN_DEFAULT_VOICE = 'oWAxZDx7w5VEj9dCyTzz';
const ELEVEN_DEFAULT_MODEL = 'eleven_multilingual_v2';
const ELEVEN_STABILITY = 0.48;
const ELEVEN_SIMILARITY = 0.82;
const ELEVEN_STYLE = 0.28;

let edgeTtsAvailable = null;

function getConfigPath() {
  return path.join(os.homedir(), '.elyra', 'config.json');
}

function readTtsConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(getConfigPath(), 'utf-8'));
    return {
      elevenApiKey: (raw.elevenApiKey || process.env.ELEVENLABS_API_KEY || '').trim(),
      elevenVoiceId: raw.elevenVoiceId || ELEVEN_DEFAULT_VOICE,
      elevenModel: raw.elevenModel || ELEVEN_DEFAULT_MODEL,
      stability: typeof raw.ttsStability === 'number' ? raw.ttsStability : ELEVEN_STABILITY,
      similarityBoost:
        typeof raw.ttsSimilarity === 'number' ? raw.ttsSimilarity : ELEVEN_SIMILARITY,
      style: typeof raw.ttsStyle === 'number' ? raw.ttsStyle : ELEVEN_STYLE,
      edgeVoice: raw.edgeVoice || EDGE_VOICE,
      rate: raw.ttsRate || DEFAULT_RATE,
      pitch: raw.ttsPitch || DEFAULT_PITCH,
    };
  } catch {
    return {
      elevenApiKey: (process.env.ELEVENLABS_API_KEY || '').trim(),
      elevenVoiceId: ELEVEN_DEFAULT_VOICE,
      elevenModel: ELEVEN_DEFAULT_MODEL,
      stability: ELEVEN_STABILITY,
      similarityBoost: ELEVEN_SIMILARITY,
      style: ELEVEN_STYLE,
      edgeVoice: EDGE_VOICE,
      rate: DEFAULT_RATE,
      pitch: DEFAULT_PITCH,
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

  if (t.length > 1200) {
    t = t.slice(0, 1200);
    const last = t.lastIndexOf('.');
    if (last > 400) t = t.slice(0, last + 1);
    else t += '.';
  }

  return t;
}

function humanizePunctuation(text) {
  let t = text;
  t = t.replace(/([.,;:!?])([A-Za-zÁÉÍÓÚáéíóúñÑ])/g, '$1 $2');
  t = t.replace(/\.{2,}/g, '.');
  t = t.replace(/\s+y\s+/gi, ', y ');
  t = t.replace(/,\s*,/g, ',');
  t = t.replace(
    /([^.!?]{90,}?)\s+(y|pero|aunque|además|también|entonces|así que)\s+/gi,
    '$1. $2 ',
  );
  t = t.replace(/\b([A-ZÁÉÍÓÚÑ]{4,})\b/g, (m) => m.charAt(0) + m.slice(1).toLowerCase());
  t = t.replace(/\b100%\b/g, 'cien por ciento');
  t = t.replace(/\bOK\b/gi, 'de acuerdo');
  return t.replace(/\s+/g, ' ').trim();
}

async function synthesizeElevenLabs(text, cfg) {
  const voiceId = cfg.elevenVoiceId || ELEVEN_DEFAULT_VOICE;
  const url = 'https://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '?output_format=mp3_44100_128';
  const body = {
    text,
    model_id: cfg.elevenModel || ELEVEN_DEFAULT_MODEL,
    voice_settings: {
      stability: cfg.stability,
      similarity_boost: cfg.similarityBoost,
      style: cfg.style,
      use_speaker_boost: true,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': cfg.elevenApiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error('ElevenLabs ' + res.status + ': ' + errText.slice(0, 160));
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return 'data:audio/mpeg;base64,' + buf.toString('base64');
}

async function synthesizeOnce(bin, voice, rate, pitch, safeText, outFile) {
  const cmd =
    `${bin} --voice "${voice}" --rate="${rate}" --pitch="${pitch}" ` +
    `--text ${JSON.stringify(safeText)} --write-media "${outFile}"`;
  await execAsync(cmd, { timeout: 90000, maxBuffer: 20 * 1024 * 1024 });
  if (!fs.existsSync(outFile)) throw new Error('No se generó el audio');
}

async function synthesizeEdge(text, cfg) {
  const mode = checkEdgeTts();
  if (!mode) throw new Error('edge-tts no instalado. Ejecuta: pip install edge-tts');

  const tmpDir = os.tmpdir();
  const outFile = path.join(tmpDir, 'elyra-tts-' + Date.now() + '.mp3');
  const rate = cfg.rate || DEFAULT_RATE;
  const pitch = cfg.pitch || DEFAULT_PITCH;

  let bin = 'edge-tts';
  if (mode === 'python') bin = 'python -m edge_tts';
  if (mode === 'py') bin = 'py -m edge_tts';

  const voices = [cfg.edgeVoice || EDGE_VOICE, ...EDGE_FALLBACKS];
  let lastErr;
  for (const voice of voices) {
    try {
      await synthesizeOnce(bin, voice, rate, pitch, text, outFile);
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
  try {
    fs.unlinkSync(outFile);
  } catch {}
  return 'data:audio/mpeg;base64,' + buf.toString('base64');
}

async function synthesizeToBase64(text, options = {}) {
  const cfg = { ...readTtsConfig(), ...options };
  let safeText = humanizePunctuation(cleanForSpeech(text));
  if (!safeText) throw new Error('Texto vacío tras limpiar');

  // 1) ElevenLabs si hay clave
  if (cfg.elevenApiKey) {
    try {
      return await synthesizeElevenLabs(safeText, cfg);
    } catch (e) {
      console.warn('[ELYRA TTS] ElevenLabs falló, usando edge-tts:', e.message);
    }
  }

  // 2) edge-tts
  return synthesizeEdge(safeText, cfg);
}

function ttsStatus() {
  const cfg = readTtsConfig();
  return {
    edgeTts: !!checkEdgeTts(),
    elevenLabs: !!cfg.elevenApiKey,
    voice: cfg.elevenApiKey ? cfg.elevenVoiceId : cfg.edgeVoice || EDGE_VOICE,
    engine: cfg.elevenApiKey ? 'elevenlabs' : checkEdgeTts() ? 'edge-tts' : 'none',
    stability: cfg.stability,
    similarityBoost: cfg.similarityBoost,
    style: cfg.style,
  };
}

module.exports = {
  synthesizeToBase64,
  checkEdgeTts,
  cleanForSpeech,
  ttsStatus,
  VOICE: EDGE_VOICE,
  DEFAULT_RATE,
  DEFAULT_PITCH,
  ELEVEN_DEFAULT_VOICE,
  ELEVEN_STABILITY,
  ELEVEN_SIMILARITY,
  ELEVEN_STYLE,
};
