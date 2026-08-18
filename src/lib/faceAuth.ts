/**
 * Biometría facial local avanzada (estilo Face ID, sin hardware TrueDepth).
 * - Descriptor normalizado + gradientes (textura)
 * - Liveness por micro-movimiento entre fotogramas
 * - Anti-spoofing 3D (pantalla, foto, movimiento rígido)
 * - Control de calidad (nitidez, tamaño, centrado)
 * - Plantilla multi-muestra + matching híbrido L2/coseno
 */

import {
  analyzeSpoofFrame,
  resetAntiSpoofState,
  resetSpoofGray,
  hasEnoughSpoofHistory,
  type SpoofSignals,
} from '@/lib/faceAntiSpoof';

export type FaceTemplate = {
  userId: string;
  descriptor: number[];
  variants?: number[][];
  thumb?: string;
  registeredAt: string;
  samples: number;
  version: 3;
};

type FaceStore = Record<string, FaceTemplate>;

const STORAGE_KEY = 'elyra_face_templates_v3';
const LEGACY_KEYS = ['elyra_face_templates_v2', 'elyra_face_templates_v1'];
const GRID = 28;
const MATCH_THRESHOLD = 0.088;
const COSINE_MIN = 0.82;

function loadStore(): FaceStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as FaceStore;
    for (const key of LEGACY_KEYS) {
      const legacy = localStorage.getItem(key);
      if (legacy) {
        const parsed = JSON.parse(legacy) as FaceStore;
        const migrated: FaceStore = {};
        for (const [id, t] of Object.entries(parsed)) {
          migrated[id] = { ...t, version: 3, variants: t.variants ?? [] };
        }
        saveStore(migrated);
        return migrated;
      }
    }
    return {};
  } catch {
    return {};
  }
}

function saveStore(store: FaceStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function hasFaceRegistered(userId: string): boolean {
  return !!loadStore()[userId]?.descriptor?.length;
}

export function getFaceMeta(userId: string) {
  const t = loadStore()[userId];
  return {
    registered: !!t?.descriptor?.length,
    registeredAt: t?.registeredAt ?? null,
    samples: t?.samples ?? 0,
  };
}

export function removeFace(userId: string) {
  const store = loadStore();
  delete store[userId];
  saveStore(store);
}

export async function requestCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este equipo no permite acceso a la cámara.');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    });
  } catch (e: unknown) {
    const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: string }).name) : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      throw new Error('Permiso de cámara denegado. Actívelo en Windows → Privacidad → Cámara.');
    }
    if (name === 'NotFoundError') throw new Error('No se detectó ninguna cámara.');
    throw new Error('No se pudo abrir la cámara.');
  }
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

export type FaceBox = { x: number; y: number; width: number; height: number };

export type QualityReport = {
  ok: boolean;
  sharpness: number;
  faceRatio: number;
  centered: number;
  message?: string;
};

async function detectFaceBox(video: HTMLVideoElement): Promise<FaceBox> {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;

  try {
    const FD = window.FaceDetector;
    if (typeof FD === 'function') {
      const detector = new FD({ fastMode: false, maxDetectedFaces: 1 });
      const faces = await detector.detect(video);
      if (faces?.length) {
        const b = faces[0].boundingBox;
        const pad = Math.min(b.width, b.height) * 0.14;
        return {
          x: Math.max(0, b.x - pad),
          y: Math.max(0, b.y - pad),
          width: Math.min(w - Math.max(0, b.x - pad), b.width + pad * 2),
          height: Math.min(h - Math.max(0, b.y - pad), b.height + pad * 2),
        };
      }
      throw new Error('NO_FACE');
    }
  } catch (e) {
    if (e instanceof Error && e.message === 'NO_FACE') {
      throw new Error('No se detectó un rostro. Centre la cara en el círculo.');
    }
  }

  const side = Math.min(w, h) * 0.58;
  return {
    x: (w - side) / 2,
    y: ((h - side) / 2) * 0.72,
    width: side,
    height: side,
  };
}

