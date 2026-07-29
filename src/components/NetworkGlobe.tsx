import { useEffect, useRef } from 'react';

interface Point3D {
  x: number;
  y: number;
  z: number;
  ox: number;
  oy: number;
  oz: number;
  pulse: number;
}

interface NetworkGlobeProps {
  speaking: boolean;
  listening: boolean;
  size?: number;
}

export function NetworkGlobe({ speaking, listening, size = 380 }: NetworkGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point3D[]>([]);
  const rafRef = useRef<number>(0);
  const rotationRef = useRef({ x: 0.15, y: 0 });
  const timeRef = useRef(0);

  const active = speaking || listening;
  const intensity = speaking ? 1.4 : listening ? 1.15 : 0.7;

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
    ctx.scale(dpr, dpr);

    // Generate points on a sphere (Fibonacci sphere for even distribution)
    const count = 180;
    const points: Point3D[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = golden * i;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      points.push({
        x, y, z,
        ox: x, oy: y, oz: z,
        pulse: Math.random() * Math.PI * 2,
      });
    }
    pointsRef.current = points;

    const project = (p: Point3D, rotY: number, rotX: number) => {
      // Rotate around Y
      let x = p.ox * Math.cos(rotY) - p.oz * Math.sin(rotY);
      let z = p.ox * Math.sin(rotY) + p.oz * Math.cos(rotY);
      let y = p.oy;

      // Rotate around X
      const y2 = y * Math.cos(rotX) - z * Math.sin(rotX);
      const z2 = y * Math.sin(rotX) + z * Math.cos(rotX);

      const scale = 140;
      const perspective = 600 / (600 + z2 * scale);
      return {
        sx: size / 2 + x * scale * perspective,
        sy: size / 2 + y2 * scale * perspective,
        depth: z2,
        scale: perspective,
      };
    };

    const draw = () => {
      timeRef.current += 0.016;
      const t = timeRef.current;

      // Rotation speed depends on state
      const rotSpeed = active ? 0.008 : 0.0035;
      rotationRef.current.y += rotSpeed;
      if (speaking) rotationRef.current.x = 0.12 + Math.sin(t * 1.5) * 0.04;
      else if (listening) rotationRef.current.x = 0.15 + Math.sin(t * 2.2) * 0.06;
      else rotationRef.current.x = 0.15;

      ctx.clearRect(0, 0, size, size);

      // Soft glow behind globe
      const glow = ctx.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size * 0.48);
      if (speaking) {
        glow.addColorStop(0, 'rgba(0, 180, 255, 0.22)');
        glow.addColorStop(0.5, 'rgba(0, 120, 255, 0.08)');
        glow.addColorStop(1, 'transparent');
      } else if (listening) {
        glow.addColorStop(0, 'rgba(0, 200, 255, 0.18)');
        glow.addColorStop(0.5, 'rgba(0, 140, 255, 0.06)');
        glow.addColorStop(1, 'transparent');
      } else {
        glow.addColorStop(0, 'rgba(0, 140, 255, 0.12)');
        glow.addColorStop(0.6, 'rgba(0, 100, 200, 0.04)');
        glow.addColorStop(1, 'transparent');
      }
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      // Project all points
      const projected = pointsRef.current.map((p) => {
        const proj = project(p, rotationRef.current.y, rotationRef.current.x);
        return { ...proj, pulse: p.pulse };
      });

      // Sort by depth (back to front)
      projected.sort((a, b) => a.depth - b.depth);

      // Draw connections (only nearby points in 3D space)
      const maxDist = active ? 0.52 : 0.42;
      const lineAlpha = active ? 0.28 : 0.12;

      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const a = pointsRef.current[i];
          const b = pointsRef.current[j];
          const dx = a.ox - b.ox;
          const dy = a.oy - b.oy;
          const dz = a.oz - b.oz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < maxDist) {
            const pa = projected[i];
            const pb = projected[j];
            // Only draw if both are somewhat visible (not too far back)
            if (pa.depth > -0.6 && pb.depth > -0.6) {
              const alpha = lineAlpha * (1 - dist / maxDist) * Math.min(pa.scale, pb.scale);
              ctx.beginPath();
              ctx.moveTo(pa.sx, pa.sy);
              ctx.lineTo(pb.sx, pb.sy);
              ctx.strokeStyle = speaking
                ? `rgba(80, 200, 255, ${alpha * 1.3})`
                : listening
                ? `rgba(100, 210, 255, ${alpha * 1.1})`
                : `rgba(60, 160, 255, ${alpha})`;
              ctx.lineWidth = active ? 1.1 : 0.7;
              ctx.stroke();
            }
          }
        }
      }

      // Draw points
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        const base = pointsRef.current[i];
        const pulse = 0.7 + 0.3 * Math.sin(t * (active ? 4 : 2) + base.pulse);
        const depthFactor = Math.max(0.25, (p.depth + 1) / 2);
        const r = (active ? 2.4 : 1.7) * p.scale * pulse * intensity;

        // Point glow
        if (active && depthFactor > 0.4) {
          const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 4);
          g.addColorStop(0, speaking ? 'rgba(100, 220, 255, 0.45)' : 'rgba(80, 200, 255, 0.35)');
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, r * 4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        const alpha = 0.35 + depthFactor * 0.65;
        ctx.fillStyle = speaking
          ? `rgba(120, 230, 255, ${alpha})`
          : listening
          ? `rgba(100, 210, 255, ${alpha})`
          : `rgba(70, 180, 255, ${alpha * 0.9})`;
        ctx.fill();
      }

      // Bottom energy rings (like in the image)
      const ringY = size * 0.78;
      for (let i = 0; i < 4; i++) {
        const ringR = 30 + i * 22 + (active ? Math.sin(t * 3 + i) * 4 : 0);
        const ringAlpha = (0.25 - i * 0.05) * (active ? 1.4 : 0.7);
        ctx.beginPath();
        ctx.ellipse(size / 2, ringY, ringR, ringR * 0.18, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 180, 255, ${ringAlpha})`;
        ctx.lineWidth = 1.5 - i * 0.2;
        ctx.stroke();
      }

      // Central beam / pedestal glow
      const beam = ctx.createLinearGradient(size / 2, size * 0.55, size / 2, size * 0.82);
      beam.addColorStop(0, active ? 'rgba(0, 200, 255, 0.5)' : 'rgba(0, 160, 255, 0.25)');
      beam.addColorStop(1, 'transparent');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(size / 2 - 8, size * 0.55);
      ctx.lineTo(size / 2 + 8, size * 0.55);
      ctx.lineTo(size / 2 + 28, size * 0.82);
      ctx.lineTo(size / 2 - 28, size * 0.82);
      ctx.closePath();
      ctx.fill();

      // Core bright spot at base of globe
      const core = ctx.createRadialGradient(size / 2, size * 0.72, 0, size / 2, size * 0.72, 40);
      core.addColorStop(0, active ? 'rgba(150, 240, 255, 0.9)' : 'rgba(80, 200, 255, 0.6)');
      core.addColorStop(0.4, active ? 'rgba(0, 180, 255, 0.4)' : 'rgba(0, 140, 255, 0.2)');
      core.addColorStop(1, 'transparent');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(size / 2, size * 0.72, 40, 0, Math.PI * 2);
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(rafRef.current);
  }, [size, speaking, listening, active, intensity]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
