/**
 * ELYRA TTS — edge-tts + prosodia + caché de frases cortas (0.6)
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { promisify } = require('util');
const { exec, execSync, spawn } = require('child_process');
const execAsync = promisify(exec);
const ttsCache = require('./tts-cache.cjs');

const EDGE_VOICE = 'es-MX-DaliaNeural';
const EDGE_FALLBACKS = [
  'es-MX-RenataNeural',
  'es-MX-CarlotaNeural',
  'es-MX-NuriaNeural',
  'es-ES-XimenaNeural',
  'es-ES-ElviraNeural',
];

const DEFAULT_RATE = '-10%';
const DEFAULT_PITCH = '+1Hz';
const DEFAULT_VOLUME = '+0%';

const RATE_BY_TYPE = {
  confirm: '-6%',
  short: '-8%',
  explain: '-12%',
  warning: '-11%',
  default: '-10%',
};

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

const UNITS = {
  kg: 'kilogramos', g: 'gramos', mg: 'miligramos', t: 'toneladas',
  l: 'litros', ml: 'mililitros', m: 'metros', cm: 'centímetros',
  mm: 'milímetros', km: 'kilómetros', '%': 'por ciento',
  '°c': 'grados', gb: 'gigas', mb: 'megas', kb: 'kilos',
};

const ONES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
const TENS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function numberToSpanish(n) {
  n = Math.floor(Number(n));
  if (isNaN(n)) return String(n);
  if (n === 0) return 'cero';
  if (n === 100) return 'cien';
  if (n < 0) return 'menos ' + numberToSpanish(-n);
  if (n < 20) return ONES[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    if (o === 0) return TENS[t];
    if (t === 2) return 'veinti' + ONES[o];
    return TENS[t] + ' y ' + ONES[o];
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    if (r === 0) return HUNDREDS[h];
    return HUNDREDS[h] + ' ' + numberToSpanish(r);
  }
  if (n < 1000000) {
    const m = Math.floor(n / 1000);
    const r = n % 1000;
    const mil = m === 1 ? 'mil' : numberToSpanish(m) + ' mil';
    return r === 0 ? mil : mil + ' ' + numberToSpanish(r);
  }
  return String(n);
}

function normalizeNumbers(text) {
  text = text.replace(/(\d+)[.,](\d+)\s*%/g, (_, a, b) =>
    numberToSpanish(a) + ' punto ' + numberToSpanish(b) + ' por ciento');
  text = text.replace(/(\d+)\s*%/g, (_, n) => numberToSpanish(n) + ' por ciento');
  text = text.replace(/(\d+)[.,](\d+)\s*(kg|g|mg|t|l|ml|m|cm|mm|km|gb|mb|kb)\b/gi, (_, a, b, u) => {
    const unit = UNITS[u.toLowerCase()] || u;
    return numberToSpanish(a) + ' punto ' + numberToSpanish(b) + ' ' + unit;
  });
  text = text.replace(/(\d+)\s*(kg|g|mg|t|l|ml|m|cm|mm|km|gb|mb|kb)\b/gi, (_, n, u) => {
    const unit = UNITS[u.toLowerCase()] || u;
    return numberToSpanish(n) + ' ' + unit;
  });
  text = text.replace(/(\d+)\s*°\s*C\b/gi, (_, n) => numberToSpanish(n) + ' grados');
  text = text.replace(/\b(\d{1,3})\b/g, (match, n, offset, full) => {
    const before = full.slice(Math.max(0, offset - 2), offset);
    const after = full.slice(offset + match.length, offset + match.length + 2);
    if (/\d/.test(before) || /\d/.test(after)) return match;
    if (n.length === 4 && (n.startsWith('19') || n.startsWith('20'))) return match;
    const num = parseInt(n, 10);
    if (num >= 0 && num <= 999) return numberToSpanish(num);
    return match;
  });
  return text;
}

function normalizeAbbreviations(text) {
  const map = [
    [/\bOK\b/gi, 'de acuerdo'],
    [/\bPDF\b/g, 'pe de efe'],
    [/\bURL\b/g, 'enlace'],
    [/\bAPI\b/g, 'a pe i'],
    [/\bCPU\b/g, 'procesador'],
    [/\bRAM\b/g, 'memoria'],
    [/\bGB\b/g, 'gigas'],
    [/\bMB\b/g, 'megas'],
    [/\bUSB\b/g, 'u ese be'],
    [/\bHTML\b/g, 'hache te eme ele'],
    [/\bCSV\b/g, 'ce ese uve'],
    [/\bJSON\b/g, 'yeison'],
    [/\bAI\b/g, 'inteligencia artificial'],
    [/\bIA\b/g, 'inteligencia artificial'],
  ];
  for (const [re, rep] of map) text = text.replace(re, rep);
  return text;
}

function cleanForSpeech(text) {
  if (!text) return '';
  let t = String(text);
  if (/rate limit|429|tokens per day|TPD/i.test(t)) {
    return 'He alcanzado un límite temporal. Espera un momento e inténtalo de nuevo.';
  }
  if (/LLM\s*\d{3}|Error del modelo/i.test(t) && t.length > 120) {
    return 'Hubo un problema al conectar con la inteligencia. Inténtalo de nuevo en unos segundos.';
  }
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/`([^`]+)`/g, '$1');
  t = t.replace(/\*\*?([^*]+)\*\*?/g, '$1');
  t = t.replace(/__?([^_]+)__?/g, '$1');
  t = t.replace(/^#+\s+/gm, '');
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  t = t.replace(/^[-•*]\s+/gm, '');
  t = t.replace(/\|\s*/g, ', ');
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
  t = normalizeAbbreviations(t);
  t = normalizeNumbers(t);
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

