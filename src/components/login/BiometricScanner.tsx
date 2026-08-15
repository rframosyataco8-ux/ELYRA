import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Shield, Fingerprint, Lock, Zap } from 'lucide-react';

interface BiometricScannerProps {
  progress: number;
  active?: boolean;
}

/** Punto dentro del perfil (aprox. cabeza humana de lado) */
function insideProfile(x: number, y: number): boolean {
  // Sistema normalizado en viewBox 0–300 x 0–400, centro ~150,180
  const nx = (x - 145) / 95;
  const ny = (y - 175) / 145;
  // Elipse frontal + restricción de perfil (más volumen a la izquierda)
  const ellipse = nx * nx * 1.15 + ny * ny * 0.95;
  if (ellipse > 1) return false;
  // Recorte perfil (lado derecho más hacia atrás = menos puntos)
  if (x > 195 && y < 120) return false;
  if (x > 210) return false;
  if (y < 40 || y > 340) return false;
  return true;
}

function buildMesh() {
  const nodes: { x: number; y: number }[] = [];
  const step = 14;
  for (let y = 48; y <= 330; y += step) {
    for (let x = 55; x <= 205; x += step) {
      // jitter orgánico
      const jx = x + ((y * 13) % 7) - 3;
      const jy = y + ((x * 11) % 7) - 3;
      if (insideProfile(jx, jy)) nodes.push({ x: jx, y: jy });
    }
  }

  // Contorno más denso
  for (let t = 0; t < Math.PI * 2; t += 0.12) {
    const rx = 88 + Math.sin(t * 2) * 6;
    const ry = 130 + Math.cos(t * 3) * 8;
    const x = 145 + Math.cos(t) * rx * (t > 1.2 && t < 4.5 ? 0.85 : 1);
    const y = 175 + Math.sin(t) * ry;
    if (x > 50 && x < 215 && y > 40 && y < 345) nodes.push({ x, y });
  }

  const edges: [number, number][] = [];
  const maxDist = 22;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const d = Math.hypot(dx, dy);
      if (d > 6 && d < maxDist) edges.push([i, j]);
    }
  }
  // limitar aristas por rendimiento visual
  const limited = edges.length > 900 ? edges.filter((_, i) => i % 2 === 0) : edges;
  return { nodes, edges: limited };
}

const MESH = buildMesh();