function luminanceVariance(data: Uint8ClampedArray): number {
  let sum = 0;
  let sum2 = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += y;
    sum2 += y * y;
  }
  const mean = sum / n;
  return sum2 / n - mean * mean;
}

function sharpnessScore(data: Uint8ClampedArray, size: number): number {
  let acc = 0;
  let n = 0;
  for (let y = 1; y < size - 1; y += 2) {
    for (let x = 1; x < size - 1; x += 2) {
      const i = (y * size + x) * 4;
      const c = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const r = 0.299 * data[i + 4] + 0.587 * data[i + 5] + 0.114 * data[i + 6];
      const d = 0.299 * data[i + size * 4] + 0.587 * data[i + size * 4 + 1] + 0.114 * data[i + size * 4 + 2];
      acc += Math.abs(c - r) + Math.abs(c - d);
      n++;
    }
  }
  return n ? acc / n : 0;
}

export function assessFraming(box: FaceBox, videoW: number, videoH: number): QualityReport {
  const faceRatio = (box.width * box.height) / (videoW * videoH);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const centered =
    1 -
    Math.min(1, Math.hypot(cx / videoW - 0.5, cy / videoH - 0.48) / 0.35);

  if (faceRatio < 0.06) {
    return { ok: false, sharpness: 0, faceRatio, centered, message: 'Acérquese a la cámara' };
  }
  if (faceRatio > 0.55) {
    return { ok: false, sharpness: 0, faceRatio, centered, message: 'Aléjese un poco' };
  }
  if (centered < 0.35) {
    return { ok: false, sharpness: 0, faceRatio, centered, message: 'Centre el rostro' };
  }
  return { ok: true, sharpness: 0, faceRatio, centered };
}

let prevFrameGray: Float32Array | null = null;

export function resetLivenessState() {
  prevFrameGray = null;
  resetAntiSpoofState();
  resetSpoofGray();
}

function frameMotionEnergy(data: Uint8ClampedArray, size: number): number {
  const gray = new Float32Array(size * size);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  if (!prevFrameGray || prevFrameGray.length !== gray.length) {
    prevFrameGray = gray;
    return 0;
  }
  let sum = 0;
  const step = 3;
  let n = 0;
  for (let i = 0; i < gray.length; i += step) {
    sum += Math.abs(gray[i] - prevFrameGray[i]);
    n++;
  }
  prevFrameGray = gray;
  return n ? sum / n : 0;
}

export type ExtractResult = {
  descriptor: number[];
  quality: number;
  box: FaceBox;
  motion: number;
  framing: QualityReport;
  spoof: SpoofSignals;
};

