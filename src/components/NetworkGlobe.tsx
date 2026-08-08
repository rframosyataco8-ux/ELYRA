import { useEffect, useRef } from 'react';

interface Point3D {
  ox: number;
  oy: number;
  oz: number;
  pulse: number;
  hue: number;
}

interface NetworkGlobeProps {
  speaking: boolean;
  listening: boolean;
  size?: number;
  amplitude?: number;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Soft Google-blue palette (less neon, easier on eyes) */
const C = {
  core: '88, 166, 255',
  mid: '121, 184, 255',
  soft: '160, 200, 255',
  white: '230, 237, 243',
};

export function NetworkGlobe({
  speaking,
  listening,
  size = 360,
  amplitude = 0,
}: NetworkGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point3D[]>([]);
  const rafRef = useRef(0);
  const rotRef = useRef({ x: 0.22, y: 0 });
  const timeRef = useRef(0);
  const stateRef = useRef({ speaking, listening, amplitude });
  const smoothRef = useRef({
    activity: 0,
    amp: 0,
    coreBoost: 0,
    listenGlow: 0,
  });
  stateRef.current = { speaking, listening, amplitude };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const points: Point3D[] = [];
    const count = 180;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      points.push({
        ox: Math.cos(theta) * radius,
        oy: y,
        oz: Math.sin(theta) * radius,
        pulse: (i * 0.37) % (Math.PI * 2),
        hue: (i * 0.11) % 1,
      });
    }
    pointsRef.current = points;

    const project = (p: Point3D, rotY: number, rotX: number) => {
      const x = p.ox * Math.cos(rotY) - p.oz * Math.sin(rotY);
      const z = p.ox * Math.sin(rotY) + p.oz * Math.cos(rotY);
      const y = p.oy;
      const y2 = y * Math.cos(rotX) - z * Math.sin(rotX);
      const z2 = y * Math.sin(rotX) + z * Math.cos(rotX);
      const scale = size * 0.34;
      const perspective = 700 / (700 + z2 * scale);
      return {
        sx: size / 2 + x * scale * perspective,
        sy: size / 2 + y2 * scale * perspective * 0.94,
        depth: z2,
        scale: perspective,
      };
    };

    const draw = () => {
      timeRef.current += 0.016;
      const t = timeRef.current;
      const { speaking: sp, listening: li, amplitude: rawAmp } = stateRef.current;

      const targetActivity = sp || li ? 1 : 0;
      const targetAmp = Math.min(1, Math.max(0, rawAmp));
      const targetListen = li ? 1 : 0;
      const targetSpeak = sp ? 1 : 0;

      const sm = smoothRef.current;
      sm.activity = lerp(sm.activity, targetActivity, 0.06);
      sm.amp = lerp(sm.amp, targetAmp, 0.12);
      sm.listenGlow = lerp(sm.listenGlow, targetListen, 0.08);
      sm.coreBoost = lerp(sm.coreBoost, targetSpeak * 0.7 + targetListen * 0.4, 0.07);

      const act = sm.activity;
      const amp = sm.amp;
      const listen = sm.listenGlow;

      rotRef.current.y += 0.0028 + act * 0.007 + amp * 0.005;
      rotRef.current.x = 0.2 + Math.sin(t * 0.3) * 0.022 + listen * 0.015;

      ctx.clearRect(0, 0, size, size);

      // Soft atmosphere
      const atmosA = 0.05 + act * 0.1 + amp * 0.12 + listen * 0.06;
      const outer = ctx.createRadialGradient(
        size / 2,
        size / 2,
        size * 0.04,
        size / 2,
        size / 2,
        size * 0.5,
      );
      outer.addColorStop(0, `rgba(${C.mid}, ${atmosA * 0.7})`);
      outer.addColorStop(0.25, `rgba(${C.core}, ${atmosA * 0.4})`);
      outer.addColorStop(0.55, `rgba(${C.core}, ${atmosA * 0.12})`);
      outer.addColorStop(1, 'transparent');
      ctx.fillStyle = outer;
      ctx.fillRect(0, 0, size, size);

      if (listen > 0.02) {
        const haloR = size * (0.36 + Math.sin(t * 1.8) * 0.01) + amp * size * 0.015;
        const halo = ctx.createRadialGradient(
          size / 2,
          size / 2,
          haloR * 0.7,
          size / 2,
          size / 2,
          haloR * 1.12,
        );
        halo.addColorStop(0, 'transparent');
        halo.addColorStop(0.7, `rgba(${C.core}, ${0.06 * listen})`);
        halo.addColorStop(1, 'transparent');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, haloR * 1.12, 0, Math.PI * 2);
        ctx.fill();
      }

