/** Biometría facial local — plantilla por muestreo (sin servidor). */

export type FaceTemplate = {
  userId: string;
  /** Vector normalizado 0–1 */
  descriptor: number[];
  /** Miniatura JPEG base64 (solo referencia visual) */
  thumb?: string;
  registeredAt: string;
  samples: number;
};

type FaceStore = Record<string, FaceTemplate>;

const STORAGE_KEY = 'elyra_face_templates_v1';
const GRID = 16;
const MATCH_THRESHOLD = 0.12; // distancia euclídea media; más bajo = más estricto

function loadStore(): FaceStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
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

export function getFaceMeta(userId: string): { registered: boolean; registeredAt: string | null } {
  const t = loadStore()[userId];
  return { registered: !!t?.descriptor?.length, registeredAt: t?.registeredAt ?? null };
}

export function removeFace(userId: string) {
  const store = loadStore();
  delete store[userId];
  saveStore(store);
}

/** Solicita cámara (permiso del sistema / navegador). */
export async function requestCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este equipo no permite acceso a la cámara.');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });
  } catch (e: unknown) {
    const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: string }).name) : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      throw new Error('Permiso de cámara denegado. Actívelo en Windows → Privacidad → Cámara → ELYRA.');
    }
    if (name === 'NotFoundError') {
      throw new Error('No se detectó ninguna cámara.');
    }
    throw new Error('No se pudo abrir la cámara.');
  }
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Extrae descriptor desde un video frame (región central tipo rostro). */
export function extractDescriptorFromVideo(video: HTMLVideoElement): number[] {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  if (w < 32 || h < 32) throw new Error('Imagen de cámara inválida.');

  const canvas = document.createElement('canvas');
  const size = 128;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas no disponible.');

  // Recorte centrado (zona típica del rostro)
  const side = Math.min(w, h) * 0.72;
  const sx = (w - side) / 2;
  const sy = (h - side) / 2 * 0.85;
  ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size);
  const cell = size / GRID;
  const descriptor: number[] = [];

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
          // luminancia
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          n++;
        }
      }
      descriptor.push(n ? sum / n / 255 : 0);
    }
  }

  // Gradientes horizontales (más robusto a iluminación uniforme)
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID - 1; gx++) {
      const a = descriptor[gy * GRID + gx];
      const b = descriptor[gy * GRID + gx + 1];
      descriptor.push((b - a + 1) / 2);
    }
  }

  return descriptor;
}

export function captureThumbFromVideo(video: HTMLVideoElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const w = video.videoWidth;
  const h = video.videoHeight;
  const side = Math.min(w, h) * 0.72;
  const sx = (w - side) / 2;
  const sy = (h - side) / 2 * 0.85;
  ctx.drawImage(video, sx, sy, side, side, 0, 0, 96, 96);
  return canvas.toDataURL('image/jpeg', 0.7);
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

/** Registra rostro con 1–N muestras (mejor con 2–3). */
export function registerFace(
  userId: string,
  descriptors: number[][],
  thumb?: string,
): FaceTemplate {
  if (!descriptors.length) throw new Error('No hay muestras de rostro.');
  const descriptor = averageDescriptors(descriptors);
  const template: FaceTemplate = {
    userId,
    descriptor,
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
  threshold: number;
};

export function verifyFace(userId: string, liveDescriptor: number[]): FaceMatchResult {
  const stored = loadStore()[userId];
  if (!stored?.descriptor?.length) {
    return { ok: false, distance: 1, threshold: MATCH_THRESHOLD };
  }
  const dist = distance(stored.descriptor, liveDescriptor);
  return {
    ok: dist <= MATCH_THRESHOLD,
    distance: dist,
    threshold: MATCH_THRESHOLD,
  };
}
