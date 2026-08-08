import { useEffect, useState } from 'react';
import { Loader2, Shield, Lock, KeyRound, Minus, Square, X } from 'lucide-react';
import {
  listActiveUsers,
  type LabUser,
  type UserId,
  ensureDefaultPasswords,
  verifyPassword,
  mustChangePassword,
  setPassword,
  deferPasswordChange,
  openSession,
  clearSession,
  getSession,
  getUserById,
} from '@/lib/users';

const isDesktop = typeof window !== 'undefined' && !!window.elyra?.isDesktop;

export { clearSession };

export type AuthPayload = {
  user: LabUser;
  operator: string;
};

interface LoginGateProps {
  onAuthenticated: (payload: AuthPayload) => void;
}

export function LoginGate({ onAuthenticated }: LoginGateProps) {
  const [users, setUsers] = useState<LabUser[]>(() => {
    try {
      ensureDefaultPasswords();
      return listActiveUsers();
    } catch {
      return [];
    }
  });
  const [selected, setSelected] = useState<UserId | null>(null);
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPin2, setNewPin2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [step, setStep] = useState<'pick' | 'pin' | 'change'>('pick');
  const [pendingUser, setPendingUser] = useState<LabUser | null>(null);

  useEffect(() => {
    ensureDefaultPasswords();
    setUsers(listActiveUsers());
    const session = getSession();
    if (session) {
      const user = getUserById(session.userId);
      if (user && user.active !== false) {
        if (mustChangePassword(user.id)) {
          setPendingUser(user);
          setStep('change');
          return;
        }
        onAuthenticated({ user, operator: user.displayName });
      }
    }
  }, []);

  const fail = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 450);
  };

  const finishLogin = (user: LabUser) => {
    openSession(user);
    onAuthenticated({ user, operator: user.displayName });
  };

  const submitPin = async () => {
    setError('');
    if (!selected) return;
    if (pin.length < 4) {
      fail('Mínimo 4 dígitos');
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 350));
    const user = getUserById(selected);
    if (!user || user.active === false || !verifyPassword(user.id, pin)) {
      fail('Contraseña incorrecta');
      setPin('');
      setLoading(false);
      return;
    }
    setLoading(false);
    if (mustChangePassword(user.id)) {
      setPendingUser(user);
      setStep('change');
      setPin('');
      return;
    }
    finishLogin(user);
  };

  const submitChange = async () => {
    setError('');
    if (!pendingUser) return;
    if (newPin.length < 4) {
      fail('Mínimo 4 dígitos');
      return;
    }
    if (newPin === '123456') {
      fail('Elija una contraseña distinta a la temporal');
      return;
    }
    if (newPin !== newPin2) {
      fail('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 300));
    setPassword(pendingUser.id, newPin, true);
    setLoading(false);
    finishLogin(pendingUser);
  };

  const changeLater = () => {
    if (!pendingUser) return;
    deferPasswordChange(pendingUser.id);
    finishLogin(pendingUser);
  };

  const selectedUser = selected ? getUserById(selected) : null;

  return (
    <div
      className="h-screen w-screen flex flex-col relative overflow-hidden select-none"
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

      <div
        className="h-10 flex items-center justify-between px-3 shrink-0 drag-region"
        style={{ borderBottom: '1px solid var(--ely-header-border)', background: 'var(--ely-bg-elevated)' }}
      >
        <div className="flex items-center gap-2 text-[12px] pl-1" style={{ color: 'var(--ely-text-muted)' }}>
          <span className="font-medium" style={{ color: 'var(--ely-text)' }}>ELYRA</span>
          <span>· Acceso al sistema</span>
        </div>
        {isDesktop && (
          <div className="flex items-center gap-0.5 no-drag">
            <button type="button" onClick={() => window.elyra?.minimize?.()} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ color: 'var(--ely-text-muted)' }}>
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => window.elyra?.maximize?.()} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ color: 'var(--ely-text-muted)' }}>
              <Square className="w-3 h-3" />
            </button>
            <button type="button" onClick={() => window.elyra?.close?.()} className="w-8 h-8 flex items-center justify-center rounded-full hover:text-red-400" style={{ color: 'var(--ely-text-muted)' }}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center overflow-auto py-8 px-4">
        <div className="relative z-10 w-full max-w-[420px]">
          <div className="text-center mb-7 space-y-2">
            <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'var(--ely-accent-soft)' }}>
              <svg viewBox="0 0 40 40" className="w-7 h-7">
                <circle cx="20" cy="20" r="8" fill="none" stroke="var(--ely-accent)" strokeWidth="2" />
                <circle cx="20" cy="20" r="3" fill="var(--ely-accent)" />
              </svg>
            </div>
            <h1 className="text-2xl font-medium tracking-tight" style={{ color: 'var(--ely-text)' }}>ELYRA</h1>
            <p className="text-sm" style={{ color: 'var(--ely-text-muted)' }}>Laboratorio · Acceso por usuario</p>
          </div>

          <div
            className="rounded-2xl p-6 space-y-5"
            style={{
              background: 'var(--ely-surface)',
              border: '1px solid var(--ely-border)',
              boxShadow: 'var(--ely-shadow)',
              animation: shake ? 'elyraShake 0.4s ease' : undefined,
            }}
          >
            {step === 'pick' && (
              <>
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--ely-text)' }}>
                  <Shield className="w-4 h-4" style={{ color: 'var(--ely-accent)' }} />
                  <span>Seleccione su usuario</span>
                </div>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {users.length === 0 && (
                    <p className="text-sm text-center py-4" style={{ color: 'var(--ely-text-muted)' }}>
                      No hay usuarios activos.
                    </p>
                  )}
                  {users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setSelected(u.id);
                        setStep('pin');
                        setPin('');
                        setError('');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors"
                      style={{ border: '1px solid var(--ely-border)', background: 'var(--ely-bg-soft)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--ely-accent)';
                        e.currentTarget.style.background = 'var(--ely-accent-soft)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--ely-border)';
                        e.currentTarget.style.background = 'var(--ely-bg-soft)';
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                        style={{ background: 'var(--ely-accent-soft)', color: 'var(--ely-accent)' }}
                      >
                        {u.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--ely-text)' }}>{u.displayName}</p>
                        <p className="text-[11px] truncate" style={{ color: 'var(--ely-text-muted)' }}>{u.roleLabel}</p>
                      </div>
                      {u.isAdmin && (
                        <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ background: 'var(--ely-accent-soft)', color: 'var(--ely-accent)' }}>
                          Admin
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 'pin' && selectedUser && (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: 'var(--ely-accent-soft)', color: 'var(--ely-accent)' }}>
                    {selectedUser.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--ely-text)' }}>{selectedUser.displayName}</p>
                    <p className="text-[11px]" style={{ color: 'var(--ely-text-muted)' }}>{selectedUser.roleLabel}</p>
                  </div>
                  <button type="button" onClick={() => { setStep('pick'); setPin(''); setError(''); }} className="text-[12px]" style={{ color: 'var(--ely-accent)' }}>
                    Cambiar
                  </button>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--ely-text-muted)' }}>
                    <Lock className="w-3 h-3" /> Contraseña
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    onKeyDown={(e) => e.key === 'Enter' && submitPin()}
                    className="w-full rounded-xl px-4 py-3.5 text-center text-lg outline-none tracking-[0.35em]"
                    style={{ background: 'var(--ely-input-bg)', border: '1px solid var(--ely-border)', color: 'var(--ely-text)' }}
                    placeholder="······"
                    autoFocus
                  />
                  <p className="text-[11px] text-center" style={{ color: 'var(--ely-text-dim)' }}>Primera vez: use 123456</p>
                </div>
                {error && (
                  <p className="text-[13px] rounded-xl px-3 py-2.5 text-center" style={{ color: 'var(--ely-danger)', background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.2)' }}>
                    {error}
                  </p>
                )}
                <button type="button" onClick={submitPin} disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 rounded-full text-sm font-medium disabled:opacity-50" style={{ background: 'var(--ely-accent)', color: '#fff' }}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Acceder'}
                </button>
              </>
            )}

            {step === 'change' && pendingUser && (
              <>
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--ely-text)' }}>
                  <KeyRound className="w-4 h-4" style={{ color: 'var(--ely-accent)' }} />
                  <span>Cambiar contraseña</span>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ely-text-muted)' }}>
                  Hola <strong style={{ color: 'var(--ely-text)' }}>{pendingUser.displayName}</strong>.
                  Por seguridad debe cambiar la contraseña temporal (123456).
                </p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" style={{ color: 'var(--ely-text-muted)' }}>Nueva contraseña</label>
                    <input type="password" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 12))} className="w-full rounded-xl px-4 py-3 text-center text-base outline-none tracking-[0.3em]" style={{ background: 'var(--ely-input-bg)', border: '1px solid var(--ely-border)', color: 'var(--ely-text)' }} placeholder="····" autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" style={{ color: 'var(--ely-text-muted)' }}>Confirmar</label>
                    <input type="password" inputMode="numeric" value={newPin2} onChange={(e) => setNewPin2(e.target.value.replace(/\D/g, '').slice(0, 12))} onKeyDown={(e) => e.key === 'Enter' && submitChange()} className="w-full rounded-xl px-4 py-3 text-center text-base outline-none tracking-[0.3em]" style={{ background: 'var(--ely-input-bg)', border: '1px solid var(--ely-border)', color: 'var(--ely-text)' }} placeholder="····" />
                  </div>
                </div>
                {error && (
                  <p className="text-[13px] rounded-xl px-3 py-2.5 text-center" style={{ color: 'var(--ely-danger)', background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.2)' }}>{error}</p>
                )}
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={submitChange} disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 rounded-full text-sm font-medium disabled:opacity-50" style={{ background: 'var(--ely-accent)', color: '#fff' }}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cambiar contraseña'}
                  </button>
                  <button type="button" onClick={changeLater} className="w-full py-2.5 rounded-full text-sm font-medium" style={{ background: 'var(--ely-bg-soft)', color: 'var(--ely-text-muted)', border: '1px solid var(--ely-border)' }}>
                    Cambiar en otro momento
                  </button>
                </div>
                <p className="text-[11px] text-center" style={{ color: 'var(--ely-text-dim)' }}>
                  Si elige «otro momento», se le pedirá de nuevo al iniciar sesión.
                </p>
              </>
            )}
          </div>

          <p className="text-center text-[11px] mt-6" style={{ color: 'var(--ely-text-dim)' }}>
            Acceso local · {users.length} usuario{users.length === 1 ? '' : 's'} activo{users.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>
    </div>
  );
}
