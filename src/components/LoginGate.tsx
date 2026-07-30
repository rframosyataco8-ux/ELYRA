import { useEffect, useState } from 'react';
import { Loader2, Shield, Lock, User, Sparkles } from 'lucide-react';

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

  useEffect(() => {
    if (hasValidSession()) {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      onAuthenticated(s.operator || existing?.operator || 'Operador');
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setBootLine((n) => (n + 1) % 4), 1100);
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(id);
      clearInterval(t);
    };
  }, []);

  const statusLines = [
    'Núcleo cognitivo en línea',
    'Módulos de control verificados',
    'Canal de voz listo',
    'Autenticación requerida',
  ];

  const submit = async () => {
    setError('');
    if (pin.length < 4) {
      setError('Mínimo 4 dígitos.');
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 520));

    if (mode === 'setup') {
      if (pin !== pin2) {
        setError('Los códigos no coinciden.');
        setLoading(false);
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
      setError('Código incorrecto.');
      setLoading(false);
      setPin('');
      return;
    }
    openSession(auth.operator);
    onAuthenticated(auth.operator);
    setLoading(false);
  };

  return (
    <div className="h-screen w-screen bg-[#030810] text-sky-100 flex items-center justify-center relative overflow-hidden select-none">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-25%] left-[-15%] w-[55%] h-[55%] rounded-full bg-sky-600/10 blur-[140px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[45%] h-[45%] rounded-full bg-violet-600/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(56,189,248,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.2) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
      </div>

      <div className="absolute top-5 left-6 right-6 flex justify-between text-[11px] text-sky-500/45 font-mono tracking-wide">
        <span>ELYRA · SECURE ACCESS</span>
        <span>
          {now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>

      <div className="relative z-10 w-full max-w-[420px] mx-4">
        <div className="text-center mb-8 space-y-3">
          <div className="mx-auto w-[72px] h-[72px] rounded-full border border-sky-400/35 bg-sky-500/10 flex items-center justify-center shadow-[0_0_50px_rgba(56,189,248,0.3)] relative">
            <div className="absolute inset-0 rounded-full border border-sky-400/20 animate-pulse" />
            <Sparkles className="w-8 h-8 text-sky-300" />
          </div>
          <h1 className="text-[26px] font-semibold tracking-[0.28em] text-white text-glow-soft">ELYRA</h1>
          <p className="text-[11px] text-sky-400/50 tracking-[0.22em] uppercase">Asistente de élite</p>
          <p className="text-[11px] text-sky-500/45 font-mono h-4">{statusLines[bootLine]}</p>
        </div>

        <div className="hud-glass-strong rounded-2xl border border-sky-500/25 p-7 space-y-5 shadow-[0_0_80px_rgba(14,165,233,0.15)]">
          <div className="flex items-center gap-2 text-sky-300/85 text-sm">
            <Shield className="w-4 h-4" />
            <span className="tracking-wide">{mode === 'setup' ? 'Primer acceso' : 'Identificación'}</span>
          </div>

          {mode === 'setup' && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-sky-400/55 uppercase tracking-[0.15em] flex items-center gap-1.5">
                <User className="w-3 h-3" /> Operador
              </label>
              <input
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="w-full bg-sky-950/60 border border-sky-500/25 rounded-xl px-4 py-3 text-sm text-sky-100 outline-none focus:border-sky-400/55 focus:shadow-[0_0_20px_rgba(56,189,248,0.15)] transition-all"
                placeholder="Nombre"
              />
            </div>
          )}

          {mode === 'login' && existing && (
            <p className="text-sm text-sky-200/90">
              Operador <span className="text-sky-100 font-medium">{existing.operator}</span>
            </p>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] text-sky-400/55 uppercase tracking-[0.15em] flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Código de acceso
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="w-full bg-sky-950/60 border border-sky-500/25 rounded-xl px-4 py-3 text-center text-lg text-sky-100 outline-none focus:border-sky-400/55 tracking-[0.45em] focus:shadow-[0_0_20px_rgba(56,189,248,0.15)] transition-all"
              placeholder="····"
              autoFocus
            />
            <div className="flex justify-center gap-1.5 pt-1">
              {Array.from({ length: Math.max(4, pin.length || 4) }).map((_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i < pin.length ? 'bg-sky-400 shadow-[0_0_8px_#38bdf8]' : 'bg-sky-800 border border-sky-600/40'
                  }`}
                />
              ))}
            </div>
          </div>

          {mode === 'setup' && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-sky-400/55 uppercase tracking-[0.15em]">Confirmar código</label>
              <input
                type="password"
                inputMode="numeric"
                value={pin2}
                onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 12))}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                className="w-full bg-sky-950/60 border border-sky-500/25 rounded-xl px-4 py-3 text-center text-lg text-sky-100 outline-none focus:border-sky-400/55 tracking-[0.45em]"
                placeholder="····"
              />
            </div>
          )}

          {error && (
            <p className="text-[12px] text-red-300/90 bg-red-500/10 border border-red-400/20 rounded-xl px-3 py-2 text-center">
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-sky-500/30 border border-sky-400/45 text-sky-50 text-sm font-medium hover:bg-sky-500/40 transition-all disabled:opacity-50 shadow-[0_0_28px_rgba(56,189,248,0.25)] tracking-wide"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'setup' ? (
              'Activar sistema'
            ) : (
              'Entrar'
            )}
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
              className="w-full text-[11px] text-sky-500/55 hover:text-sky-400/80 transition-colors"
            >
              Reconfigurar operador
            </button>
          )}
        </div>

        <p className="text-center text-[10px] text-sky-600/45 mt-7 tracking-[0.12em]">
          ACCESO LOCAL · CREDENCIALES SOLO EN ESTE EQUIPO
        </p>
      </div>
    </div>
  );
}
