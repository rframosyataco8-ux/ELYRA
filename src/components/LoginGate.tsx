import { useEffect, useState } from 'react';
import { Loader2, Shield, Lock, User, Cpu } from 'lucide-react';

const AUTH_KEY = 'elyra_auth_v1';
const SESSION_KEY = 'elyra_session_v1';

type AuthStore = {
  operator: string;
  pinHash: string;
  createdAt: string;
};

function simpleHash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return 'h' + Math.abs(h).toString(16) + s.length.toString(16);
}

function loadAuth(): AuthStore | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthStore;
  } catch {
    return null;
  }
}

function saveAuth(operator: string, pin: string) {
  const data: AuthStore = {
    operator: operator.trim() || 'Operador',
    pinHash: simpleHash(pin),
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(data));
  return data;
}

function hasValidSession() {
  try {
    const s = sessionStorage.getItem(SESSION_KEY);
    if (!s) return false;
    const parsed = JSON.parse(s);
    return !!parsed?.ok && Date.now() - (parsed.at || 0) < 12 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function openSession(operator: string) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ok: true, operator, at: Date.now() }));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

interface LoginGateProps {
  onAuthenticated: (operator: string) => void;
}

export function LoginGate({ onAuthenticated }: LoginGateProps) {
  const existing = loadAuth();
  const [mode, setMode] = useState<'login' | 'setup'>(existing ? 'login' : 'setup');
  const [operator, setOperator] = useState(existing?.operator || 'Fabricio');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootLine, setBootLine] = useState(0);
  const [now, setNow] = useState(new Date());
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (hasValidSession()) {
      try {
        const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
        onAuthenticated(s.operator || existing?.operator || 'Operador');
      } catch {
        onAuthenticated(existing?.operator || 'Operador');
      }
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setBootLine((n) => (n + 1) % 5), 1000);
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(id);
      clearInterval(t);
    };
  }, []);

  const statusLines = [
    'Inicializando núcleo holográfico',
    'Verificando módulos de control',
    'Canal de voz en línea',
    'Cifrado local activo',
    'Esperando autenticación',
  ];

  const submit = async () => {
    setError('');
    if (pin.length < 4) {
      setError('Mínimo 4 dígitos');
      setShake(true);
      setTimeout(() => setShake(false), 450);
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 480));

    if (mode === 'setup') {
      if (pin !== pin2) {
        setError('Los códigos no coinciden');
        setLoading(false);
        setShake(true);
        setTimeout(() => setShake(false), 450);
        return;
      }
      const auth = saveAuth(operator, pin);
      openSession(auth.operator);
      onAuthenticated(auth.operator);
      setLoading(false);
      return;
    }

    const auth = loadAuth();
    if (!auth || auth.pinHash !== simpleHash(pin)) {
      setError('Código incorrecto');
      setLoading(false);
      setPin('');
      setShake(true);
      setTimeout(() => setShake(false), 450);
      return;
    }
    openSession(auth.operator);
    onAuthenticated(auth.operator);
    setLoading(false);
  };

  const pinDots = Math.max(4, Math.min(8, pin.length || 4));

  return (
    <div className="h-screen w-screen bg-[#02060e] text-sky-100 flex items-center justify-center relative overflow-hidden select-none">
      {/* Fondo */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-30%] left-[-20%] w-[60%] h-[60%] rounded-full bg-sky-600/[0.08] blur-[160px]" />
        <div className="absolute bottom-[-25%] right-[-15%] w-[50%] h-[50%] rounded-full bg-cyan-600/[0.07] blur-[140px]" />
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[40%] h-[40%] rounded-full bg-violet-700/[0.06] blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(56,189,248,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.35) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        {/* Línea de barrido */}
        <div
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent"
          style={{ animation: 'elyraScan 4.5s ease-in-out infinite' }}
        />
      </div>

      <style>{`
        @keyframes elyraScan {
          0% { top: 8%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 92%; opacity: 0; }
        }
        @keyframes elyraOrbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes elyraPulse {
          0%, 100% { box-shadow: 0 0 40px rgba(56,189,248,0.25), inset 0 0 20px rgba(56,189,248,0.08); }
          50% { box-shadow: 0 0 70px rgba(56,189,248,0.45), inset 0 0 30px rgba(56,189,248,0.12); }
        }
        @keyframes elyraShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>

      <div className="absolute top-5 left-6 right-6 flex justify-between items-center text-[10px] text-sky-500/40 font-mono tracking-[0.18em]">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_8px_#34d399] animate-pulse" />
          ELYRA · SECURE ACCESS
        </span>
        <span>{now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      </div>

      <div className="relative z-10 w-full max-w-[400px] mx-4">
        {/* Núcleo */}
        <div className="text-center mb-9 space-y-3">
          <div className="mx-auto relative w-[88px] h-[88px] flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full border border-sky-400/20"
              style={{ animation: 'elyraOrbit 18s linear infinite' }}
            >
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_10px_#38bdf8]" />
            </div>
            <div
              className="absolute inset-2 rounded-full border border-cyan-400/15"
              style={{ animation: 'elyraOrbit 12s linear infinite reverse' }}
            >
              <span className="absolute top-1/2 -right-0.5 -translate-y-1/2 w-1 h-1 rounded-full bg-cyan-300" />
            </div>
            <div
              className="relative w-14 h-14 rounded-full border border-sky-400/40 bg-sky-500/10 flex items-center justify-center"
              style={{ animation: 'elyraPulse 2.8s ease-in-out infinite' }}
            >
              <Cpu className="w-6 h-6 text-sky-300" />
            </div>
          </div>
          <h1 className="text-[28px] font-semibold tracking-[0.32em] text-white text-glow-soft">ELYRA</h1>
          <p className="text-[10px] text-sky-400/45 tracking-[0.28em] uppercase">Sistema de asistencia de élite</p>
          <p className="text-[11px] text-sky-500/50 font-mono h-4 tracking-wide">{statusLines[bootLine]}…</p>
        </div>

        {/* Panel */}
        <div
          className={`hud-glass-strong rounded-2xl border border-sky-500/30 p-7 space-y-5 shadow-[0_0_80px_rgba(14,165,233,0.18)] ${shake ? '' : ''}`}
          style={shake ? { animation: 'elyraShake 0.4s ease' } : undefined}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sky-300/90 text-sm">
              <Shield className="w-4 h-4" />
              <span className="tracking-[0.12em]">{mode === 'setup' ? 'PRIMER ACCESO' : 'IDENTIFICACIÓN'}</span>
            </div>
            <span className="text-[10px] text-sky-500/40 font-mono">v4.2</span>
          </div>

          {mode === 'setup' && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-sky-400/50 uppercase tracking-[0.16em] flex items-center gap-1.5">
                <User className="w-3 h-3" /> Operador
              </label>
              <input
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="w-full bg-[#061018]/80 border border-sky-500/25 rounded-xl px-4 py-3 text-sm text-sky-50 outline-none focus:border-sky-400/60 focus:shadow-[0_0_24px_rgba(56,189,248,0.18)] transition-all"
                placeholder="Nombre del operador"
              />
            </div>
          )}

          {mode === 'login' && existing && (
            <div className="flex items-center gap-3 py-1">
              <div className="w-9 h-9 rounded-full border border-sky-400/30 bg-sky-500/10 flex items-center justify-center text-sky-200 text-sm font-medium">
                {(existing.operator || 'O').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-[11px] text-sky-500/50 uppercase tracking-wider">Operador</p>
                <p className="text-sm text-sky-100 font-medium">{existing.operator}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] text-sky-400/50 uppercase tracking-[0.16em] flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Código de acceso
            </label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="w-full bg-[#061018]/80 border border-sky-500/25 rounded-xl px-4 py-3.5 text-center text-xl text-sky-50 outline-none focus:border-sky-400/60 tracking-[0.5em] focus:shadow-[0_0_24px_rgba(56,189,248,0.18)] transition-all"
              placeholder="····"
              autoFocus
            />
            <div className="flex justify-center gap-2 pt-1">
              {Array.from({ length: pinDots }).map((_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    i < pin.length
                      ? 'bg-sky-400 shadow-[0_0_10px_#38bdf8] scale-110'
                      : 'bg-sky-900/80 border border-sky-600/35'
                  }`}
                />
              ))}
            </div>
          </div>

          {mode === 'setup' && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-sky-400/50 uppercase tracking-[0.16em]">Confirmar código</label>
              <input
                type="password"
                inputMode="numeric"
                value={pin2}
                onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 12))}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                className="w-full bg-[#061018]/80 border border-sky-500/25 rounded-xl px-4 py-3.5 text-center text-xl text-sky-50 outline-none focus:border-sky-400/60 tracking-[0.5em]"
                placeholder="····"
              />
            </div>
          )}

          {error && (
            <p className="text-[12px] text-red-300/95 bg-red-500/10 border border-red-400/25 rounded-xl px-3 py-2.5 text-center">
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-sky-500/35 to-cyan-500/25 border border-sky-400/50 text-sky-50 text-sm font-medium hover:from-sky-500/45 hover:to-cyan-500/35 transition-all disabled:opacity-50 shadow-[0_0_32px_rgba(56,189,248,0.28)] tracking-[0.14em] uppercase"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'setup' ? 'Activar sistema' : 'Acceder'}
          </button>

          {mode === 'login' && (
            <button
              type="button"
              onClick={() => {
                setMode('setup');
                setPin('');
                setPin2('');
                setError('');
              }}
              className="w-full text-[11px] text-sky-500/50 hover:text-sky-300/80 transition-colors tracking-wide"
            >
              Reconfigurar operador
            </button>
          )}
        </div>

        <p className="text-center text-[9px] text-sky-600/40 mt-8 tracking-[0.2em]">
          ACCESO LOCAL · CREDENCIALES SOLO EN ESTE EQUIPO
        </p>
      </div>
    </div>
  );
}
