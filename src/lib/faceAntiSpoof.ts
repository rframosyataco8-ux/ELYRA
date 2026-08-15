/**
 * Detección de spoofing 3D / presentación (foto, pantalla, máscara 2D).
 * Sin sensor de profundidad: usa proxies 2D multi-frame.
 *
 * Señales:
 * 1. Textura de pantalla (alta frecuencia / moiré / subpíxel)
 * 2. Especularidad anómala (brillo plano de LCD)
 * 3. Correlación RGB antinatural
 * 4. Movimiento rígido vs no rígido (parallax facial)
 * 5. Flujo diferencial entre regiones (mejillas / frente / mentón)
 */

export type SpoofSignals = {
  /** 0 = muy sospechoso (spoof), 1 = muy probable real */
  livenessScore: number;
  screenTextureRisk: number;
  specularRisk: number;
  colorRisk: number;
  rigidMotionRisk: number;
  depthProxy: number;
  ok: boolean;
  reason?: string;
};

type Box = { x: number; y: number; width: number; height: number };

type FrameSnapshot = {
  box: Box;
  motion: number;
  regionMotion: [number, number, number, number]; // TL TR BL BR
  t: number;
};

const history: FrameSnapshot[] = [];
const MAX_HIST = 12;

export function resetAntiSpoofState() {
  history.length = 0;
}

function grayAt(data: Uint8ClampedArray, size: number, x: number, y: number): number {
  const i = (y * size + x) * 4;
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

/** Energía de alta frecuencia — pantallas/impresiones suelen dispararla o aplanarla de forma anómala. */
function highFrequencyEnergy(data: Uint8ClampedArray, size: number): number {
  let acc = 0;
  let n = 0;
  for (let y = 2; y < size - 2; y += 2) {
    for (let x = 2; x < size - 2; x += 2) {
      const c = grayAt(data, size, x, y);
      const lap =
        Math.abs(4 * c - grayAt(data, size, x - 1, y) - grayAt(data, size, x + 1, y) -
          grayAt(data, size, x, y - 1) - grayAt(data, size, x, y + 1));
      acc += lap;
      n++;
    }
  }
  return n ? acc / n : 0;
}

/** Patrón periódico tipo subpíxel RGB (muy típico de fotografiar una pantalla). */
function subpixelStripeScore(data: Uint8ClampedArray, size: number): number {
  let stripe = 0;
  let n = 0;
  for (let y = 4; y < size - 4; y += 3) {
    for (let x = 4; x < size - 4; x += 3) {
      const i = (y * size + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Diferencia cromática local extrema en ciclos cortos
      const i2 = (y * size + x + 1) * 4;
      const dr = Math.abs(r - data[i2]);
      const dg = Math.abs(g - data[i2 + 1]);
      const db = Math.abs(b - data[i2 + 2]);
      stripe += (dr + dg + db) / 3;
      n++;
    }
  }
  return n ? stripe / n : 0;
}

/** Brillo especular plano (pantallas) vs piel con variación natural. */
function specularFlatness(data: Uint8ClampedArray, size: number): number {
  const highs: number[] = [];
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const i = (y * size + x) * 4;
      const yv = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (yv > 200) highs.push(yv);
    }
  }
  if (highs.length < 12) return 0; // poca especularidad
  const mean = highs.reduce((a, b) => a + b, 0) / highs.length;
  let v = 0;
  for (const h of highs) v += (h - mean) ** 2;
  const std = Math.sqrt(v / highs.length);
  // Pantalla: muchos blancos muy similares → std baja + muchos píxeles altos
  const coverage = highs.length / ((size * size) / 4);
  if (coverage > 0.12 && std < 8) return Math.min(1, coverage * 2.2);
  return Math.min(1, coverage * 0.4);
}

/** Correlación antinatural entre canales (impresión / LCD). */
function colorChannelRisk(data: Uint8ClampedArray): number {
  let sr = 0,
    sg = 0,
    sb = 0;
  let srr = 0,
    sgg = 0,
    sbb = 0;
  let srg = 0,
    srb = 0,
    sgb = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    sr += r;
    sg += g;
    sb += b;
    srr += r * r;
    sgg += g * g;
    sbb += b * b;
    srg += r * g;
    srb += r * b;
    sgb += g * b;
    n++;
  }
  if (n < 10) return 0;
  const mr = sr / n;
  const mg = sg / n;
  const mb = sb / n;
  const cov = (s: number, a: number, b: number, ma: number, mb_: number) =>
    s / n - ma * mb_;
  const crg = cov(srg, sr, sg, mr, mg);
  const crb = cov(srb, sr, sb, mr, mb);
  const cgb = cov(sgb, sg, sb, mg, mb);
  const vr = Math.max(1e-6, srr / n - mr * mr);
  const vg = Math.max(1e-6, sgg / n - mg * mg);
  const vb = Math.max(1e-6, sbb / n - mb * mb);
  const corrRG = crg / Math.sqrt(vr * vg);
  const corrRB = crb / Math.sqrt(vr * vb);
  const corrGB = cgb / Math.sqrt(vg * vb);
  // En spoofs de pantalla a veces las correlaciones se disparan > 0.98 de forma uniforme
  const avg = (Math.abs(corrRG) + Math.abs(corrRB) + Math.abs(corrGB)) / 3;
  if (avg > 0.985) return Math.min(1, (avg - 0.97) * 12);
  return 0;
}