function detectResponseType(text) {
  const t = text.toLowerCase().trim();
  if (t.length < 45 && /^(listo|hecho|perfecto|de acuerdo|vale|sí|correcto|ok|ya está|abierto|cerrado)/i.test(t)) {
    return 'confirm';
  }
  if (t.length < 70) return 'short';
  if (/cuidado|atención|error|falló|no pude|problema|advertencia|importante/i.test(t)) {
    return 'warning';
  }
  if (t.length > 160 || /porque|explico|detalles|paso a paso|primero|después/i.test(t)) {
    return 'explain';
  }
  return 'default';
}

function applyEmphasis(text) {
  let t = text;
  t = t.replace(
    /\b(cero|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta|cuarenta|cincuenta|cien|mil|kilogramos|gramos|por ciento|grados)\b/gi,
    (m) => ' ' + m + ' ',
  );
  return t.replace(/\s+/g, ' ').trim();
}

function applyProsody(text) {
  let t = text;
  t = t.replace(/([.,;:!?])([A-Za-zÁÉÍÓÚáéíóúñÑ0-9])/g, '$1 $2');
  t = t.replace(/\.{2,}/g, '...');
  t = t.replace(/!{2,}/g, '!');
  t = t.replace(/\?{2,}/g, '?');
  t = t.replace(/\s+y\s+/gi, ', y ');
  t = t.replace(/,\s*,/g, ',');
  t = t.replace(
    /([^.!?]{55,}?)\s+(y|pero|aunque|además|también|entonces|así que|porque|cuando|donde|mientras)\s+/gi,
    '$1. $2 ',
  );
  t = t.replace(/:\s*/g, '. ');
  t = t.replace(/;/g, '.');
  t = t.replace(/\b([A-ZÁÉÍÓÚÑ]{5,})\b/g, (m) => m.charAt(0) + m.slice(1).toLowerCase());
  t = t.replace(/^(Listo|Hecho|Perfecto|Vale|De acuerdo)\.\s*/i, '$1. ');
  t = t.replace(/\.\s+([A-ZÁÉÍÓÚÑ])/g, '. $1');
  t = t.replace(/\s+/g, ' ').trim();
  if (t && !/[.!?…]$/.test(t)) t += '.';
  return t;
}

function prepareForSpeech(rawText) {
  let t = cleanForSpeech(rawText);
  if (!t) return { text: '', type: 'default', rate: DEFAULT_RATE };
  t = applyEmphasis(t);
  t = applyProsody(t);
  const type = detectResponseType(t);
  const rate = RATE_BY_TYPE[type] || DEFAULT_RATE;
  return { text: t, type, rate };
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
      '--text', text,
      '--out', outFile,
      '--voice', cfg.edgeVoice || EDGE_VOICE,
      '--rate', cfg.rate || DEFAULT_RATE,
      '--pitch', cfg.pitch || DEFAULT_PITCH,
      '--volume', cfg.volume || DEFAULT_VOLUME,
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
  const outFile = path.join(os.tmpdir(), 'elyra-tts-' + Date.now() + '.mp3');
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
  const prepared = prepareForSpeech(text);
  if (!prepared.text) throw new Error('Texto vacío tras limpiar');

  const cfg = {
    ...readTtsConfig(),
    ...options,
    rate: options.rate || prepared.rate,
  };
  const voice = cfg.edgeVoice || EDGE_VOICE;

  // 0.6: caché de frases cortas / confirmaciones
  if (prepared.text.length <= 160) {
    const hit = ttsCache.get(prepared.text, voice, cfg.rate);
    if (hit) return hit;
  }

  const outFile = path.join(os.tmpdir(), 'elyra-tts-py-' + Date.now() + '.mp3');
  let dataUrl;
  try {
    await runPythonTts(prepared.text, outFile, cfg);
    const buf = fs.readFileSync(outFile);
    try {
      fs.unlinkSync(outFile);
    } catch {}
    dataUrl = 'data:audio/mpeg;base64,' + buf.toString('base64');
  } catch (e) {
    try {
      if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
    } catch {}
    dataUrl = await synthesizeEdgeCli(prepared.text, cfg);
  }

  if (prepared.text.length <= 160) {
    ttsCache.set(prepared.text, voice, cfg.rate, dataUrl);
  }
  return dataUrl;
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
    profile: 'elyra-0.6',
    cache: ttsCache.stats(),
  };
}

module.exports = {
  synthesizeToBase64,
  checkEdgeTts,
  cleanForSpeech,
  humanizePunctuation: applyProsody,
  prepareForSpeech,
  normalizeNumbers,
  ttsStatus,
  VOICE: EDGE_VOICE,
  DEFAULT_RATE,
  DEFAULT_PITCH,
  DEFAULT_VOLUME,
};
