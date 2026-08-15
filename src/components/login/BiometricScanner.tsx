import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

interface BiometricScannerProps {
  /** 0–100 */
  progress: number;
  active?: boolean;
}

export function BiometricScanner({ progress, active = true }: BiometricScannerProps) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className="relative hidden lg:flex flex-col justify-between h-full min-h-[560px] flex-[1.15] pr-4 select-none">
      <div className="relative flex-1 flex items-center justify-center">
        {/* Glow ambiente */}
        <div
          className="absolute w-[380px] h-[380px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(40,140,255,0.35) 0%, transparent 68%)',
            filter: 'blur(28px)',
          }}
        />

        {/* Anillos HUD */}
        <div
          className="absolute w-[300px] h-[300px] rounded-full"
          style={{ border: '1px solid rgba(56,180,255,0.18)' }}
        />
        <div
          className="absolute w-[340px] h-[340px] rounded-full"
          style={{ border: '1px solid rgba(56,180,255,0.1)' }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full"
          style={{ border: '1px dashed rgba(56,180,255,0.14)' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}
        />

        {/* Malla / puntos de fondo */}
        <svg className="absolute inset-0 w-full h-full opacity-30" aria-hidden>
          {Array.from({ length: 40 }).map((_, i) => {
            const x = 40 + (i * 47) % 320;
            const y = 60 + ((i * 73) % 400);
            return (
              <circle key={i} cx={x} cy={y} r="1.2" fill="#4db8ff" opacity="0.5" />
            );
          })}
          {Array.from({ length: 18 }).map((_, i) => (
            <line
              key={`l${i}`}
              x1={50 + i * 18}
              y1={80}
              x2={90 + i * 14}
              y2={420}
              stroke="#2a8fd4"
              strokeWidth="0.4"
              opacity="0.25"
            />
          ))}
        </svg>

        {/* Perfil holográfico */}
        <svg
          viewBox="0 0 300 400"
          className="relative z-10 w-[300px] h-[400px]"
          style={{ filter: 'drop-shadow(0 0 28px rgba(56,180,255,0.45))' }}
          aria-hidden
        >
          <defs>
            <linearGradient id="elyFaceStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7dd3fc" />
              <stop offset="55%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
            <radialGradient id="elyFaceFill" cx="40%" cy="40%" r="60%">
              <stop offset="0%" stopColor="rgba(56,180,255,0.18)" />
              <stop offset="100%" stopColor="rgba(8,30,60,0.05)" />
            </radialGradient>
          </defs>

          {/* Silueta perfil */}
          <path
            d="M160 36
               C 105 42, 62 95, 58 155
               C 54 210, 68 258, 98 300
               C 115 322, 132 340, 152 352
               L 162 308
               C 145 288, 130 255, 126 210
               C 122 155, 142 105, 178 84
               C 195 74, 208 60, 208 48
               C 195 36, 178 34, 160 36 Z"
            fill="url(#elyFaceFill)"
            stroke="url(#elyFaceStroke)"
            strokeWidth="1.6"
          />

          {/* Malla facial */}
          <path d="M165 55 C 188 72, 198 105, 196 145 C 194 190, 182 230, 170 265" fill="none" stroke="#38bdf8" strokeWidth="0.7" opacity="0.45" />
          <path d="M105 125 C 128 118, 155 122, 178 138" fill="none" stroke="#7dd3fc" strokeWidth="0.65" opacity="0.4" />
          <path d="M100 175 C 130 168, 160 172, 182 188" fill="none" stroke="#7dd3fc" strokeWidth="0.65" opacity="0.35" />
          <path d="M105 225 C 132 220, 158 230, 175 248" fill="none" stroke="#7dd3fc" strokeWidth="0.65" opacity="0.3" />
          <path d="M115 270 C 138 268, 155 280, 168 295" fill="none" stroke="#38bdf8" strokeWidth="0.6" opacity="0.28" />

          {/* Nodos */}
          {[
            [120, 110], [150, 100], [175, 120],
            [110, 160], [145, 155], [175, 170],
            [115, 210], [150, 205], [170, 225],
            [125, 255], [155, 260],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="2" fill="#7dd3fc" opacity="0.85" />
          ))}

          {/* Ojo + rayo de escaneo */}
          <circle cx="155" cy="158" r="4.5" fill="#e0f2fe" opacity="0.95" />
          <circle cx="155" cy="158" r="8" fill="none" stroke="#38bdf8" strokeWidth="0.8" opacity="0.5" />
          <motion.line
            x1="155"
            y1="158"
            x2="295"
            y2="158"
            stroke="#38bdf8"
            strokeWidth="2.2"
            strokeLinecap="round"
            initial={false}
            animate={{
              opacity: active ? [0.35, 1, 0.35] : 0.4,
              strokeWidth: active ? [1.5, 2.4, 1.5] : 1.5,
            }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ filter: 'drop-shadow(0 0 6px #38bdf8)' }}
          />
        </svg>

        {/* Panel ESCANEANDO ROSTRO */}
        <div
          className="absolute left-0 top-[26%] z-20 rounded-xl px-4 py-3.5"
          style={{
            background: 'rgba(6, 16, 36, 0.82)',
            border: '1px solid rgba(56,180,255,0.4)',
            boxShadow: '0 0 28px rgba(56,180,255,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
            backdropFilter: 'blur(12px)',
            minWidth: 148,
          }}
        >
          <p className="text-[10px] font-medium tracking-[0.16em] uppercase text-sky-300/90 mb-1">
            Escaneando rostro
          </p>
          <p className="text-[28px] font-semibold text-white tabular-nums leading-none tracking-tight">
            {pct}%
          </p>
          <div className="mt-2.5 h-[5px] w-[120px] rounded-full overflow-hidden bg-white/10">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #0369a1, #38bdf8, #7dd3fc)',
                width: `${pct}%`,
              }}
              transition={{ type: 'spring', stiffness: 80, damping: 18 }}
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

      {/* 4 indicadores */}
      <div className="grid grid-cols-4 gap-2.5 pb-1">
        {[
          { label: 'Seguridad', sub: 'Avanzada', path: 'M12 3l7 3v5c0 4.5-3 8.2-7 9.5C8 19.2 5 15.5 5 11V6l7-3z' },
          { label: 'Biometría', sub: 'Facial', path: 'M12 11a3 3 0 100-6 3 3 0 000 6zm0 2c-3 0-6 1.5-6 3.5V18h12v-1.5c0-2-3-3.5-6-3.5z' },
          { label: 'Acceso', sub: 'Protegido', path: 'M17 9V7a5 5 0 00-10 0v2H5v11h14V9h-2zm-8-2a3 3 0 016 0v2H9V7z' },
          { label: 'Rápido', sub: 'Y eficiente', path: 'M13 2L4 14h7l-1 8 10-14h-7l0-6z' },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl px-2 py-3.5 text-center"
            style={{
              background: 'rgba(8, 18, 40, 0.72)',
              border: '1px solid rgba(56,180,255,0.2)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
            }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 mx-auto mb-1.5 text-sky-400" fill="currentColor">
              <path d={item.path} />
            </svg>
            <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-sky-100/95">{item.label}</p>
            <p className="text-[9px] text-sky-200/45 mt-0.5">{item.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