export async function extractDescriptorFromVideo(
  video: HTMLVideoElement,
  opts?: {
    requireMotion?: boolean;
    minMotion?: number;
    /** Si true, exige pasar anti-spoof cuando hay historial suficiente */
    enforceSpoof?: boolean;
  },
): Promise<ExtractResult> {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  if (w < 64 || h < 64) throw new Error('Imagen de cámara inválida.');

  const size = 168;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas no disponible.');

  const box = await detectFaceBox(video);
  const framing = assessFraming(box, w, h);
  if (!framing.ok) {
    throw new Error(framing.message || 'Ajuste la posición del rostro.');
  }

  ctx.drawImage(video, box.x, box.y, box.width, box.height, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const variance = luminanceVariance(data);
  const sharp = sharpnessScore(data, size);
  const motion = frameMotionEnergy(data, size);
  const spoof = analyzeSpoofFrame(data, size, box, motion);

  if (variance < 160 || sharp < 4.5) {
    throw new Error('Rostro poco nítido. Mejore la iluminación.');
  }

  if (opts?.requireMotion && motion < (opts.minMotion ?? 1.2)) {
    throw new Error('Mueva ligeramente la cabeza (prueba de vida).');
  }

  if (opts?.enforceSpoof && hasEnoughSpoofHistory() && !spoof.ok) {
    throw new Error(spoof.reason || 'Detección anti-spoofing: gire la cabeza (3D).');
  }

  const cell = size / GRID;
  const cells: number[] = [];

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      let sum = 0;
      let n = 0;
      const x0 = Math.floor(gx * cell);
      const y0 = Math.floor(gy * cell);
      const x1 = Math.floor((gx + 1) * cell);
      const y1 = Math.floor((gy + 1) * cell);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * size + x) * 4;
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          n++;
        }
      }
      cells.push(n ? sum / n / 255 : 0);
    }
  }

  const mean = cells.reduce((a, b) => a + b, 0) / cells.length;
  const std =
    Math.sqrt(cells.reduce((a, b) => a + (b - mean) ** 2, 0) / cells.length) || 1;
  const norm = cells.map((v) => (v - mean) / std);

  const grads: number[] = [];
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID - 1; gx++) {
      grads.push(norm[gy * GRID + gx + 1] - norm[gy * GRID + gx]);
    }
  }
  for (let gy = 0; gy < GRID - 1; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      grads.push(norm[(gy + 1) * GRID + gx] - norm[gy * GRID + gx]);
    }
  }

  const hist: number[] = [0, 0, 0, 0];
  for (let gy = 0; gy < GRID - 1; gy++) {
    for (let gx = 0; gx < GRID - 1; gx++) {
      const g =
        Math.abs(norm[gy * GRID + gx + 1] - norm[gy * GRID + gx]) +
        Math.abs(norm[(gy + 1) * GRID + gx] - norm[gy * GRID + gx]);
      const q = (gy < GRID / 2 ? 0 : 2) + (gx < GRID / 2 ? 0 : 1);
      hist[q] += g;
    }
  }
  const hSum = hist.reduce((a, b) => a + b, 0) || 1;
  const histN = hist.map((v) => v / hSum);

  const quality = Math.min(
    1,
    (Math.min(variance, 2500) / 2500) * 0.4 +
      (Math.min(sharp, 40) / 40) * 0.3 +
      framing.centered * 0.15 +
      spoof.livenessScore * 0.15,
  );

  return {
    descriptor: [...norm, ...grads, ...histN],
    quality,
    box,
    motion,
    framing: { ...framing, sharpness: sharp },
    spoof,
  };
}

export function captureThumbFromVideo(video: HTMLVideoElement, box?: FaceBox): string {
  const canvas = document.createElement('canvas');
  canvas.width = 112;
  canvas.height = 112;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (box) {
    ctx.drawImage(video, box.x, box.y, box.width, box.height, 0, 0, 112, 112);
  } else {
    const side = Math.min(w, h) * 0.58;
    ctx.drawImage(video, (w - side) / 2, ((h - side) / 2) * 0.72, side, side, 0, 0, 112, 112);
  }
  return canvas.toDataURL('image/jpeg', 0.75);
}

function l2(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (!len) return 1;
  let sum = 0;
  for (let i = 0; i < len; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum / len);
}

function cosine(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (!len) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d ? dot / d : 0;
}

function averageDescriptors(list: number[][]): number[] {
  if (!list.length) return [];
  const len = list[0].length;
  const out = new Array(len).fill(0);
  for (const d of list) {
    for (let i = 0; i < len; i++) out[i] += d[i] || 0;
  }
  for (let i = 0; i < len; i++) out[i] /= list.length;
  return out;
}

export function samplesAreDiverse(list: number[][]): boolean {
  if (list.length < 2) return true;
  let maxD = 0;
  for (let i = 1; i < list.length; i++) {
    maxD = Math.max(maxD, l2(list[0], list[i]));
  }
  return maxD >= 0.018;
}

