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
    const count = 200;
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

      rotRef.current.y += active ? 0.012 : 0.004;
      rotRef.current.x = 0.2 + Math.sin(t * 0.4) * 0.03;

      ctx.clearRect(0, 0, size, size);

      // Deep atmospheric glow
      const outer = ctx.createRadialGradient(
        size / 2, size / 2, size * 0.06,
        size / 2, size / 2, size * 0.5,
      );
      const a = 0.08 + (active ? 0.16 : 0) + amp * 0.22;
      outer.addColorStop(0, `rgba(56, 189, 248, ${a})`);
      outer.addColorStop(0.35, `rgba(14, 165, 233, ${a * 0.4})`);
      outer.addColorStop(0.7, `rgba(6, 100, 180, ${a * 0.12})`);
      outer.addColorStop(1, 'transparent');
      ctx.fillStyle = outer;
      ctx.fillRect(0, 0, size, size);

      const projected = pointsRef.current.map((p) =>
        project(p, rotRef.current.y, rotRef.current.x),
      );
      projected.sort((a, b) => a.depth - b.depth);

      // Orbital rings — more dynamic
      for (let r = 0; r < 4; r++) {
        const ringR = size * (0.26 + r * 0.055) + Math.sin(t * 1.4 + r * 0.8) * (active ? 5 : 2);
        ctx.beginPath();
        ctx.ellipse(
          size / 2,
          size / 2,
          ringR,
          ringR * (0.18 + r * 0.02),
          Math.sin(t * 0.35 + r * 0.7) * 0.5,
          0,
          Math.PI * 2,
        );
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.14 - r * 0.025 + (active ? 0.1 : 0)})`;
        ctx.lineWidth = 1 + (active ? 0.3 : 0);
        ctx.stroke();
      }

      // Hex grid arcs
      if (active) {
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + t * 0.15;
          const r1 = size * 0.32;
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, r1, ang, ang + 0.35);
          ctx.strokeStyle = `rgba(125, 211, 252, ${0.15 + amp * 0.2})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      // Connections denser when active
      const maxDist = active ? 0.48 : 0.4;
      const n = pointsRef.current.length;
      for (let i = 0; i < n; i++) {
        let links = 0;
        const maxLinks = active ? 4 : 3;
        for (let j = i + 1; j < n && links < maxLinks; j++) {
          const a = pointsRef.current[i];
          const b = pointsRef.current[j];
          const dx = a.ox - b.ox;
          const dy = a.oy - b.oy;
          const dz = a.oz - b.oz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < maxDist && dist > 0.08) {
            const pa = projected[i];
            const pb = projected[j];
            if (pa.depth > -0.55 && pb.depth > -0.55) {
              const alpha = (active ? 0.32 : 0.11) * (1 - dist / maxDist);
              ctx.beginPath();
              ctx.moveTo(pa.sx, pa.sy);
              ctx.lineTo(pb.sx, pb.sy);
              ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
              ctx.lineWidth = active ? 1 : 0.8;
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
        const pulse = 0.7 + 0.3 * Math.sin(t * 2.4 + base.pulse) + amp * 0.3;
        const depthFactor = Math.max(0.15, (p.depth + 1) / 2);
        const r = (active ? 2.3 : 1.45) * p.scale * pulse * (1 + amp * 0.4);

        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(125, 211, 252, ${0.28 + depthFactor * 0.65})`;
        ctx.fill();

        if (active && Math.random() > 0.96) {
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, r * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, 0.18)`;
          ctx.fill();
        }
      }

      // Energy core
      const coreR = 18 + amp * 16 + (active ? 7 : 0);
      const core = ctx.createRadialGradient(
        size / 2, size / 2, 0,
        size / 2, size / 2, coreR * 3,
      );
      core.addColorStop(0, `rgba(255, 255, 255, ${0.95 + amp * 0.05})`);
      core.addColorStop(0.15, `rgba(186, 230, 253, ${0.7 + amp * 0.2})`);
      core.addColorStop(0.35, `rgba(56, 189, 248, ${0.5 + amp * 0.3})`);
      core.addColorStop(0.6, `rgba(14, 165, 233, ${0.18 + amp * 0.15})`);
      core.addColorStop(1, 'transparent');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, coreR * 3, 0, Math.PI * 2);
      ctx.fill();

      // Pulsing ring around core
      if (active) {
        const pulseR = coreR * 1.8 + Math.sin(t * 4) * 6;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(125, 211, 252, ${0.25 + amp * 0.3})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Bottom holographic platform
      const ringY = size * 0.82;
      for (let i = 0; i < 4; i++) {
        const rr = 32 + i * 24 + Math.sin(t * 2.2 + i) * (active ? 5 : 1.5);
        ctx.beginPath();
        ctx.ellipse(size / 2, ringY, rr, rr * 0.12, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.22 - i * 0.04 + (active ? 0.08 : 0)})`;
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
      <div
        className="absolute inset-0 rounded-full animate-breathe"
        style={{
          background: 'radial-gradient(circle, rgba(14,165,233,0.12) 0%, rgba(14,165,233,0.03) 40%, transparent 70%)',
          filter: 'blur(24px)',
        }}
      />
      <canvas ref={canvasRef} className="block relative z-10" />
    </div>
  );
}
