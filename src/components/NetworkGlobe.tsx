import { useEffect, useRef } from 'react';

interface Point3D {
  ox: number;
  oy: number;
  oz: number;
  pulse: number;
  ring?: boolean;
}

interface NetworkGlobeProps {
  speaking: boolean;
  listening: boolean;
  size?: number;
}

export function NetworkGlobe({ speaking, listening, size = 380 }: NetworkGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point3D[]>([]);
  const rafRef = useRef(0);
  const rotRef = useRef({ x: 0.18, y: 0, z: 0 });
  const timeRef = useRef(0);
  const stateRef = useRef({ speaking, listening });
  stateRef.current = { speaking, listening };

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
    const count = 260;
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
    // Anillos latitudinales extra (más “núcleo de red”)
    for (let lat = -2; lat <= 2; lat++) {
      const y = lat * 0.32;
      const r = Math.sqrt(Math.max(0.05, 1 - y * y));
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        points.push({
          ox: Math.cos(a) * r,
          oy: y,
          oz: Math.sin(a) * r,
          pulse: a,
          ring: true,
        });
      }
    }
    pointsRef.current = points;

    const project = (p: Point3D, rotY: number, rotX: number) => {
      let x = p.ox * Math.cos(rotY) - p.oz * Math.sin(rotY);
      let z = p.ox * Math.sin(rotY) + p.oz * Math.cos(rotY);
      let y = p.oy;
      const y2 = y * Math.cos(rotX) - z * Math.sin(rotX);
      const z2 = y * Math.sin(rotX) + z * Math.cos(rotX);
      const scale = size * 0.36;
      const perspective = 700 / (700 + z2 * scale);
      return {
        sx: size / 2 + x * scale * perspective,
        sy: size / 2 + y2 * scale * perspective * 0.92,
        depth: z2,
        scale: perspective,
      };
    };

    const draw = () => {
      timeRef.current += 0.016;
      const t = timeRef.current;
      const { speaking: sp, listening: li } = stateRef.current;
      const active = sp || li;
      const intensity = sp ? 1.55 : li ? 1.25 : 0.75;

      rotRef.current.y += active ? 0.011 : 0.0042;
      rotRef.current.x = 0.16 + Math.sin(t * (sp ? 1.8 : li ? 2.4 : 0.6)) * (active ? 0.05 : 0.015);

      ctx.clearRect(0, 0, size, size);

      // Halo exterior
      const outer = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.5);
      if (sp) {
        outer.addColorStop(0, 'rgba(0, 210, 255, 0.28)');
        outer.addColorStop(0.45, 'rgba(0, 120, 255, 0.1)');
        outer.addColorStop(1, 'transparent');
      } else if (li) {
        outer.addColorStop(0, 'rgba(80, 220, 255, 0.22)');
        outer.addColorStop(0.5, 'rgba(0, 150, 255, 0.08)');
        outer.addColorStop(1, 'transparent');
      } else {
        outer.addColorStop(0, 'rgba(0, 150, 255, 0.14)');
        outer.addColorStop(0.55, 'rgba(0, 90, 200, 0.05)');
        outer.addColorStop(1, 'transparent');
      }
      ctx.fillStyle = outer;
      ctx.fillRect(0, 0, size, size);

      // Órbitas elípticas
      for (let i = 0; i < 3; i++) {
        const rx = size * (0.28 + i * 0.07);
        const ry = rx * 0.32;
        const ang = t * (0.3 + i * 0.12) + i;
        ctx.save();
        ctx.translate(size / 2, size / 2 + 8);
        ctx.rotate(ang * 0.15 + i * 0.4);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(60, 190, 255, ${0.08 + i * 0.03 + (active ? 0.08 : 0)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      const projected = pointsRef.current.map((p) => ({
        ...project(p, rotRef.current.y, rotRef.current.x),
        pulse: p.pulse,
        ring: p.ring,
        src: p,
      }));
      projected.sort((a, b) => a.depth - b.depth);

      // Conexiones densas
      const maxDist = active ? 0.48 : 0.38;
      const n = pointsRef.current.length;
      // muestrear para rendimiento
      for (let i = 0; i < n; i += 1) {
        let links = 0;
        for (let j = i + 1; j < n && links < 6; j++) {
          const a = pointsRef.current[i];
          const b = pointsRef.current[j];
          const dx = a.ox - b.ox;
          const dy = a.oy - b.oy;
          const dz = a.oz - b.oz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < maxDist && dist > 0.08) {
            const pa = projected[i];
            const pb = projected[j];
            if (pa.depth > -0.7 && pb.depth > -0.7) {
              const alpha =
                (active ? 0.32 : 0.14) * (1 - dist / maxDist) * Math.min(pa.scale, pb.scale);
              ctx.beginPath();
              ctx.moveTo(pa.sx, pa.sy);
              ctx.lineTo(pb.sx, pb.sy);
              ctx.strokeStyle = sp
                ? `rgba(100, 230, 255, ${alpha})`
                : li
                ? `rgba(120, 220, 255, ${alpha * 0.95})`
                : `rgba(50, 170, 255, ${alpha})`;
              ctx.lineWidth = active ? 1.05 : 0.65;
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
        const pulse = 0.65 + 0.35 * Math.sin(t * (active ? 5 : 2.2) + base.pulse);
        const depthFactor = Math.max(0.2, (p.depth + 1) / 2);
        const r = (base.ring ? 1.4 : active ? 2.35 : 1.65) * p.scale * pulse * intensity;

        if (active && depthFactor > 0.45) {
          const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 5);
          g.addColorStop(0, sp ? 'rgba(140, 240, 255, 0.5)' : 'rgba(100, 220, 255, 0.4)');
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, r * 5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        const alpha = 0.3 + depthFactor * 0.7;
        ctx.fillStyle = sp
          ? `rgba(150, 245, 255, ${alpha})`
          : li
          ? `rgba(120, 230, 255, ${alpha})`
          : `rgba(70, 190, 255, ${alpha * 0.88})`;
        ctx.fill();
      }

      // Núcleo brillante central
      const corePulse = 0.85 + 0.15 * Math.sin(t * (active ? 6 : 2));
      const coreR = (active ? 28 : 20) * corePulse;
      const core = ctx.createRadialGradient(size / 2, size / 2 - 6, 0, size / 2, size / 2 - 6, coreR * 2.2);
      core.addColorStop(0, sp ? 'rgba(220, 250, 255, 0.95)' : 'rgba(160, 230, 255, 0.7)');
      core.addColorStop(0.35, sp ? 'rgba(0, 200, 255, 0.45)' : 'rgba(0, 160, 255, 0.25)');
      core.addColorStop(1, 'transparent');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2 - 6, coreR * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Anillos de energía inferiores (pedestal)
      const ringY = size * 0.8;
      for (let i = 0; i < 5; i++) {
        const wave = active ? Math.sin(t * 3.5 + i * 0.9) * 5 : Math.sin(t * 1.2 + i) * 2;
        const ringR = 28 + i * 20 + wave;
        const ringAlpha = (0.28 - i * 0.04) * (active ? 1.5 : 0.75);
        ctx.beginPath();
        ctx.ellipse(size / 2, ringY, ringR, ringR * 0.16, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 200, 255, ${Math.max(0.04, ringAlpha)})`;
        ctx.lineWidth = 1.6 - i * 0.15;
        ctx.stroke();
      }

      // Haz vertical de energía
      const beam = ctx.createLinearGradient(size / 2, size * 0.52, size / 2, size * 0.84);
      beam.addColorStop(0, active ? 'rgba(80, 230, 255, 0.55)' : 'rgba(0, 170, 255, 0.22)');
      beam.addColorStop(1, 'transparent');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(size / 2 - 6, size * 0.52);
      ctx.lineTo(size / 2 + 6, size * 0.52);
      ctx.lineTo(size / 2 + 32, size * 0.84);
      ctx.lineTo(size / 2 - 32, size * 0.84);
      ctx.closePath();
      ctx.fill();

      // Destello base
      const baseGlow = ctx.createRadialGradient(size / 2, size * 0.78, 0, size / 2, size * 0.78, 50);
      baseGlow.addColorStop(0, active ? 'rgba(180, 250, 255, 0.85)' : 'rgba(90, 210, 255, 0.5)');
      baseGlow.addColorStop(0.4, active ? 'rgba(0, 190, 255, 0.35)' : 'rgba(0, 140, 255, 0.15)');
      baseGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = baseGlow;
      ctx.beginPath();
      ctx.arc(size / 2, size * 0.78, 50, 0, Math.PI * 2);
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [size]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: speaking
            ? 'radial-gradient(circle, rgba(0,200,255,0.12) 0%, transparent 70%)'
            : listening
            ? 'radial-gradient(circle, rgba(0,180,255,0.1) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(0,120,255,0.06) 0%, transparent 70%)',
          filter: 'blur(8px)',
        }}
      />
      <canvas ref={canvasRef} className="block relative z-10" />
    </div>
  );
}
