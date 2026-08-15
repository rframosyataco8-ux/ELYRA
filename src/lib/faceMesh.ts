/**
 * MediaPipe Face Landmarker (478 puntos) + métricas de liveness pasiva.
 * Fallback silencioso si el modelo no carga (sin red / WASM bloqueado).
 */

import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision';

export type Vec3 = { x: number; y: number; z: number };

export type FaceMeshFrame = {
  landmarks: Vec3[];
  /** Bounding box normalizado 0–1 respecto al vídeo */
  boxNorm: { x: number; y: number; w: number; h: number };
  /** Métricas de liveness pasiva derivadas de la geometría 3D */
  passive: PassiveLiveness;
};

export type PassiveLiveness = {
  /** Profundidad relativa nariz vs mejillas (mayor = más 3D) */
  noseDepth: number;
  /** Asimetría izquierda/derecha (pose) */
  yawProxy: number;
  /** Apertura ocular media (parpadeo pasivo) */
  eyeOpen: number;
  /** Estabilidad geométrica entre frames (0–1) */
  stability: number;
  /** Score combinado 0–1 (1 = vivo / 3D coherente) */
  score: number;
  ok: boolean;
  reason?: string;
};

// Índices MediaPipe Face Landmarker (aprox. estándar)
const IDX = {
  noseTip: 1,
  chin: 152,
  forehead: 10,
  leftCheek: 234,
  rightCheek: 454,
  leftEyeOuter: 33,
  leftEyeInner: 133,
  leftEyeTop: 159,
  leftEyeBottom: 145,
  rightEyeOuter: 263,
  rightEyeInner: 362,
  rightEyeTop: 386,
  rightEyeBottom: 374,
};

let landmarker: FaceLandmarker | null = null;
let initPromise: Promise<FaceLandmarker | null> | null = null;
let lastTs = 0;
let prevLandmarkSig: number[] | null = null;
let eyeOpenHistory: number[] = [];

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.tflite';

export async function initFaceMesh(): Promise<boolean> {
  const lm = await ensureLandmarker();
  return !!lm;
}

async function ensureLandmarker(): Promise<FaceLandmarker | null> {
  if (landmarker) return landmarker;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
      landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
      return landmarker;
    } catch {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
        landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        return landmarker;
      } catch (e) {
        console.warn('[elyra] MediaPipe FaceLandmarker no disponible', e);
        landmarker = null;
        return null;
      }
    }
  })();

  return initPromise;
}

export function resetFaceMeshLiveness() {
  prevLandmarkSig = null;
  eyeOpenHistory = [];
  lastTs = 0;
}