/** Movimiento por cuadrantes del recorte facial. */
function regionMotionEnergies(
  data: Uint8ClampedArray,
  size: number,
  prev: Float32Array | null,
): { energies: [number, number, number, number]; gray: Float32Array } {
  const gray = new Float32Array(size * size);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const energies: [number, number, number, number] = [0, 0, 0, 0];
  const counts: [number, number, number, number] = [0, 0, 0, 0];
  if (!prev || prev.length !== gray.length) {
    return { energies, gray };
  }
  const mid = Math.floor(size / 2);
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const p = y * size + x;
      const d = Math.abs(gray[p] - prev[p]);
      const q = (y < mid ? 0 : 2) + (x < mid ? 0 : 1);
      energies[q] += d;
      counts[q]++;
    }
  }
  for (let i = 0; i < 4; i++) {
    energies[i] = counts[i] ? energies[i] / counts[i] : 0;
  }
  return { energies, gray };
}

let prevGraySpoof: Float32Array | null = null;

export function resetSpoofGray() {
  prevGraySpoof = null;
}

/**
 * Analiza un fotograma del rostro recortado + historial para estimar si es 3D real.
 */
export function analyzeSpoofFrame(
  data: Uint8ClampedArray,
  size: number,
  box: Box,
  globalMotion: number,
): SpoofSignals {
  const hf = highFrequencyEnergy(data, size);
  const stripes = subpixelStripeScore(data, size);
  const specular = specularFlatness(data, size);
  const colorRisk = colorChannelRisk(data);

  const { energies, gray } = regionMotionEnergies(data, size, prevGraySpoof);
  prevGraySpoof = gray;

  history.push({
    box: { ...box },
    motion: globalMotion,
    regionMotion: energies,
    t: performance.now(),
  });
  if (history.length > MAX_HIST) history.shift();

  // Riesgo textura pantalla: franjas subpíxel + HF extremo
  const screenTextureRisk = Math.min(
    1,
    Math.max(0, (stripes - 18) / 40) * 0.65 + Math.max(0, (hf - 28) / 50) * 0.35,
  );

  // Parallax / profundidad proxy: con movimiento de cabeza, las regiones no se mueven igual
  let depthProxy = 0.4; // neutral hasta tener historial
  let rigidMotionRisk = 0;

  if (history.length >= 4) {
    const recent = history.slice(-6);
    const motions = recent.map((f) => f.motion);
    const avgMotion = motions.reduce((a, b) => a + b, 0) / motions.length;

    // Variación de tamaño del box (acercamiento real cambia perspective)
    const sizes = recent.map((f) => f.box.width * f.box.height);
    const sizeVar =
      Math.max(...sizes) - Math.min(...sizes);
    const sizeRel = sizeVar / (sizes[0] || 1);

    // Disparidad de movimiento entre cuadrantes (3D rota → asimetría)
    let asym = 0;
    for (const f of recent) {
      const [a, b, c, d] = f.regionMotion;
      const mean = (a + b + c + d) / 4 || 1e-6;
      asym +=
        (Math.abs(a - mean) + Math.abs(b - mean) + Math.abs(c - mean) + Math.abs(d - mean)) /
        mean;
    }
    asym /= recent.length;

    // Foto plana: movimiento global pero asimetría regional muy baja
    if (avgMotion > 0.8 && asym < 0.35) {
      rigidMotionRisk = Math.min(1, 0.55 + (0.8 - asym));
    } else if (avgMotion > 0.5 && asym > 0.55) {
      rigidMotionRisk = Math.max(0, 0.25 - asym * 0.1);
    }

    // Proxy de profundidad: asimetría + cambio de escala moderado
    depthProxy = Math.min(
      1,
      0.25 + Math.min(1, asym / 1.8) * 0.45 + Math.min(1, sizeRel * 8) * 0.2 +
        Math.min(1, avgMotion / 4) * 0.15,
    );

    // Si no hay movimiento en muchos frames → no podemos validar 3D
    if (avgMotion < 0.35) {
      depthProxy = Math.min(depthProxy, 0.45);
    }
  }

  // Score final de liveness (1 = real)
  const risk =
    screenTextureRisk * 0.28 +
    specular * 0.18 +
    colorRisk * 0.12 +
    rigidMotionRisk * 0.27 +
    (1 - depthProxy) * 0.15;

  const livenessScore = Math.max(0, Math.min(1, 1 - risk));

  let ok = livenessScore >= 0.42;
  let reason: string | undefined;

  if (screenTextureRisk > 0.62) {
    ok = false;
    reason = 'Posible pantalla o foto digital detectada';
  } else if (rigidMotionRisk > 0.7 && history.length >= 5) {
    ok = false;
    reason = 'Movimiento plano detectado — use su rostro real';
  } else if (specular > 0.75) {
    ok = false;
    reason = 'Brillo de pantalla detectado';
  } else if (livenessScore < 0.42) {
    ok = false;
    reason = 'No se pudo verificar profundidad 3D — gire un poco la cabeza';
  }

  return {
    livenessScore,
    screenTextureRisk,
    specularRisk: specular,
    colorRisk,
    rigidMotionRisk,
    depthProxy,
    ok,
    reason,
  };
}

/** Agrega historial mínimo de movimiento para decisión final. */
export function hasEnoughSpoofHistory(): boolean {
  return history.length >= 4;
}

export function getSpoofHistoryLength(): number {
  return history.length;
}