export function BiometricScanner({ progress, active = true }: BiometricScannerProps) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));

  const scanY = useMemo(() => 80 + (pct / 100) * 220, [pct]);

  return (
    <div className="relative hidden lg:flex flex-col justify-between h-full min-h-[580px] flex-[1.2] pr-2 select-none">
      {/* Profundidad tipo laboratorio */}
      <div
        className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 35% 45%, rgba(20,90,180,0.22) 0%, transparent 55%), linear-gradient(160deg, rgba(4,12,28,0.2) 0%, rgba(2,8,20,0.85) 100%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(56,180,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(56,180,255,0.4) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        />
        {/* Bokeh lab sutil */}
        <div className="absolute bottom-16 left-10 w-24 h-24 rounded-full opacity-20 blur-2xl bg-sky-500" />
        <div className="absolute top-20 right-16 w-32 h-32 rounded-full opacity-10 blur-3xl bg-blue-400" />
      </div>

      <div className="relative flex-1 flex items-center justify-center z-10">
        <div
          className="absolute w-[420px] h-[420px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(40,140,255,0.4) 0%, transparent 65%)',
            filter: 'blur(32px)',
          }}
        />

        <div className="absolute w-[280px] h-[280px] rounded-full border border-sky-400/20" />
        <div className="absolute w-[330px] h-[330px] rounded-full border border-sky-400/10" />
        <motion.div
          className="absolute w-[390px] h-[390px] rounded-full border border-dashed border-sky-400/15"
          animate={{ rotate: 360 }}
          transition={{ duration: 50, repeat: Infinity, ease: 'linear' }}
        />

        {/* Malla facial densa */}
        <svg
          viewBox="0 0 300 400"
          className="relative z-10 w-[320px] h-[420px]"
          style={{ filter: 'drop-shadow(0 0 24px rgba(56,180,255,0.5))' }}
          aria-hidden
        >
          <defs>
            <linearGradient id="meshStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.55" />
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
              strokeWidth="0.55"
              opacity="0.55"
            />
          ))}

          {MESH.nodes.map((n, i) => (
            <circle
              key={`n${i}`}
              cx={n.x}
              cy={n.y}
              r={i % 5 === 0 ? 1.8 : 1.1}
              fill="#7dd3fc"
              opacity={i % 5 === 0 ? 0.95 : 0.55}
            />
          ))}

          {/* Contorno perfil reforzado */}
          <path
            d="M155 42
               C 100 48, 58 100, 54 160
               C 50 215, 66 265, 98 308
               C 118 332, 138 348, 158 358
               L 168 312
               C 148 290, 132 255, 128 210
               C 124 155, 145 105, 182 84
               C 200 72, 214 58, 212 46
               C 198 36, 175 38, 155 42 Z"
            fill="rgba(56,180,255,0.06)"
            stroke="#38bdf8"
            strokeWidth="1.4"
            opacity="0.85"
          />

          {/* Ojo + rayo */}
          <circle cx="152" cy="160" r="5" fill="#e0f2fe" />
          <circle cx="152" cy="160" r="9" fill="none" stroke="#38bdf8" strokeWidth="0.9" opacity="0.6" />
          <motion.line
            x1="152"
            y1="160"
            x2="298"
            y2="160"
            stroke="#38bdf8"
            strokeWidth="2.4"
            strokeLinecap="round"
            animate={{
              opacity: active ? [0.4, 1, 0.4] : 0.5,
            }}
            transition={{ duration: 1.7, repeat: Infinity }}
            style={{ filter: 'drop-shadow(0 0 8px #38bdf8)' }}
          />

          {/* Línea de barrido vertical sutil */}
          <motion.line
            x1="70"
            x2="210"
            y1={scanY}
            y2={scanY}
            stroke="#7dd3fc"
            strokeWidth="1"
            opacity="0.35"
          />
        </svg>

        {/* Panel % */}
        <div
          className="absolute left-1 top-[24%] z-20 rounded-xl px-4 py-3.5"
          style={{
            background: 'rgba(6, 16, 36, 0.88)',
            border: '1px solid rgba(56,180,255,0.45)',
            boxShadow: '0 0 32px rgba(56,180,255,0.2)',
            backdropFilter: 'blur(14px)',
            minWidth: 152,
          }}
        >
          <p className="text-[10px] font-medium tracking-[0.16em] uppercase text-sky-300/90 mb-1">
            Escaneando rostro
          </p>
          <p className="text-[28px] font-semibold text-white tabular-nums leading-none">{pct}%</p>
          <div className="mt-2.5 h-[5px] w-[124px] rounded-full overflow-hidden bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg,#0369a1,#38bdf8,#7dd3fc)',
              }}
            />
          </div>
          <div className="flex items-center gap-1.5 mt-2.5">
            <Shield className="w-3 h-3 text-sky-400" />
            <span className="text-[10px] tracking-[0.12em] uppercase text-sky-100/75">
              Verificando identidad…
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2.5 pb-1 relative z-10">
        {[
          { Icon: Shield, label: 'Seguridad', sub: 'Avanzada' },
          { Icon: Fingerprint, label: 'Biometría', sub: 'Facial' },
          { Icon: Lock, label: 'Acceso', sub: 'Protegido' },
          { Icon: Zap, label: 'Rápido', sub: 'Y eficiente' },
        ].map(({ Icon, label, sub }) => (
          <div
            key={label}
            className="rounded-xl px-2 py-3.5 text-center"
            style={{
              background: 'rgba(8, 18, 40, 0.78)',
              border: '1px solid rgba(56,180,255,0.22)',
            }}
          >
            <Icon className="w-4 h-4 mx-auto mb-1.5 text-sky-400" />
            <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-sky-100/95">{label}</p>
            <p className="text-[9px] text-sky-200/45 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