export function registerFace(
  userId: string,
  descriptors: number[][],
  thumb?: string,
): FaceTemplate {
  if (descriptors.length < 3) throw new Error('Se requieren al menos 3 muestras del rostro.');
  if (!samplesAreDiverse(descriptors)) {
    throw new Error('Mueva ligeramente la cabeza entre capturas (prueba de vida 3D).');
  }
  const primary = averageDescriptors(descriptors);
  const variants = [
    descriptors[0],
    descriptors[Math.floor(descriptors.length / 2)],
    descriptors[descriptors.length - 1],
  ].filter(Boolean);

  const template: FaceTemplate = {
    userId,
    descriptor: primary,
    variants,
    thumb,
    registeredAt: new Date().toISOString(),
    samples: descriptors.length,
    version: 3,
  };
  const store = loadStore();
  store[userId] = template;
  saveStore(store);
  resetLivenessState();
  return template;
}

export type FaceMatchResult = {
  ok: boolean;
  distance: number;
  cosine: number;
  confidence: number;
  threshold: number;
};

function bestAgainstTemplate(stored: FaceTemplate, live: number[]): { dist: number; cos: number } {
  const candidates = [stored.descriptor, ...(stored.variants ?? [])];
  let bestDist = 1;
  let bestCos = 0;
  for (const c of candidates) {
    if (!c?.length) continue;
    const d = l2(c, live);
    const co = cosine(c, live);
    if (d < bestDist) bestDist = d;
    if (co > bestCos) bestCos = co;
  }
  return { dist: bestDist, cos: bestCos };
}

export function verifyFace(userId: string, liveDescriptor: number[]): FaceMatchResult {
  const stored = loadStore()[userId];
  if (!stored?.descriptor?.length) {
    return { ok: false, distance: 1, cosine: 0, confidence: 0, threshold: MATCH_THRESHOLD };
  }
  const { dist, cos } = bestAgainstTemplate(stored, liveDescriptor);
  const l2Ok = dist <= MATCH_THRESHOLD;
  const cosOk = cos >= COSINE_MIN;
  const ok = l2Ok && cosOk;

  const confL2 = Math.max(0, Math.min(100, (1 - dist / (MATCH_THRESHOLD * 2.1)) * 100));
  const confCos = Math.max(0, Math.min(100, ((cos - 0.5) / 0.5) * 100));
  const confidence = Math.round(confL2 * 0.55 + confCos * 0.45);

  return {
    ok,
    distance: dist,
    cosine: cos,
    confidence,
    threshold: MATCH_THRESHOLD,
  };
}

export async function verifyFaceMulti(
  userId: string,
  video: HTMLVideoElement,
  shots = 3,
): Promise<FaceMatchResult & { avgQuality: number; spoofOk: boolean }> {
  const results: FaceMatchResult[] = [];
  let qualitySum = 0;
  let spoofOk = true;
  for (let i = 0; i < shots; i++) {
    await new Promise((r) => setTimeout(r, 180));
    const { descriptor, quality, spoof } = await extractDescriptorFromVideo(video, {
      enforceSpoof: true,
    });
    qualitySum += quality;
    if (!spoof.ok && hasEnoughSpoofHistory()) spoofOk = false;
    results.push(verifyFace(userId, descriptor));
  }
  const okCount = results.filter((r) => r.ok).length;
  const avgDist = results.reduce((a, r) => a + r.distance, 0) / results.length;
  const avgCos = results.reduce((a, r) => a + r.cosine, 0) / results.length;
  const confidence = Math.round(results.reduce((a, r) => a + r.confidence, 0) / results.length);
  return {
    ok: spoofOk && okCount >= Math.ceil(shots * 0.66),
    distance: avgDist,
    cosine: avgCos,
    confidence,
    threshold: MATCH_THRESHOLD,
    avgQuality: qualitySum / shots,
    spoofOk,
  };
}

export type { SpoofSignals };
export { hasEnoughSpoofHistory };
