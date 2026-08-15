/** Biometría facial local profesional — detección + plantilla multi-muestra. */

export type FaceTemplate = {
  userId: string;
  descriptor: number[];
  thumb?: string;
  registeredAt: string;
  samples: number;
};

type FaceStore = Record<string, FaceTemplate>;

const STORAGE_KEY = 'elyra_face_templates_v2';
const GRID = 24;
const MATCH_THRESHOLD = 0.095;

function loadStore(): FaceStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem('elyra_face_templates_v1');
      if (legacy) {
        localStorage.setItem(STORAGE_KEY, legacy);
        return JSON.parse(legacy) as FaceStore;
      }
      return {};
    }
    return JSON.parse(raw) as FaceStore;
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

async function detectFaceBox(video: HTMLVideoElement): Promise<FaceBox> {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const FD = (window as any).FaceDetector;
    if (typeof FD === 'function') {
      const detector = new FD({ fastMode: true, maxDetectedFaces: 1 });
      const faces = await detector.detect(video);
      if (faces?.length) {
        const b = faces[0].boundingBox;
        const pad = Math.min(b.width, b.height) * 0.12;
        return {
          x: Math.max(0, b.x - pad),
          y: Math.max(0, b.y - pad),
          width: Math.min(w, b.width + pad * 2),
          height: Math.min(h, b.height + pad * 2),
        };
      }
      throw new Error('NO_FACE');
    }
  } catch (e) {
    if (e instanceof Error && e.message === 'NO_FACE') {
      throw new Error('No se detectó un rostro. Centre la cara en el óvalo.');
    }
  }

  const side = Math.min(w, h) * 0.62;
  return {
    x: (w - side) / 2,
    y: ((h - side) / 2) * 0.75,
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

export async function extractDescriptorFromVideo(
  video: HTMLVideoElement,
): Promise<{ descriptor: number[]; quality: number; box: FaceBox }> {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  if (w < 64 || h < 64) throw new Error('Imagen de cámara inválida.');

  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas no disponible.');

  const box = await detectFaceBox(video);
  ctx.drawImage(video, box.x, box.y, box.width, box.height, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size);
  const variance = luminanceVariance(data);

  if (variance < 180) {
    throw new Error('Rostro no nítido. Mejore la luz y mire a la cámara.');
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

  return {
    descriptor: [...norm, ...grads],
    quality: Math.min(1, variance / 2000),
    box,
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
    const side = Math.min(w, h) * 0.62;
    ctx.drawImage(video, (w - side) / 2, ((h - side) / 2) * 0.75, side, side, 0, 0, 112, 112);
  }
  return canvas.toDataURL('image/jpeg', 0.75);
}

function distance(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (!len) return 1;
  let sum = 0;
  for (let i = 0; i < len; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum / len);
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
  for (let i = 1; i < list.length; i++) {
    if (distance(list[0], list[i]) < 0.02) return false;
  }
  return true;
}

export function registerFace(
  userId: string,
  descriptors: number[][],
  thumb?: string,
): FaceTemplate {
  if (descriptors.length < 3) throw new Error('Se requieren al menos 3 muestras del rostro.');
  if (!samplesAreDiverse(descriptors)) {
    throw new Error('Mueva ligeramente la cabeza entre capturas.');
  }
  const template: FaceTemplate = {
    userId,
    descriptor: averageDescriptors(descriptors),
    thumb,
    registeredAt: new Date().toISOString(),
    samples: descriptors.length,
  };
  const store = loadStore();
  store[userId] = template;
  saveStore(store);
  return template;
}

export type FaceMatchResult = {
  ok: boolean;
  distance: number;
  confidence: number;
  threshold: number;
};

export function verifyFace(userId: string, liveDescriptor: number[]): FaceMatchResult {
  const stored = loadStore()[userId];
  if (!stored?.descriptor?.length) {
    return { ok: false, distance: 1, confidence: 0, threshold: MATCH_THRESHOLD };
  }
  const dist = distance(stored.descriptor, liveDescriptor);
  const confidence = Math.max(
    0,
    Math.min(99, Math.round((1 - dist / (MATCH_THRESHOLD * 2.2)) * 100)),
  );
  return {
    ok: dist <= MATCH_THRESHOLD,
    distance: dist,
    confidence,
    threshold: MATCH_THRESHOLD,
  };
}

export async function verifyFaceMulti(
  userId: string,
  video: HTMLVideoElement,
  shots = 3,
): Promise<FaceMatchResult & { avgQuality: number }> {
  const results: FaceMatchResult[] = [];
  let qualitySum = 0;
  for (let i = 0; i < shots; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const { descriptor, quality } = await extractDescriptorFromVideo(video);
    qualitySum += quality;
    results.push(verifyFace(userId, descriptor));
  }
  const okCount = results.filter((r) => r.ok).length;
  const avgDist = results.reduce((a, r) => a + r.distance, 0) / results.length;
  const confidence = Math.round(results.reduce((a, r) => a + r.confidence, 0) / results.length);
  return {
    ok: okCount >= Math.ceil(shots * 0.66),
    distance: avgDist,
    confidence,
    threshold: MATCH_THRESHOLD,
    avgQuality: qualitySum / shots,
  };
}
