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

/** Interpolación suave (evita saltos visuales) */
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

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
    const count = 220;
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

      rotRef.current.y += 0.0035 + act * 0.009 + amp * 0.006;
      rotRef.current.x = 0.2 + Math.sin(t * 0.35) * 0.028 + listen * 0.02;

      ctx.clearRect(0, 0, size, size);

      const atmosA = 0.07 + act * 0.14 + amp * 0.18 + listen * 0.08;
      const outer = ctx.createRadialGradient(
        size / 2,
        size / 2,
        size * 0.04,
        size / 2,
        size / 2,
        size * 0.52,
      );
      outer.addColorStop(0, `rgba(125, 211, 252, ${atmosA * 0.9})`);
      outer.addColorStop(0.22, `rgba(56, 189, 248, ${atmosA * 0.55})`);
      outer.addColorStop(0.5, `rgba(14, 165, 233, ${atmosA * 0.22})`);
      outer.addColorStop(0.78, `rgba(6, 80, 160, ${atmosA * 0.08})`);
      outer.addColorStop(1, 'transparent');
      ctx.fillStyle = outer;
      ctx.fillRect(0, 0, size, size);

      if (listen > 0.02) {
        const haloR = size * (0.38 + Math.sin(t * 2.2) * 0.012) + amp * size * 0.02;
        const halo = ctx.createRadialGradient(
          size / 2,
          size / 2,
          haloR * 0.7,
          size / 2,
          size / 2,
          haloR * 1.15,
        );
        halo.addColorStop(0, 'transparent');
        halo.addColorStop(0.55, `rgba(56, 189, 248, ${0.04 * listen})`);
        halo.addColorStop(0.85, `rgba(125, 211, 252, ${0.12 * listen + amp * 0.08})`);
        halo.addColorStop(1, 'transparent');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, haloR * 1.15, 0, Math.PI * 2);
        ctx.fill();
      }

      const projected = pointsRef.current.map((p) =>
        project(p, rotRef.current.y, rotRef.current.x),
      );
      projected.sort((a, b) => a.depth - b.depth);

      for (let r = 0; r < 4; r++) {
        const ringR =
          size * (0.255 + r * 0.055) +
          Math.sin(t * 1.2 + r * 0.9) * (2 + act * 4) +
          amp * 3;
        ctx.beginPath();
        ctx.ellipse(
          size / 2,
          size / 2,
          ringR,
          ringR * (0.17 + r * 0.022),
          Math.sin(t * 0.32 + r * 0.65) * (0.45 + act * 0.15),
          0,
          Math.PI * 2,
        );
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.11 - r * 0.02 + act * 0.1 + amp * 0.06})`;
        ctx.lineWidth = 1 + act * 0.4;
        ctx.stroke();
      }

      if (act > 0.05) {
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + t * (0.12 + listen * 0.08);
          const r1 = size * (0.31 + amp * 0.02);
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, r1, ang, ang + 0.28 + amp * 0.08);
          ctx.strokeStyle = `rgba(125, 211, 252, ${(0.1 + amp * 0.18) * act})`;
          ctx.lineWidth = 1.15;
          ctx.stroke();
        }
      }

      const maxDist = 0.38 + act * 0.12;
      const n = pointsRef.current.length;
      const maxLinks = act > 0.5 ? 4 : 3;
      for (let i = 0; i < n; i++) {
        let links = 0;
        for (let j = i + 1; j < n && links < maxLinks; j++) {
          const a = pointsRef.current[i];
          const b = pointsRef.current[j];
          const dx = a.ox - b.ox;
          const dy = a.oy - b.oy;
          const dz = a.oz - b.oz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < maxDist && dist > 0.09) {
            const pa = projected[i];
            const pb = projected[j];
            if (pa.depth > -0.55 && pb.depth > -0.55) {
              const alpha = (0.09 + act * 0.2 + amp * 0.08) * (1 - dist / maxDist);
              ctx.beginPath();
              ctx.moveTo(pa.sx, pa.sy);
              ctx.lineTo(pb.sx, pb.sy);
              ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
              ctx.lineWidth = 0.75 + act * 0.25;
              ctx.stroke();
              links++;
            }
          }
        }
      }

      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        const base = pointsRef.current[i];
        const pulse =
          0.72 +
          0.28 * Math.sin(t * 2.1 + base.pulse) +
          amp * 0.22 * Math.sin(t * 5 + base.pulse);
        const depthFactor = Math.max(0.12, (p.depth + 1) / 2);
        const r = (1.4 + act * 0.85) * p.scale * pulse * (1 + amp * 0.35);

        const spark = Math.sin(t * 3.1 + base.pulse * 2);
        if (act > 0.3 && spark > 0.92) {
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, r * 2.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, ${0.1 + amp * 0.08})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        const bright = 0.25 + depthFactor * 0.7;
        ctx.fillStyle = `rgba(${Math.round(120 + depthFactor * 40)}, ${Math.round(210 + depthFactor * 20)}, 252, ${bright})`;
        ctx.fill();
      }

      const coreR = 16 + amp * 14 + sm.coreBoost * 8 + Math.sin(t * 2.5) * (1.5 + act * 2);
      const core = ctx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        coreR * 3.2,
      );
      core.addColorStop(0, `rgba(255, 255, 255, ${0.92 + amp * 0.06})`);
      core.addColorStop(0.12, `rgba(224, 242, 254, ${0.75 + amp * 0.15})`);
      core.addColorStop(0.28, `rgba(125, 211, 252, ${0.55 + amp * 0.25})`);
      core.addColorStop(0.48, `rgba(56, 189, 248, ${0.35 + act * 0.2 + amp * 0.15})`);
      core.addColorStop(0.7, `rgba(14, 165, 233, ${0.12 + act * 0.1})`);
      core.addColorStop(1, 'transparent');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, coreR * 3.2, 0, Math.PI * 2);
      ctx.fill();

      if (act > 0.08) {
        const pulseR = coreR * 1.75 + Math.sin(t * 3.6) * (4 + amp * 5);
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(125, 211, 252, ${(0.18 + amp * 0.28) * act})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        const pulseR2 = coreR * 2.15 + Math.sin(t * 2.8 + 1.2) * (3 + amp * 4);
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, pulseR2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56, 189, 248, ${(0.08 + amp * 0.15) * act})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      const ringY = size * 0.82;
      for (let i = 0; i < 4; i++) {
        const rr =
          30 + i * 24 + Math.sin(t * 1.9 + i * 0.8) * (1.2 + act * 4) + amp * 2;
        ctx.beginPath();
        ctx.ellipse(size / 2, ringY, rr, rr * 0.11, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.18 - i * 0.035 + act * 0.08 + amp * 0.04})`;
        ctx.lineWidth = 1.15;
        ctx.stroke();
      }

      if (listen > 0.05) {
        const scanX = size / 2 + Math.sin(t * 1.6) * 40;
        const scan = ctx.createLinearGradient(scanX - 30, ringY, scanX + 30, ringY);
        scan.addColorStop(0, 'transparent');
        scan.addColorStop(0.5, `rgba(125, 211, 252, ${0.15 * listen})`);
        scan.addColorStop(1, 'transparent');
        ctx.strokeStyle = scan as unknown as string;
        ctx.beginPath();
        ctx.ellipse(size / 2, ringY, 78, 78 * 0.11, 0, 0, Math.PI * 2);
        ctx.lineWidth = 2;
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
        className="absolute inset-0 rounded-full animate-breathe"
        style={{
          background:
            'radial-gradient(circle, rgba(14,165,233,0.14) 0%, rgba(56,189,248,0.05) 38%, transparent 70%)',
          filter: 'blur(28px)',
        }}
      />
      <canvas ref={canvasRef} className="block relative z-10" />
    </div>
  );
}
