import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Loader2,
  Shield,
  Lock,
  KeyRound,
  Minus,
  Square,
  X,
  ChevronLeft,
  Eye,
  EyeOff,
  Search,
  ArrowRight,
  ScanFace,
} from 'lucide-react';
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
import { hasFaceRegistered } from '@/lib/faceAuth';
import { FaceAuthPanel } from '@/components/FaceAuthPanel';
import { elyTransition } from '@/lib/motion';
import { captureError } from '@/lib/errors';

const isDesktop = typeof window !== 'undefined' && !!window.elyra?.isDesktop;

export { clearSession };

export type AuthPayload = {
  user: LabUser;
  operator: string;
};

interface LoginGateProps {
  onAuthenticated: (payload: AuthPayload) => void;
}

type LoginStep = 'pick' | 'pin' | 'change' | 'face' | 'face-register';

const stepVariants = {
  initial: { opacity: 0, y: 12, filter: 'blur(4px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: elyTransition.emphasized,
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: 'blur(2px)',
    transition: elyTransition.fast,
  },
};

function PinDots({ length, max = 6 }: { length: number; max?: number }) {
  const n = Math.max(max, Math.min(12, length || max));
  return (
    <div className="flex justify-center gap-2 py-1" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full"
          initial={false}
          animate={{
            scale: i < length ? 1.15 : 1,
            background: i < length ? 'var(--ely-accent)' : 'var(--ely-border)',
          }}
          transition={elyTransition.spring}
        />
      ))}
    </div>
  );
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
  const [step, setStep] = useState<LoginStep>('pick');
  const [pendingUser, setPendingUser] = useState<LabUser | null>(null);
  const [query, setQuery] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [faceTick, setFaceTick] = useState(0);

  useEffect(() => {
    try {
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
    } catch (err) {
      console.warn('[elyra] login init', captureError(err, 'init failed'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.roleLabel.toLowerCase().includes(q),
    );
  }, [users, query]);

  const fail = (msg: string) => {
    setError(msg);
    setShake(true);
    window.setTimeout(() => setShake(false), 480);
  };

  const finishLogin = (user: LabUser) => {
    openSession(user);
    onAuthenticated({ user, operator: user.displayName });
  };

  const afterPasswordOk = (user: LabUser) => {
    if (mustChangePassword(user.id)) {
      setPendingUser(user);
      setStep('change');
      setPin('');
      return;
    }
    // Ofrecer registro facial si aún no hay plantilla
    if (!hasFaceRegistered(user.id)) {
      setPendingUser(user);
      setStep('face-register');
      setPin('');
      return;
    }
    finishLogin(user);
  };

  const submitPin = async () => {
    setError('');
    if (!selected) return;
    if (pin.length < 4) {
      fail('Mínimo 4 dígitos');
      return;
    }
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 320));
      const user = getUserById(selected);
      if (!user || user.active === false || !verifyPassword(user.id, pin)) {
        fail('Contraseña incorrecta');
        setPin('');
        return;
      }
      afterPasswordOk(user);
    } catch (err) {
      fail(captureError(err, 'No se pudo iniciar sesión'));
    } finally {
      setLoading(false);
    }
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
    try {
      await new Promise((r) => setTimeout(r, 280));
      setPassword(pendingUser.id, newPin, true);
      if (!hasFaceRegistered(pendingUser.id)) {
        setStep('face-register');
      } else {
        finishLogin(pendingUser);
      }
    } catch (err) {
      fail(captureError(err, 'No se pudo cambiar la contraseña'));
    } finally {
      setLoading(false);
    }
  };

  const changeLater = () => {
    if (!pendingUser) return;
    deferPasswordChange(pendingUser.id);
    if (!hasFaceRegistered(pendingUser.id)) {
      setStep('face-register');
    } else {
      finishLogin(pendingUser);
    }
  };

  const selectedUser = selected ? getUserById(selected) : null;
  const selectedHasFace = selected ? hasFaceRegistered(selected) : false;
  // faceTick fuerza re-lectura tras registrar
  void faceTick;

  const goPick = () => {
    setStep('pick');
    setPin('');
    setError('');
    setShowPin(false);
  };

  return (
    <div
      className="h-screen w-screen flex flex-col relative overflow-hidden select-none"
      style={{ background: 'var(--ely-bg)', color: 'var(--ely-text)' }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--ely-accent-soft) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-40 -right-20 w-[32rem] h-[32rem] rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.25) 0%, transparent 70%)' }}
        />
      </div>

      <div
        className="h-10 flex items-center justify-between px-3 shrink-0 drag-region relative z-20"
        style={{
          borderBottom: '1px solid var(--ely-header-border)',
          background: 'color-mix(in srgb, var(--ely-bg-elevated) 92%, transparent)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center gap-2 text-[12px] pl-1" style={{ color: 'var(--ely-text-muted)' }}>
          <span className="font-medium" style={{ color: 'var(--ely-text)' }}>ELYRA</span>
          <span>· Acceso al sistema</span>
        </div>
        {isDesktop && (
          <div className="flex items-center gap-0.5 no-drag">
            <button type="button" onClick={() => window.elyra?.minimize?.()} className="w-8 h-8 flex items-center justify-center rounded-full ely-icon-btn" style={{ color: 'var(--ely-text-muted)' }}>
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => window.elyra?.maximize?.()} className="w-8 h-8 flex items-center justify-center rounded-full ely-icon-btn" style={{ color: 'var(--ely-text-muted)' }}>
              <Square className="w-3 h-3" />
            </button>
            <button type="button" onClick={() => window.elyra?.close?.()} className="w-8 h-8 flex items-center justify-center rounded-full ely-icon-btn hover:text-red-400" style={{ color: 'var(--ely-text-muted)' }}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center overflow-auto py-8 px-4 relative z-10">
        <div className="w-full max-w-[440px]">
          <motion.div className="text-center mb-8 space-y-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={elyTransition.emphasized}>
            <motion.div
              className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: 'var(--ely-accent-soft)',
                border: '1px solid var(--ely-border)',
                boxShadow: '0 0 40px color-mix(in srgb, var(--ely-accent) 25%, transparent)',
              }}
              whileHover={{ scale: 1.04 }}
            >
              <svg viewBox="0 0 40 40" className="w-8 h-8">
                <circle cx="20" cy="20" r="8" fill="none" stroke="var(--ely-accent)" strokeWidth="2" />
                <circle cx="20" cy="20" r="3" fill="var(--ely-accent)" />
              </svg>
            </motion.div>
            <div>
              <h1 className="text-2xl font-medium tracking-tight" style={{ color: 'var(--ely-text)' }}>ELYRA</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--ely-text-muted)' }}>
                Laboratorio · PIN y biometría facial
              </p>
            </div>
          </motion.div>

          <motion.div
            className="rounded-3xl p-6 sm:p-7 space-y-5 relative"
            style={{
              background: 'color-mix(in srgb, var(--ely-surface) 94%, transparent)',
              border: '1px solid var(--ely-border)',
              boxShadow: 'var(--ely-shadow)',
              backdropFilter: 'blur(16px)',
            }}
            animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.42 }}
          >
            <AnimatePresence mode="wait">
              {step === 'pick' && (
                <motion.div key="pick" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--ely-text)' }}>
                    <Shield className="w-4 h-4" style={{ color: 'var(--ely-accent)' }} />
                    <span>Seleccione su usuario</span>
                  </div>
                  {users.length > 4 && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--ely-text-dim)' }} />
                      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar…" className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none ely-focus-ring" style={{ background: 'var(--ely-input-bg)', border: '1px solid var(--ely-border)', color: 'var(--ely-text)' }} />
                    </div>
                  )}
                  <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                    {filteredUsers.map((u, i) => (
                      <motion.button
                        key={u.id}
                        type="button"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03, ...elyTransition.standard }}
                        onClick={() => {
                          setSelected(u.id);
                          setStep('pin');
                          setPin('');
                          setError('');
                          setShowPin(false);
                        }}
                        className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left group"
                        style={{ border: '1px solid var(--ely-border)', background: 'var(--ely-bg-soft)' }}
                        whileHover={{ borderColor: 'var(--ely-accent)', background: 'var(--ely-accent-soft)' }}
                        whileTap={{ scale: 0.985 }}
                      >
                        <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold shrink-0" style={{ background: 'var(--ely-accent-soft)', color: 'var(--ely-accent)' }}>
                          {u.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--ely-text)' }}>{u.displayName}</p>
                          <p className="text-[11px] truncate" style={{ color: 'var(--ely-text-muted)' }}>
                            {u.roleLabel}
                            {hasFaceRegistered(u.id) ? ' · Rostro' : ''}
                          </p>
                        </div>
                        {hasFaceRegistered(u.id) && (
                          <ScanFace className="w-4 h-4 shrink-0" style={{ color: 'var(--ely-accent)' }} />
                        )}
                        {u.isAdmin && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ background: 'var(--ely-accent-soft)', color: 'var(--ely-accent)' }}>Admin</span>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 'pin' && selectedUser && (
                <motion.div key="pin" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-5">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={goPick} className="ely-icon-btn shrink-0" style={{ color: 'var(--ely-text-muted)' }} title="Volver">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: 'var(--ely-accent-soft)', color: 'var(--ely-accent)' }}>
                      {selectedUser.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--ely-text)' }}>{selectedUser.displayName}</p>
                      <p className="text-[11px]" style={{ color: 'var(--ely-text-muted)' }}>{selectedUser.roleLabel}</p>
                    </div>
                  </div>

                  {selectedHasFace && (
                    <motion.button
                      type="button"
                      onClick={() => { setError(''); setStep('face'); }}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full text-sm font-medium"
                      style={{ background: 'var(--ely-accent)', color: '#fff' }}
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <ScanFace className="w-4 h-4" /> Entrar con el rostro
                    </motion.button>
                  )}

                  {selectedHasFace && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px" style={{ background: 'var(--ely-border)' }} />
                      <span className="text-[11px]" style={{ color: 'var(--ely-text-dim)' }}>o contraseña</span>
                      <div className="flex-1 h-px" style={{ background: 'var(--ely-border)' }} />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--ely-text-muted)' }}>
                      <Lock className="w-3 h-3" /> Contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showPin ? 'text' : 'password'}
                        inputMode="numeric"
                        autoComplete="off"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
                        onKeyDown={(e) => e.key === 'Enter' && !loading && submitPin()}
                        className="w-full rounded-2xl px-4 py-3.5 pr-12 text-center text-lg outline-none tracking-[0.35em] ely-focus-ring"
                        style={{
                          background: 'var(--ely-input-bg)',
                          border: `1px solid ${error ? 'rgba(248,81,73,0.55)' : 'var(--ely-border)'}`,
                          color: 'var(--ely-text)',
                        }}
                        placeholder="······"
                        autoFocus={!selectedHasFace}
                      />
                      <button type="button" onClick={() => setShowPin((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg" style={{ color: 'var(--ely-text-dim)' }} tabIndex={-1}>
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <PinDots length={pin.length} />
                    <p className="text-[11px] text-center" style={{ color: 'var(--ely-text-dim)' }}>
                      Primera vez: use <span style={{ color: 'var(--ely-text-muted)' }}>123456</span>
                    </p>
                  </div>

                  {error && (
                    <motion.p id="login-error" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[13px] rounded-xl px-3 py-2.5 text-center" style={{ color: 'var(--ely-danger)', background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.2)' }}>
                      {error}
                    </motion.p>
                  )}

                  <motion.button type="button" onClick={submitPin} disabled={loading || pin.length < 4} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full text-sm font-medium disabled:opacity-45" style={{ background: selectedHasFace ? 'var(--ely-bg-soft)' : 'var(--ely-accent)', color: selectedHasFace ? 'var(--ely-text)' : '#fff', border: selectedHasFace ? '1px solid var(--ely-border)' : undefined }} whileTap={{ scale: 0.98 }}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Acceder con contraseña <ArrowRight className="w-4 h-4" /></>}
                  </motion.button>
                </motion.div>
              )}

              {step === 'face' && selectedUser && (
                <motion.div key="face" variants={stepVariants} initial="initial" animate="animate" exit="exit">
                  <FaceAuthPanel
                    userId={selectedUser.id}
                    userName={selectedUser.displayName}
                    mode="verify"
                    onSuccess={() => finishLogin(selectedUser)}
                    onCancel={() => { setStep('pin'); setError(''); }}
                  />
                </motion.div>
              )}

              {step === 'face-register' && pendingUser && (
                <motion.div key="face-register" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-3">
                  <FaceAuthPanel
                    userId={pendingUser.id}
                    userName={pendingUser.displayName}
                    mode="register"
                    onSuccess={() => {
                      setFaceTick((t) => t + 1);
                      finishLogin(pendingUser);
                    }}
                    onCancel={() => finishLogin(pendingUser)}
                  />
                  <p className="text-[11px] text-center" style={{ color: 'var(--ely-text-dim)' }}>
                    Cancelar omite el registro y entra solo con contraseña.
                  </p>
                </motion.div>
              )}

              {step === 'change' && pendingUser && (
                <motion.div key="change" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--ely-text)' }}>
                    <KeyRound className="w-4 h-4" style={{ color: 'var(--ely-accent)' }} />
                    <span>Cambiar contraseña</span>
                  </div>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ely-text-muted)' }}>
                    Hola <strong style={{ color: 'var(--ely-text)' }}>{pendingUser.displayName}</strong>. Cambie la contraseña temporal.
                  </p>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium" style={{ color: 'var(--ely-text-muted)' }}>Nueva contraseña</label>
                      <div className="relative">
                        <input type={showNew ? 'text' : 'password'} inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 12))} className="w-full rounded-2xl px-4 py-3 pr-12 text-center text-base outline-none tracking-[0.3em] ely-focus-ring" style={{ background: 'var(--ely-input-bg)', border: '1px solid var(--ely-border)', color: 'var(--ely-text)' }} placeholder="····" autoFocus />
                        <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5" style={{ color: 'var(--ely-text-dim)' }} tabIndex={-1}>
                          {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <PinDots length={newPin.length} max={6} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium" style={{ color: 'var(--ely-text-muted)' }}>Confirmar</label>
                      <input type={showNew ? 'text' : 'password'} inputMode="numeric" value={newPin2} onChange={(e) => setNewPin2(e.target.value.replace(/\D/g, '').slice(0, 12))} onKeyDown={(e) => e.key === 'Enter' && !loading && submitChange()} className="w-full rounded-2xl px-4 py-3 text-center text-base outline-none tracking-[0.3em] ely-focus-ring" style={{ background: 'var(--ely-input-bg)', border: '1px solid var(--ely-border)', color: 'var(--ely-text)' }} placeholder="····" />
                    </div>
                  </div>
                  {error && (
                    <p role="alert" className="text-[13px] rounded-xl px-3 py-2.5 text-center" style={{ color: 'var(--ely-danger)', background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.2)' }}>{error}</p>
                  )}
                  <div className="flex flex-col gap-2 pt-1">
                    <motion.button type="button" onClick={submitChange} disabled={loading} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full text-sm font-medium disabled:opacity-50" style={{ background: 'var(--ely-accent)', color: '#fff' }} whileTap={{ scale: 0.98 }}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar y continuar'}
                    </motion.button>
                    <button type="button" onClick={changeLater} className="w-full py-2.5 rounded-full text-sm font-medium" style={{ background: 'var(--ely-bg-soft)', color: 'var(--ely-text-muted)', border: '1px solid var(--ely-border)' }}>
                      Cambiar en otro momento
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <p className="text-center text-[11px] mt-6" style={{ color: 'var(--ely-text-dim)' }}>
            Acceso local · Rostro solo en este equipo
          </p>
        </div>
      </div>
    </div>
  );
}
