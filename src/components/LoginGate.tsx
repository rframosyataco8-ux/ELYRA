import { useEffect, useState } from 'react';
import { Loader2, Shield, Lock, User } from 'lucide-react';

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

  const submit = async () => {
    setError('');
    if (pin.length < 4) {
      setError('Mínimo 4 dígitos');
      setShake(true);
      setTimeout(() => setShake(false), 450);
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));

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
    <div
      className="h-screen w-screen flex items-center justify-center relative overflow-hidden select-none"
      style={{ background: 'var(--ely-bg)', color: 'var(--ely-text)' }}
    >
      <style>{`
        @keyframes elyraShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-5px); }
          40% { transform: translateX(5px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
      `}</style>

      <div className="relative z-10 w-full max-w-[380px] mx-4">
        {/* Brand */}
        <div className="text-center mb-8 space-y-2">
          <div
            className="mx-auto w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'var(--ely-accent-soft)' }}
          >
            <svg viewBox="0 0 40 40" className="w-7 h-7">
              <circle cx="20" cy="20" r="8" fill="none" stroke="var(--ely-accent)" strokeWidth="2" />
              <circle cx="20" cy="20" r="3" fill="var(--ely-accent)" />
            </svg>
          </div>
          <h1 className="text-2xl font-medium tracking-tight" style={{ color: 'var(--ely-text)' }}>
            ELYRA
          </h1>
          <p className="text-sm" style={{ color: 'var(--ely-text-muted)' }}>
            Asistente inteligente de escritorio
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{
            background: 'var(--ely-surface)',
            border: '1px solid var(--ely-border)',
            boxShadow: 'var(--ely-shadow)',
            animation: shake ? 'elyraShake 0.4s ease' : undefined,
          }}
        >
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--ely-text)' }}>
            <Shield className="w-4 h-4" style={{ color: 'var(--ely-accent)' }} />
            <span>{mode === 'setup' ? 'Primer acceso' : 'Iniciar sesión'}</span>
          </div>

          {mode === 'setup' && (
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium flex items-center gap-1.5"
                style={{ color: 'var(--ely-text-muted)' }}
              >
                <User className="w-3 h-3" /> Operador
              </label>
              <input
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-shadow"
                style={{
                  background: 'var(--ely-input-bg)',
                  border: '1px solid var(--ely-border)',
                  color: 'var(--ely-text)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ely-accent)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px var(--ely-accent-soft)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ely-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                placeholder="Nombre del operador"
              />
            </div>
          )}

          {mode === 'login' && existing && (
            <div className="flex items-center gap-3 py-1">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium"
                style={{ background: 'var(--ely-accent-soft)', color: 'var(--ely-accent)' }}
              >
                {(existing.operator || 'O').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-[11px]" style={{ color: 'var(--ely-text-muted)' }}>
                  Operador
                </p>
                <p className="text-sm font-medium" style={{ color: 'var(--ely-text)' }}>
                  {existing.operator}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label
              className="text-xs font-medium flex items-center gap-1.5"
              style={{ color: 'var(--ely-text-muted)' }}
            >
              <Lock className="w-3 h-3" /> Código de acceso
            </label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="w-full rounded-xl px-4 py-3.5 text-center text-lg outline-none tracking-[0.4em] transition-shadow"
              style={{
                background: 'var(--ely-input-bg)',
                border: '1px solid var(--ely-border)',
                color: 'var(--ely-text)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--ely-accent)';
                e.currentTarget.style.boxShadow = '0 0 0 3px var(--ely-accent-soft)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--ely-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              placeholder="····"
              autoFocus
            />
            <div className="flex justify-center gap-2 pt-1">
              {Array.from({ length: pinDots }).map((_, i) => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full transition-all duration-150"
                  style={{
                    background: i < pin.length ? 'var(--ely-accent)' : 'var(--ely-border)',
                    transform: i < pin.length ? 'scale(1.1)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          {mode === 'setup' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--ely-text-muted)' }}>
                Confirmar código
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={pin2}
                onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 12))}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                className="w-full rounded-xl px-4 py-3.5 text-center text-lg outline-none tracking-[0.4em]"
                style={{
                  background: 'var(--ely-input-bg)',
                  border: '1px solid var(--ely-border)',
                  color: 'var(--ely-text)',
                }}
                placeholder="····"
              />
            </div>
          )}

          {error && (
            <p
              className="text-[13px] rounded-xl px-3 py-2.5 text-center"
              style={{
                color: 'var(--ely-danger)',
                background: 'rgba(248, 81, 73, 0.1)',
                border: '1px solid rgba(248, 81, 73, 0.2)',
              }}
            >
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-full text-sm font-medium transition-opacity disabled:opacity-50"
            style={{
              background: 'var(--ely-accent)',
              color: '#fff',
            }}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'setup' ? (
              'Activar sistema'
            ) : (
              'Acceder'
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
              className="w-full text-[12px] transition-colors"
              style={{ color: 'var(--ely-text-muted)' }}
            >
              Reconfigurar operador
            </button>
          )}
        </div>

        <p className="text-center text-[11px] mt-6" style={{ color: 'var(--ely-text-dim)' }}>
          Acceso local · credenciales solo en este equipo
        </p>
      </div>
    </div>
  );
}
