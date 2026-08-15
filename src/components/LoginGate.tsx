import { useEffect, useState } from 'react';
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
import { BiometricScanner } from '@/components/login/BiometricScanner';
import { LoginLogo } from '@/components/login/LoginLogo';
import { ThemeToggle } from '@/components/login/ThemeToggle';
import { UserSelector } from '@/components/login/UserSelector';
import { LoginMethods } from '@/components/login/LoginMethods';
import { LoginFooter } from '@/components/login/LoginFooter';
import { elyTransition } from '@/lib/motion';
import { captureError } from '@/lib/errors';
import { applyTheme, getStoredTheme, type ThemeId } from '@/lib/theme';

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
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: elyTransition.emphasized },
  exit: { opacity: 0, y: -6, transition: elyTransition.fast },
};

function PinDots({ length, max = 6 }: { length: number; max?: number }) {
  const n = Math.max(max, Math.min(12, length || max));
  return (
    <div className="flex justify-center gap-2 py-1" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full transition-all"
          style={{
            background: i < length ? '#38bdf8' : 'rgba(56,189,248,0.22)',
            transform: i < length ? 'scale(1.15)' : 'scale(1)',
          }}
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
  const [showPin, setShowPin] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [faceTick, setFaceTick] = useState(0);
  const [theme, setTheme] = useState<ThemeId>(() => getStoredTheme());
  const [scanPct, setScanPct] = useState(72);

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

  /* Porcentaje de escaneo animado en el HUD */
  useEffect(() => {
    const active = step === 'pick' || step === 'face' || step === 'face-register';
    if (!active) return;
    const id = window.setInterval(() => {
      setScanPct((p) => {
        if (step === 'face' || step === 'face-register') {
          return Math.min(99, p + (Math.random() > 0.5 ? 1 : 0));
        }
        const next = p + (Math.random() * 3 - 1.2);
        return Math.max(68, Math.min(98, next));
      });
    }, 400);
    return () => clearInterval(id);
  }, [step]);

  useEffect(() => {
    if (step === 'face' || step === 'face-register') setScanPct(45);
  }, [step]);

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
      if (!hasFaceRegistered(pendingUser.id)) setStep('face-register');
      else finishLogin(pendingUser);
    } catch (err) {
      fail(captureError(err, 'No se pudo cambiar la contraseña'));
    } finally {
      setLoading(false);
    }
  };

  const changeLater = () => {
    if (!pendingUser) return;
    deferPasswordChange(pendingUser.id);
    if (!hasFaceRegistered(pendingUser.id)) setStep('face-register');
    else finishLogin(pendingUser);
  };

  const selectedUser = selected ? getUserById(selected) : null;
  const selectedHasFace = selected ? hasFaceRegistered(selected) : false;
  void faceTick;

  const goPick = () => {
    setStep('pick');
    setPin('');
    setError('');
    setShowPin(false);
  };

  const selectUser = (u: LabUser) => {
    setSelected(u.id);
    setStep('pin');
    setPin('');
    setError('');
    setShowPin(false);
  };

  const toggleTheme = () => {
    const next: ThemeId = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyTheme(next);
  };

  const cardStyle = {
    background: 'rgba(10, 20, 42, 0.78)',
    border: '1px solid rgba(56,180,255,0.22)',
    boxShadow:
      '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02), inset 0 1px 0 rgba(255,255,255,0.04)',
    backdropFilter: 'blur(22px)',
  } as const;

  return (
    <div
      className="h-screen w-screen flex flex-col relative overflow-hidden select-none"
      style={{
        background: 'linear-gradient(150deg, #030810 0%, #071428 42%, #050d1c 100%)',
        color: '#e8f1ff',
      }}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0 opacity-[0.055]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(56,180,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(56,180,255,0.55) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
          }}
        />
        <div
          className="absolute left-0 top-0 w-[55%] h-full"
          style={{
            background:
              'radial-gradient(ellipse at 28% 48%, rgba(20,90,200,0.32) 0%, transparent 62%)',
          }}
        />
        <div
          className="absolute right-0 bottom-0 w-[40%] h-[50%]"
          style={{
            background:
              'radial-gradient(ellipse at 80% 80%, rgba(14,60,140,0.2) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Barra superior */}
      <div className="h-10 flex items-center justify-between px-3 shrink-0 drag-region relative z-30">
        <div className="flex items-center gap-2 text-[11px] pl-1 text-sky-100/40">
          <span className="font-medium text-sky-100/70">ELYRA</span>
          <span>· Acceso</span>
        </div>
        <div className="flex items-center gap-1.5 no-drag">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          {isDesktop && (
            <>
              <button type="button" onClick={() => window.elyra?.minimize?.()} className="w-8 h-8 flex items-center justify-center rounded-full text-sky-200/50 hover:bg-white/5">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => window.elyra?.maximize?.()} className="w-8 h-8 flex items-center justify-center rounded-full text-sky-200/50 hover:bg-white/5">
                <Square className="w-3 h-3" />
              </button>
              <button type="button" onClick={() => window.elyra?.close?.()} className="w-8 h-8 flex items-center justify-center rounded-full text-sky-200/50 hover:bg-red-500/20 hover:text-red-300">
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-stretch justify-center relative z-10 px-5 pb-5 pt-1 min-h-0">
        <div className="w-full max-w-[1100px] flex gap-10 items-center">
          <BiometricScanner
            progress={scanPct}
            active={step === 'pick' || step === 'face' || step === 'face-register'}
          />

          <div className="w-full max-w-[400px] mx-auto lg:mx-0 flex flex-col shrink-0">
            <LoginLogo />

            <motion.div
              className="rounded-[18px] p-5 sm:p-6 space-y-4"
              style={cardStyle}
              animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.42 }}
            >
              <AnimatePresence mode="wait">
                {step === 'pick' && (
                  <motion.div key="pick" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-[15px] font-medium text-white">
                        <Shield className="w-4 h-4 text-sky-400" />
                        Iniciar sesión
                      </div>
                      <p className="text-[12px] mt-1 text-sky-100/42">
                        Seleccione su usuario para continuar
                      </p>
                    </div>

                    <UserSelector users={users} selectedId={selected} onSelect={selectUser} />

                    <LoginMethods
                      onPin={() => {
                        if (users[0]) selectUser(users[0]);
                      }}
                    />

                    <p className="text-[11px] text-center text-sky-100/32 flex items-center justify-center gap-1.5 pt-0.5">
                      <Lock className="w-3 h-3" /> Acceso local · Solo en este equipo
                    </p>
                  </motion.div>
                )}

                {step === 'pin' && selectedUser && (
                  <motion.div key="pin" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={goPick} className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 text-sky-100/55 hover:bg-white/10">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold bg-sky-500/25 text-sky-300">
                        {selectedUser.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">{selectedUser.displayName}</p>
                        <p className="text-[11px] text-sky-100/42">{selectedUser.roleLabel}</p>
                      </div>
                    </div>

                    {selectedHasFace && (
                      <button
                        type="button"
                        onClick={() => { setError(''); setStep('face'); }}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white"
                        style={{
                          background: 'linear-gradient(90deg,#0c5ebd,#38bdf8)',
                          boxShadow: '0 0 28px rgba(56,180,255,0.35)',
                        }}
                      >
                        <ScanFace className="w-4 h-4" /> Entrar con el rostro
                      </button>
                    )}

                    {selectedHasFace && (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-[11px] text-sky-100/32">o contraseña</span>
                        <div className="flex-1 h-px bg-white/10" />
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs text-sky-100/45 flex items-center gap-1.5">
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
                          className="w-full rounded-xl px-4 py-3.5 pr-12 text-center text-lg outline-none tracking-[0.35em] bg-white/5 border text-white"
                          style={{ borderColor: error ? 'rgba(248,81,73,0.55)' : 'rgba(56,180,255,0.22)' }}
                          placeholder="······"
                          autoFocus={!selectedHasFace}
                        />
                        <button type="button" onClick={() => setShowPin((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-sky-100/35" tabIndex={-1}>
                          {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <PinDots length={pin.length} />
                      <p className="text-[11px] text-center text-sky-100/32">Primera vez: use 123456</p>
                    </div>

                    {error && (
                      <p role="alert" className="text-[13px] rounded-xl px-3 py-2.5 text-center text-red-300 bg-red-500/10 border border-red-400/20">
                        {error}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={submitPin}
                      disabled={loading || pin.length < 4}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium disabled:opacity-40 text-white"
                      style={{
                        background: selectedHasFace
                          ? 'rgba(255,255,255,0.06)'
                          : 'linear-gradient(90deg,#0c5ebd,#38bdf8)',
                        border: selectedHasFace ? '1px solid rgba(255,255,255,0.1)' : undefined,
                      }}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Acceder <ArrowRight className="w-4 h-4" /></>}
                    </button>
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
                  <motion.div key="face-register" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-2">
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
                    <p className="text-[11px] text-center text-sky-100/32">
                      Cancelar omite el registro facial y entra con contraseña.
                    </p>
                  </motion.div>
                )}

                {step === 'change' && pendingUser && (
                  <motion.div key="change" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <KeyRound className="w-4 h-4 text-sky-400" />
                      Cambiar contraseña
                    </div>
                    <p className="text-[13px] text-sky-100/50">
                      Hola <strong className="text-white">{pendingUser.displayName}</strong>. Cambie la contraseña temporal.
                    </p>
                    <input
                      type={showNew ? 'text' : 'password'}
                      inputMode="numeric"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      className="w-full rounded-xl px-4 py-3 text-center tracking-[0.3em] bg-white/5 border border-sky-400/20 text-white outline-none"
                      placeholder="Nueva ····"
                      autoFocus
                    />
                    <input
                      type={showNew ? 'text' : 'password'}
                      inputMode="numeric"
                      value={newPin2}
                      onChange={(e) => setNewPin2(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      onKeyDown={(e) => e.key === 'Enter' && !loading && submitChange()}
                      className="w-full rounded-xl px-4 py-3 text-center tracking-[0.3em] bg-white/5 border border-sky-400/20 text-white outline-none"
                      placeholder="Confirmar ····"
                    />
                    <button type="button" onClick={() => setShowNew((v) => !v)} className="text-[11px] text-sky-300/55">
                      {showNew ? 'Ocultar' : 'Mostrar'} dígitos
                    </button>
                    {error && (
                      <p role="alert" className="text-[13px] rounded-xl px-3 py-2 text-center text-red-300 bg-red-500/10 border border-red-400/20">{error}</p>
                    )}
                    <button type="button" onClick={submitChange} disabled={loading} className="w-full py-3 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: 'linear-gradient(90deg,#0c5ebd,#38bdf8)' }}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Guardar y continuar'}
                    </button>
                    <button type="button" onClick={changeLater} className="w-full py-2.5 rounded-xl text-sm text-sky-100/45 border border-white/10">
                      Cambiar en otro momento
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <LoginFooter />
          </div>
        </div>
      </div>
    </div>
  );
}
