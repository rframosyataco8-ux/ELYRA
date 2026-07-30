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

  useEffect(() => {
    if (hasValidSession()) {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      onAuthenticated(s.operator || existing?.operator || 'Operador');
    }
  }, []);

  useEffect(() => {
    const lines = 4;
    const id = setInterval(() => setBootLine((n) => (n + 1) % lines), 900);
    return () => clearInterval(id);
  }, []);

  const statusLines = [
    'Inicializando núcleo holográfico…',
    'Verificando módulos de control…',
    'Canal de voz listo…',
    'Esperando autenticación del operador…',
  ];

  const submit = async () => {
    setError('');
    if (pin.length < 4) {
      setError('El código de acceso debe tener al menos 4 dígitos.');
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 450));

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
      setError('Código de acceso incorrecto.');
      setLoading(false);
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
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: 'linear-gradient(rgba(56,189,248,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.15) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="text-center mb-8 space-y-3">
          <div className="mx-auto w-16 h-16 rounded-full border border-sky-400/30 bg-sky-500/10 flex items-center justify-center shadow-[0_0_40px_rgba(56,189,248,0.25)]">
            <Sparkles className="w-7 h-7 text-sky-300" />
          </div>
          <h1 className="text-2xl font-semibold tracking-[0.25em] text-white text-glow-soft">ELYRA</h1>
          <p className="text-[12px] text-sky-400/55 tracking-wide uppercase">Sistema de asistencia de élite</p>
          <p className="text-[11px] text-sky-500/50 font-mono">{statusLines[bootLine]}</p>
        </div>

        <div className="hud-glass-strong rounded-2xl border border-sky-500/20 p-6 space-y-4 shadow-[0_0_60px_rgba(14,165,233,0.12)]">
          <div className="flex items-center gap-2 text-sky-300/80 text-sm">
            <Shield className="w-4 h-4" />
            <span>{mode === 'setup' ? 'Registro de operador' : 'Autenticación'}</span>
          </div>

          {mode === 'setup' && (
            <div className="space-y-1.5">
              <label className="text-[11px] text-sky-400/60 uppercase tracking-wide flex items-center gap-1.5">
                <User className="w-3 h-3" /> Nombre del operador
              </label>
              <input
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="w-full bg-sky-950/50 border border-sky-500/25 rounded-xl px-3.5 py-2.5 text-sm text-sky-100 outline-none focus:border-sky-400/50"
                placeholder="Tu nombre"
              />
            </div>
          )}

          {mode === 'login' && existing && (
            <p className="text-sm text-sky-200/80">
              Bienvenido, <span className="text-sky-300 font-medium">{existing.operator}</span>
            </p>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] text-sky-400/60 uppercase tracking-wide flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Código de acceso
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="w-full bg-sky-950/50 border border-sky-500/25 rounded-xl px-3.5 py-2.5 text-sm text-sky-100 outline-none focus:border-sky-400/50 tracking-[0.3em]"
              placeholder="••••"
              autoFocus
            />
          </div>

          {mode === 'setup' && (
            <div className="space-y-1.5">
              <label className="text-[11px] text-sky-400/60 uppercase tracking-wide">Confirmar código</label>
              <input
                type="password"
                inputMode="numeric"
                value={pin2}
                onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 12))}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                className="w-full bg-sky-950/50 border border-sky-500/25 rounded-xl px-3.5 py-2.5 text-sm text-sky-100 outline-none focus:border-sky-400/50 tracking-[0.3em]"
                placeholder="••••"
              />
            </div>
          )}

          {error && (
            <p className="text-[12px] text-red-300/90 bg-red-500/10 border border-red-400/20 rounded-xl px-3 py-2">{error}</p>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-500/25 border border-sky-400/40 text-sky-50 text-sm font-medium hover:bg-sky-500/35 transition-all disabled:opacity-50 shadow-[0_0_24px_rgba(56,189,248,0.2)]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'setup' ? 'Activar sistema' : 'Acceder al sistema'}
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
              className="w-full text-[11px] text-sky-500/60 hover:text-sky-400/80 transition-colors"
            >
              Reconfigurar operador
            </button>
          )}
        </div>

        <p className="text-center text-[10px] text-sky-600/50 mt-6 tracking-wide">
          Acceso local · El código no se envía a ningún servidor
        </p>
      </div>
    </div>
  );
}
