import { motion } from 'framer-motion';
import { Shield, Fingerprint, Lock, Zap } from 'lucide-react';

interface BiometricScannerProps {
  progress: number;
  active?: boolean;
}

function insideProfile(x: number, y: number): boolean {
  const nx = (x - 145) / 90;
  const ny = (y - 175) / 140;
  if (nx * nx * 1.2 + ny * ny > 1) return false;
  if (x > 208) return false;
  if (y < 42 || y > 335) return false;
  return true;
}

function buildMesh() {
  const nodes: { x: number; y: number }[] = [];
  const step = 18;
  for (let y = 52; y <= 320; y += step) {
    for (let x = 60; x <= 200; x += step) {
      const jx = x + ((y * 7) % 5) - 2;
      const jy = y + ((x * 5) % 5) - 2;
      if (insideProfile(jx, jy)) nodes.push({ x: jx, y: jy });
    }
  }
  for (let t = 0; t < Math.PI * 2; t += 0.22) {
    const x = 145 + Math.cos(t) * (82 + Math.sin(t * 2) * 4);
    const y = 175 + Math.sin(t) * (122 + Math.cos(t * 2) * 5);
    if (insideProfile(x, y)) nodes.push({ x, y });
  }

  const edges: [number, number][] = [];
  for (let i = 0; i < nodes.length; i++) {
    let linked = 0;
    for (let j = i + 1; j < nodes.length && linked < 3; j++) {
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      if (d > 8 && d < 26) {
        edges.push([i, j]);
        linked++;
      }
    }
  }
  return { nodes, edges };
}

const MESH = buildMesh();

export function BiometricScanner({ progress, active = true }: BiometricScannerProps) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className="relative hidden lg:flex flex-col justify-between h-full min-h-0 flex-[1.45] max-w-none pr-2 select-none">
      <div
        className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 38% 48%, rgba(18,80,160,0.2) 0%, transparent 58%)',
        }}
      />

      <div className="relative flex-1 flex items-center justify-center z-10 min-h-0">
        <div
          className="absolute w-[360px] h-[360px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(40,130,240,0.22) 0%, transparent 68%)',
            filter: 'blur(28px)',
          }}
        />

        <div className="absolute w-[260px] h-[260px] rounded-full border border-sky-400/12" />
        <div className="absolute w-[300px] h-[300px] rounded-full border border-sky-400/8" />
        <motion.div
          className="absolute w-[340px] h-[340px] rounded-full border border-dashed border-sky-400/10"
          animate={{ rotate: 360 }}
          transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
        />

        <svg
          viewBox="0 0 300 400"
          className="relative z-10 w-[min(300px,32vw)] h-auto max-h-[420px]"
          style={{ filter: 'drop-shadow(0 0 18px rgba(56,180,255,0.35))' }}
          aria-hidden
        >
          <defs>
            <linearGradient id="meshStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {MESH.edges.map(([a, b], i) => (
            <line
              key={`e${i}`}
              x1={MESH.nodes[a].x}
              y1={MESH.nodes[a].y}
              x2={MESH.nodes[b].x}
              y2={MESH.nodes[b].y}
              stroke="url(#meshStroke)"
              strokeWidth="0.5"
              opacity="0.45"
            />
          ))}

          {MESH.nodes.map((n, i) => (
            <circle
              key={`n${i}`}
              cx={n.x}
              cy={n.y}
              r={i % 6 === 0 ? 1.5 : 1}
              fill="#7dd3fc"
              opacity={i % 6 === 0 ? 0.85 : 0.4}
            />
          ))}

          <path
            d="M155 44
               C 102 50, 60 102, 56 160
               C 52 214, 68 262, 100 304
               C 120 328, 140 344, 158 354
               L 168 308
               C 148 286, 132 252, 128 208
               C 124 154, 146 106, 182 86
               C 200 74, 212 58, 210 48
               C 196 38, 174 40, 155 44 Z"
            fill="rgba(56,180,255,0.05)"
            stroke="#38bdf8"
            strokeWidth="1.2"
            opacity="0.75"
          />

          <circle cx="152" cy="160" r="4" fill="#e0f2fe" opacity="0.9" />
          <circle cx="152" cy="160" r="8" fill="none" stroke="#38bdf8" strokeWidth="0.7" opacity="0.45" />
          <motion.line
            x1="152"
            y1="160"
            x2="290"
            y2="160"
            stroke="#38bdf8"
            strokeWidth="1.8"
            strokeLinecap="round"
            animate={{ opacity: active ? [0.35, 0.85, 0.35] : 0.4 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </svg>

        <div
          className="absolute left-2 top-[22%] z-20 rounded-xl px-3.5 py-3"
          style={{
            background: 'rgba(6, 16, 36, 0.82)',
            border: '1px solid rgba(56,180,255,0.32)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            backdropFilter: 'blur(12px)',
            minWidth: 140,
          }}
        >
          <p className="text-[9px] font-medium tracking-[0.14em] uppercase text-sky-300/85 mb-1">
            Escaneando rostro
          </p>
          <p className="text-[24px] font-semibold text-white tabular-nums leading-none">{pct}%</p>
          <div className="mt-2 h-1 w-[112px] rounded-full overflow-hidden bg-white/10">
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg,#0369a1,#38bdf8)',
              }}
            />
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <Shield className="w-2.5 h-2.5 text-sky-400/90" />
            <span className="text-[9px] tracking-[0.1em] uppercase text-sky-100/65">
              Verificando identidad…
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 pb-0 relative z-10">
        {[
          { Icon: Shield, label: 'Seguridad', sub: 'Avanzada' },
          { Icon: Fingerprint, label: 'Biometría', sub: 'Facial' },
          { Icon: Lock, label: 'Acceso', sub: 'Protegido' },
          { Icon: Zap, label: 'Rápido', sub: 'Y eficiente' },
        ].map(({ Icon, label, sub }) => (
          <div
            key={label}
            className="rounded-xl px-1.5 py-3 text-center"
            style={{
              background: 'rgba(8, 18, 40, 0.7)',
              border: '1px solid rgba(56,180,255,0.16)',
            }}
          >
            <Icon className="w-3.5 h-3.5 mx-auto mb-1 text-sky-400/90" strokeWidth={1.75} />
            <p className="text-[9px] font-semibold tracking-[0.08em] uppercase text-sky-100/90">{label}</p>
            <p className="text-[8px] text-sky-200/40 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