      const projected = pointsRef.current.map((p) =>
        project(p, rotRef.current.y, rotRef.current.x),
      );
      projected.sort((a, b) => a.depth - b.depth);

      // Soft orbital rings
      for (let r = 0; r < 3; r++) {
        const ringR =
          size * (0.26 + r * 0.055) +
          Math.sin(t * 1.0 + r * 0.9) * (1.5 + act * 3) +
          amp * 2;
        ctx.beginPath();
        ctx.ellipse(
          size / 2,
          size / 2,
          ringR,
          ringR * (0.16 + r * 0.02),
          Math.sin(t * 0.28 + r * 0.6) * (0.4 + act * 0.12),
          0,
          Math.PI * 2,
        );
        ctx.strokeStyle = `rgba(${C.core}, ${0.08 - r * 0.015 + act * 0.07 + amp * 0.04})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Links
      const maxDist = 0.36 + act * 0.1;
      const n = pointsRef.current.length;
      const maxLinks = act > 0.5 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        let links = 0;
        for (let j = i + 1; j < n && links < maxLinks; j++) {
          const a = pointsRef.current[i];
          const b = pointsRef.current[j];
          const dx = a.ox - b.ox;
          const dy = a.oy - b.oy;
          const dz = a.oz - b.oz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < maxDist && dist > 0.1) {
            const pa = projected[i];
            const pb = projected[j];
            if (pa.depth > -0.5 && pb.depth > -0.5) {
              const alpha = (0.06 + act * 0.14 + amp * 0.05) * (1 - dist / maxDist);
              ctx.beginPath();
              ctx.moveTo(pa.sx, pa.sy);
              ctx.lineTo(pb.sx, pb.sy);
              ctx.strokeStyle = `rgba(${C.core}, ${alpha})`;
              ctx.lineWidth = 0.7;
              ctx.stroke();
              links++;
            }
          }
        }
      }

      // Points
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        const base = pointsRef.current[i];
        const pulse =
          0.75 +
          0.25 * Math.sin(t * 1.8 + base.pulse) +
          amp * 0.15 * Math.sin(t * 4 + base.pulse);
        const depthFactor = Math.max(0.15, (p.depth + 1) / 2);
        const r = (1.2 + act * 0.6) * p.scale * pulse * (1 + amp * 0.25);

        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        const bright = 0.2 + depthFactor * 0.55;
        ctx.fillStyle = `rgba(${C.soft}, ${bright})`;
        ctx.fill();
      }

      // Soft core
      const coreR = 14 + amp * 10 + sm.coreBoost * 6 + Math.sin(t * 2.2) * (1 + act * 1.5);
      const core = ctx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        coreR * 2.8,
      );
      core.addColorStop(0, `rgba(${C.white}, ${0.85 + amp * 0.08})`);
      core.addColorStop(0.15, `rgba(${C.soft}, ${0.55 + amp * 0.12})`);
      core.addColorStop(0.4, `rgba(${C.core}, ${0.28 + act * 0.15 + amp * 0.1})`);
      core.addColorStop(0.7, `rgba(${C.core}, ${0.08 + act * 0.06})`);
      core.addColorStop(1, 'transparent');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, coreR * 2.8, 0, Math.PI * 2);
      ctx.fill();

      if (act > 0.1) {
        const pulseR = coreR * 1.6 + Math.sin(t * 3) * (3 + amp * 4);
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${C.mid}, ${(0.12 + amp * 0.18) * act})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Bottom rings
      const ringY = size * 0.82;
      for (let i = 0; i < 3; i++) {
        const rr =
          28 + i * 22 + Math.sin(t * 1.6 + i * 0.8) * (1 + act * 3) + amp * 1.5;
        ctx.beginPath();
        ctx.ellipse(size / 2, ringY, rr, rr * 0.1, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${C.core}, ${0.12 - i * 0.03 + act * 0.06})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [size]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(${C.core}, 0.08) 0%, rgba(${C.core}, 0.03) 40%, transparent 70%)`,
          filter: 'blur(24px)',
        }}
      />
      <canvas ref={canvasRef} className="block relative z-10" />
    </div>
  );
}
