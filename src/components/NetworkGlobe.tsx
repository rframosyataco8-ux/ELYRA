import { useEffect, useRef } from 'react';

interface Point3D {
  ox: number;
  oy: number;
  oz: number;
  pulse: number;
}

interface NetworkGlobeProps {
  speaking: boolean;
  listening: boolean;
  size?: number;
  amplitude?: number;
}

/** Núcleo limpio: menos ruido visual, más elegancia */
export function NetworkGlobe({
  speaking,
  listening,
  size = 340,
  amplitude = 0,
}: NetworkGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point3D[]>([]);
  const rafRef = useRef(0);
  const rotRef = useRef({ x: 0.2, y: 0 });
  const timeRef = useRef(0);
  const stateRef = useRef({ speaking, listening, amplitude });
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

    // Menos puntos = más limpio
    const points: Point3D[] = [];
    const count = 120;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      points.push({
        ox: Math.cos(theta) * radius,
        oy: y,
        oz: Math.sin(theta) * radius,
        pulse: Math.random() * Math.PI * 2,
      });
    }
    pointsRef.current = points;

    const project = (p: Point3D, rotY: number, rotX: number) => {
      let x = p.ox * Math.cos(rotY) - p.oz * Math.sin(rotY);
      let z = p.ox * Math.sin(rotY) + p.oz * Math.cos(rotY);
      let y = p.oy;
      const y2 = y * Math.cos(rotX) - z * Math.sin(rotX);
      const z2 = y * Math.sin(rotX) + z * Math.cos(rotX);
      const scale = size * 0.32;
      const perspective = 650 / (650 + z2 * scale);
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
      const { speaking: sp, listening: li, amplitude: amp } = stateRef.current;
      const active = sp || li;

      rotRef.current.y += active ? 0.007 : 0.003;
      rotRef.current.x = 0.18 + Math.sin(t * 0.5) * 0.02;

      ctx.clearRect(0, 0, size, size);

      // Halo suave único
      const halo = ctx.createRadialGradient(
        size / 2,
        size / 2,
        size * 0.05,
        size / 2,
        size / 2,
        size * 0.42,
      );
      const a = 0.08 + (active ? 0.1 : 0) + amp * 0.15;
      halo.addColorStop(0, `rgba(56, 189, 248, ${a})`);
      halo.addColorStop(0.6, `rgba(14, 165, 233, ${a * 0.25})`);
      halo.addColorStop(1, 'transparent');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, size, size);

      const projected = pointsRef.current.map((p) => project(p, rotRef.current.y, rotRef.current.x));
      projected.sort((a, b) => a.depth - b.depth);

      // Conexiones: solo vecinas cercanas, pocas
      const maxDist = 0.45;
      const n = pointsRef.current.length;
      for (let i = 0; i < n; i++) {
        let links = 0;
        for (let j = i + 1; j < n && links < 3; j++) {
          const a = pointsRef.current[i];
          const b = pointsRef.current[j];
          const dx = a.ox - b.ox;
          const dy = a.oy - b.oy;
          const dz = a.oz - b.oz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < maxDist && dist > 0.12) {
            const pa = projected[i];
            const pb = projected[j];
            if (pa.depth > -0.5 && pb.depth > -0.5) {
              const alpha = (active ? 0.22 : 0.1) * (1 - dist / maxDist);
              ctx.beginPath();
              ctx.moveTo(pa.sx, pa.sy);
              ctx.lineTo(pb.sx, pb.sy);
              ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
              ctx.lineWidth = 0.8;
              ctx.stroke();
              links++;
            }
          }
        }
      }

      // Nodos
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        const base = pointsRef.current[i];
        const pulse = 0.75 + 0.25 * Math.sin(t * 2 + base.pulse) + amp * 0.2;
        const depthFactor = Math.max(0.25, (p.depth + 1) / 2);
        const r = (active ? 1.9 : 1.4) * p.scale * pulse * (1 + amp * 0.3);

        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(125, 211, 252, ${0.35 + depthFactor * 0.55})`;
        ctx.fill();
      }

      // Núcleo central limpio
      const coreR = 14 + amp * 12 + (active ? 4 : 0);
      const core = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, coreR * 2.5);
      core.addColorStop(0, `rgba(224, 242, 254, ${0.85 + amp * 0.15})`);
      core.addColorStop(0.35, `rgba(56, 189, 248, ${0.35 + amp * 0.25})`);
      core.addColorStop(1, 'transparent');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, coreR * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Un solo anillo inferior sutil
      const ringY = size * 0.78;
      for (let i = 0; i < 2; i++) {
        const rr = 40 + i * 28 + Math.sin(t * 2 + i) * (active ? 3 : 1);
        ctx.beginPath();
        ctx.ellipse(size / 2, ringY, rr, rr * 0.14, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.18 - i * 0.06})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [size]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