function dist2(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function eyeAspect(landmarks: Vec3[], outer: number, inner: number, top: number, bottom: number): number {
  const o = landmarks[outer];
  const i = landmarks[inner];
  const t = landmarks[top];
  const b = landmarks[bottom];
  if (!o || !i || !t || !b) return 0.3;
  const horiz = dist2(o, i) || 1e-6;
  const vert = dist2(t, b);
  return vert / horiz;
}

function computePassive(landmarks: Vec3[]): PassiveLiveness {
  const nose = landmarks[IDX.noseTip];
  const left = landmarks[IDX.leftCheek];
  const right = landmarks[IDX.rightCheek];
  const chin = landmarks[IDX.chin];
  const forehead = landmarks[IDX.forehead];

  if (!nose || !left || !right) {
    return {
      noseDepth: 0,
      yawProxy: 0,
      eyeOpen: 0,
      stability: 0,
      score: 0.3,
      ok: true, // no penalizar si faltan puntos
    };
  }

  // Z de MediaPipe: más negativo suele ser más cercano a la cámara (modelo facial)
  const cheekZ = ((left.z ?? 0) + (right.z ?? 0)) / 2;
  const noseDepth = Math.max(0, Math.min(1, Math.abs((nose.z ?? 0) - cheekZ) * 8));

  // Yaw proxy: diferencia horizontal de mejillas respecto a la nariz
  const midX = (left.x + right.x) / 2;
  const yawProxy = Math.max(-1, Math.min(1, (nose.x - midX) * 6));

  const leftEAR = eyeAspect(
    landmarks,
    IDX.leftEyeOuter,
    IDX.leftEyeInner,
    IDX.leftEyeTop,
    IDX.leftEyeBottom,
  );
  const rightEAR = eyeAspect(
    landmarks,
    IDX.rightEyeOuter,
    IDX.rightEyeInner,
    IDX.rightEyeTop,
    IDX.rightEyeBottom,
  );
  const eyeOpen = (leftEAR + rightEAR) / 2;
  eyeOpenHistory.push(eyeOpen);
  if (eyeOpenHistory.length > 20) eyeOpenHistory.shift();

  // Variación de apertura ocular en el tiempo → actividad pasiva (no foto estática perfecta)
  let eyeVar = 0;
  if (eyeOpenHistory.length >= 6) {
    const mean = eyeOpenHistory.reduce((a, b) => a + b, 0) / eyeOpenHistory.length;
    eyeVar =
      eyeOpenHistory.reduce((a, b) => a + (b - mean) ** 2, 0) / eyeOpenHistory.length;
  }

  // Estabilidad de silueta (frente–mentón vs anchura)
  let stability = 0.5;
  if (chin && forehead) {
    const faceH = Math.abs(chin.y - forehead.y) || 1e-6;
    const faceW = Math.abs(right.x - left.x) || 1e-6;
    const ratio = faceH / faceW;
    const sig = [nose.x, nose.y, nose.z ?? 0, ratio, yawProxy];
    if (prevLandmarkSig && prevLandmarkSig.length === sig.length) {
      let d = 0;
      for (let i = 0; i < sig.length; i++) d += Math.abs(sig[i] - prevLandmarkSig[i]);
      // movimiento micro natural: ni cero ni enorme
      stability = d < 0.002 ? 0.25 : d > 0.35 ? 0.4 : Math.min(1, 0.45 + d * 3);
    }
    prevLandmarkSig = sig;
  }

  // Foto impresa: profundidad z casi plana + ojos fijos
  const flatRisk = noseDepth < 0.08 ? 0.55 : noseDepth < 0.15 ? 0.25 : 0;
  const staticEyeRisk = eyeOpenHistory.length >= 10 && eyeVar < 0.00005 ? 0.35 : 0;

  const score = Math.max(
    0,
    Math.min(
      1,
      noseDepth * 0.4 +
        stability * 0.3 +
        Math.min(1, eyeVar * 400) * 0.15 +
        (eyeOpen > 0.12 && eyeOpen < 0.55 ? 0.15 : 0.05) -
        flatRisk * 0.35 -
        staticEyeRisk * 0.25,
    ),
  );

  let ok = score >= 0.38;
  let reason: string | undefined;
  if (noseDepth < 0.07 && eyeOpenHistory.length >= 8) {
    ok = false;
    reason = 'Geometría plana — use su rostro real (3D)';
  } else if (staticEyeRisk > 0 && noseDepth < 0.12) {
    ok = false;
    reason = 'Poca variación facial — parpadee o mueva la cabeza';
  } else if (!ok) {
    reason = 'Liveness pasiva insuficiente — mire a la cámara con naturalidad';
  }

  return { noseDepth, yawProxy, eyeOpen, stability, score, ok, reason };
}

function landmarksBox(landmarks: Vec3[]): { x: number; y: number; w: number; h: number } {
  let minX = 1,
    minY = 1,
    maxX = 0,
    maxY = 0;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: Math.max(0.01, maxX - minX), h: Math.max(0.01, maxY - minY) };
}

/**
 * Detecta malla facial en un frame de vídeo.
 * Devuelve null si no hay cara o MediaPipe no está listo.
 */
export async function detectFaceMesh(video: HTMLVideoElement): Promise<FaceMeshFrame | null> {
  const lm = await ensureLandmarker();
  if (!lm || video.readyState < 2) return null;

  const now = performance.now();
  // MediaPipe VIDEO mode exige timestamps monótonos
  if (now <= lastTs) lastTs += 1;
  else lastTs = now;

  let result: FaceLandmarkerResult;
  try {
    result = lm.detectForVideo(video, lastTs);
  } catch {
    return null;
  }

  const face = result.faceLandmarks?.[0];
  if (!face?.length) return null;

  const landmarks: Vec3[] = face.map((p) => ({
    x: p.x,
    y: p.y,
    z: p.z ?? 0,
  }));

  return {
    landmarks,
    boxNorm: landmarksBox(landmarks),
    passive: computePassive(landmarks),
  };
}

/** Conexiones simplificadas para dibujar la malla (subset legible). */
export const MESH_EDGES: [number, number][] = [
  [10, 338], [338, 297], [297, 332], [332, 284], [284, 251], [251, 389], [389, 356], [356, 454],
  [454, 323], [323, 361], [361, 288], [288, 397], [397, 365], [365, 379], [379, 378], [378, 400],
  [400, 377], [377, 152], [152, 148], [148, 176], [176, 149], [149, 150], [150, 136], [136, 172],
  [172, 58], [58, 132], [132, 93], [93, 234], [234, 127], [127, 162], [162, 21], [21, 54],
  [54, 103], [103, 67], [67, 109], [109, 10],
  [33, 7], [7, 163], [163, 144], [144, 145], [145, 153], [153, 154], [154, 155], [155, 133],
  [263, 249], [249, 390], [390, 373], [373, 374], [374, 380], [380, 381], [381, 382], [382, 362],
  [61, 146], [146, 91], [91, 181], [181, 84], [84, 17], [17, 314], [314, 405], [405, 321],
  [321, 375], [375, 291], [61, 185], [185, 40], [40, 39], [39, 37], [37, 0], [0, 267],
  [267, 269], [269, 270], [270, 409], [409, 291],
  [1, 4], [4, 5], [5, 195], [195, 197], [197, 6], [6, 168],
];
