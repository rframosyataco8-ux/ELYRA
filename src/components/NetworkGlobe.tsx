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
    const count = 160;
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
      const { speaking: sp, listening: li, amplitude: amp } = stateRef.current;
      const active = sp || li;

      rotRef.current.y += active ? 0.009 : 0.0035;
      rotRef.current.x = 0.2 + Math.sin(t * 0.45) * 0.025;

      ctx.clearRect(0, 0, size, size);

      // Outer atmospheric glow
      const outer = ctx.createRadialGradient(
        size / 2, size / 2, size * 0.08,
        size / 2, size / 2, size * 0.48,
      );
      const a = 0.06 + (active ? 0.12 : 0) + amp * 0.18;
      outer.addColorStop(0, `rgba(56, 189, 248, ${a})`);
      outer.addColorStop(0.45, `rgba(14, 165, 233, ${a * 0.35})`);
      outer.addColorStop(1, 'transparent');
      ctx.fillStyle = outer;
      ctx.fillRect(0, 0, size, size);

      const projected = pointsRef.current.map((p) =>
        project(p, rotRef.current.y, rotRef.current.x),
      );
      projected.sort((a, b) => a.depth - b.depth);

      // Orbital rings
      for (let r = 0; r < 3; r++) {
        const ringR = size * (0.28 + r * 0.06) + Math.sin(t * 1.2 + r) * (active ? 4 : 1.5);
        ctx.beginPath();
        ctx.ellipse(
          size / 2,
          size / 2,
          ringR,
          ringR * 0.22,
          Math.sin(t * 0.3 + r) * 0.4,
          0,
          Math.PI * 2,
        );
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.12 - r * 0.03 + (active ? 0.08 : 0)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Connections
      const maxDist = 0.42;
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
          if (dist < maxDist && dist > 0.1) {
            const pa = projected[i];
            const pb = projected[j];
            if (pa.depth > -0.55 && pb.depth > -0.55) {
              const alpha = (active ? 0.28 : 0.12) * (1 - dist / maxDist);
              ctx.beginPath();
              ctx.moveTo(pa.sx, pa.sy);
              ctx.lineTo(pb.sx, pb.sy);
              ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
              ctx.lineWidth = 0.85;
              ctx.stroke();
              links++;
            }
          }
        }
      }

      // Nodes
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        const base = pointsRef.current[i];
        const pulse = 0.7 + 0.3 * Math.sin(t * 2.2 + base.pulse) + amp * 0.25;
        const depthFactor = Math.max(0.2, (p.depth + 1) / 2);
        const r = (active ? 2.1 : 1.5) * p.scale * pulse * (1 + amp * 0.35);

        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(125, 211, 252, ${0.3 + depthFactor * 0.6})`;
        ctx.fill();

        if (active && Math.random() > 0.97) {
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, r * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, 0.15)`;
          ctx.fill();
        }
      }

      // Core
      const coreR = 16 + amp * 14 + (active ? 5 : 0);
      const core = ctx.createRadialGradient(
        size / 2, size / 2, 0,
        size / 2, size / 2, coreR * 2.8,
      );
      core.addColorStop(0, `rgba(240, 249, 255, ${0.9 + amp * 0.1})`);
      core.addColorStop(0.25, `rgba(56, 189, 248, ${0.45 + amp * 0.3})`);
      core.addColorStop(0.55, `rgba(14, 165, 233, ${0.15 + amp * 0.15})`);
      core.addColorStop(1, 'transparent');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, coreR * 2.8, 0, Math.PI * 2);
      ctx.fill();

      // Bottom platform rings
      const ringY = size * 0.8;
      for (let i = 0; i < 3; i++) {
        const rr = 36 + i * 26 + Math.sin(t * 2 + i) * (active ? 4 : 1.2);
        ctx.beginPath();
        ctx.ellipse(size / 2, ringY, rr, rr * 0.13, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.2 - i * 0.05})`;
        ctx.lineWidth = 1.1;
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
          background: 'radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />
      <canvas ref={canvasRef} className="block relative z-10" />
    </div>
  );
}
