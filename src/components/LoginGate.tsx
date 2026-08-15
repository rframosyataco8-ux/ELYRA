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
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.18 } },
};

function PinDots({ length, max = 6 }: { length: number; max?: number }) {
  const n = Math.max(max, Math.min(12, length || max));
  return (
    <div className="flex justify-center gap-1.5 py-1" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full transition-all duration-200"
          style={{
            background: i < length ? '#38bdf8' : 'rgba(56,189,248,0.2)',
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
  const [scanPct, setScanPct] = useState(88);

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

  /* HUD de demostración visual (no backend de escaneo continuo) */
  useEffect(() => {
    if (step !== 'pick') return;
    const id = window.setInterval(() => {
      setScanPct((p) => {
        const next = p + (Math.random() * 1.6 - 0.7);
        return Math.max(82, Math.min(98, next));
      });
    }, 900);
    return () => clearInterval(id);
  }, [step]);

  useEffect(() => {
    if (step === 'face' || step === 'face-register') setScanPct(52);
  }, [step]);

  const fail = (msg: string) => {
    setError(msg);
    setShake(true);
    window.setTimeout(() => setShake(false), 420);
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
      await new Promise((r) => setTimeout(r, 280));
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
      await new Promise((r) => setTimeout(r, 240));
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

  return (
    <div
      className="h-screen w-screen flex flex-col relative overflow-hidden select-none"
      style={{
        background: 'linear-gradient(155deg, #040a14 0%, #071428 48%, #050f1c 100%)',
        color: '#e8f1ff',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Ambiente: grid sutil + profundidad */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            opacity: 0.04,
            backgroundImage:
              'linear-gradient(rgba(56,180,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(56,180,255,0.9) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at 40% 45%, black 20%, transparent 75%)',
          }}
        />
        <div
          className="absolute left-0 top-0 w-[58%] h-full"
          style={{
            background:
              'radial-gradient(ellipse at 30% 48%, rgba(16,80,170,0.22) 0%, transparent 60%)',
          }}
        />
        <div
          className="absolute right-[8%] top-[20%] w-[28%] h-[40%]"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(20,70,150,0.08) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Title bar Electron */}
      <div className="h-9 flex items-center justify-between px-3 shrink-0 drag-region relative z-30">
        <div className="flex items-center gap-2 text-[11px] pl-1 text-sky-100/35">
          <span className="font-medium text-sky-100/65">ELYRA</span>
          <span>· Acceso</span>
        </div>
        <div className="flex items-center gap-1.5 no-drag">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          {isDesktop && (
            <>
              <button type="button" onClick={() => window.elyra?.minimize?.()} className="w-8 h-8 flex items-center justify-center rounded-full text-sky-200/45 hover:bg-white/5" aria-label="Minimizar">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => window.elyra?.maximize?.()} className="w-8 h-8 flex items-center justify-center rounded-full text-sky-200/45 hover:bg-white/5" aria-label="Maximizar">
                <Square className="w-3 h-3" />
              </button>
              <button type="button" onClick={() => window.elyra?.close?.()} className="w-8 h-8 flex items-center justify-center rounded-full text-sky-200/45 hover:bg-red-500/15 hover:text-red-300" aria-label="Cerrar">
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-stretch justify-center relative z-10 px-6 pb-4 pt-1 min-h-0">
        <div className="w-full max-w-[1180px] flex gap-8 xl:gap-12 items-center">
          {/* ~60% biometría */}
          <BiometricScanner
            progress={scanPct}
            active={step === 'pick' || step === 'face' || step === 'face-register'}
          />

          {/* ~40% acceso */}
          <div className="w-full max-w-[380px] mx-auto lg:mx-0 flex flex-col shrink-0">
            <LoginLogo />

            <motion.div
              className="rounded-[20px] px-5 py-5 space-y-3.5"
              style={{
                background: 'rgba(10, 18, 38, 0.72)',
                border: '1px solid rgba(56,180,255,0.16)',
                boxShadow:
                  '0 16px 48px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)',
                backdropFilter: 'blur(16px)',
              }}
              animate={shake ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
              transition={{ duration: 0.38 }}
            >
              <AnimatePresence mode="wait">
                {step === 'pick' && (
                  <motion.div key="pick" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-3.5">
                    <div>
                      <div className="flex items-center gap-2 text-[14px] font-medium text-white">
                        <Shield className="w-3.5 h-3.5 text-sky-400" strokeWidth={1.75} />
                        Iniciar sesión
                      </div>
                      <p className="text-[12px] mt-1 text-sky-100/40">
                        Seleccione su usuario para continuar
                      </p>
                    </div>

                    <UserSelector users={users} selectedId={selected} onSelect={selectUser} />

                    <LoginMethods
                      onPin={() => {
                        if (users[0]) selectUser(users[0]);
                      }}
                    />

                    <p className="text-[11px] text-center text-sky-100/28 flex items-center justify-center gap-1.5 pt-0.5">
                      <Lock className="w-3 h-3" strokeWidth={1.75} /> Acceso local · Solo en este equipo
                    </p>
                  </motion.div>
                )}

                {step === 'pin' && selectedUser && (
                  <motion.div key="pin" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-3.5">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={goPick} className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 text-sky-100/50 hover:bg-white/8 transition-colors" aria-label="Volver">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12.5px] font-semibold bg-sky-500/20 text-sky-300">
                        {selectedUser.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-white">{selectedUser.displayName}</p>
                        <p className="text-[11px] text-sky-100/40">{selectedUser.roleLabel}</p>
                      </div>
                    </div>

                    {selectedHasFace && (
                      <button
                        type="button"
                        onClick={() => { setError(''); setStep('face'); }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium text-white transition-opacity hover:opacity-95"
                        style={{
                          background: 'linear-gradient(90deg,#0c5ebd,#2a9ae0)',
                          boxShadow: '0 0 20px rgba(56,180,255,0.2)',
                        }}
                      >
                        <ScanFace className="w-4 h-4" /> Entrar con el rostro
                      </button>
                    )}

                    {selectedHasFace && (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-white/8" />
                        <span className="text-[10px] text-sky-100/28">o contraseña</span>
                        <div className="flex-1 h-px bg-white/8" />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[11px] text-sky-100/40 flex items-center gap-1.5">
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
                          className="w-full rounded-xl px-4 py-3 pr-11 text-center text-base outline-none tracking-[0.32em] bg-white/[0.04] border text-white transition-colors"
                          style={{ borderColor: error ? 'rgba(248,81,73,0.45)' : 'rgba(56,180,255,0.16)' }}
                          placeholder="······"
                          autoFocus={!selectedHasFace}
                        />
                        <button type="button" onClick={() => setShowPin((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-sky-100/30" tabIndex={-1} aria-label={showPin ? 'Ocultar' : 'Mostrar'}>
                          {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <PinDots length={pin.length} />
                      <p className="text-[10px] text-center text-sky-100/28">Primera vez: use 123456</p>
                    </div>

                    {error && (
                      <p role="alert" className="text-[12px] rounded-xl px-3 py-2 text-center text-red-300/90 bg-red-500/10 border border-red-400/15">
                        {error}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={submitPin}
                      disabled={loading || pin.length < 4}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium disabled:opacity-40 text-white transition-opacity"
                      style={{
                        background: selectedHasFace
                          ? 'rgba(255,255,255,0.05)'
                          : 'linear-gradient(90deg,#0c5ebd,#2a9ae0)',
                        border: selectedHasFace ? '1px solid rgba(255,255,255,0.08)' : undefined,
                      }}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Acceder <ArrowRight className="w-3.5 h-3.5" /></>}
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
                    <p className="text-[10px] text-center text-sky-100/28">
                      Cancelar omite el registro facial y entra con contraseña.
                    </p>
                  </motion.div>
                )}

                {step === 'change' && pendingUser && (
                  <motion.div key="change" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-3.5">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-white">
                      <KeyRound className="w-3.5 h-3.5 text-sky-400" />
                      Cambiar contraseña
                    </div>
                    <p className="text-[12px] text-sky-100/45">
                      Hola <strong className="text-white">{pendingUser.displayName}</strong>. Cambie la contraseña temporal.
                    </p>
                    <input
                      type={showNew ? 'text' : 'password'}
                      inputMode="numeric"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      className="w-full rounded-xl px-4 py-2.5 text-center tracking-[0.28em] bg-white/[0.04] border border-sky-400/15 text-white outline-none text-[13px]"
                      placeholder="Nueva ····"
                      autoFocus
                    />
                    <input
                      type={showNew ? 'text' : 'password'}
                      inputMode="numeric"
                      value={newPin2}
                      onChange={(e) => setNewPin2(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      onKeyDown={(e) => e.key === 'Enter' && !loading && submitChange()}
                      className="w-full rounded-xl px-4 py-2.5 text-center tracking-[0.28em] bg-white/[0.04] border border-sky-400/15 text-white outline-none text-[13px]"
                      placeholder="Confirmar ····"
                    />
                    <button type="button" onClick={() => setShowNew((v) => !v)} className="text-[10px] text-sky-300/50">
                      {showNew ? 'Ocultar' : 'Mostrar'} dígitos
                    </button>
                    {error && (
                      <p role="alert" className="text-[12px] rounded-xl px-3 py-2 text-center text-red-300/90 bg-red-500/10 border border-red-400/15">{error}</p>
                    )}
                    <button type="button" onClick={submitChange} disabled={loading} className="w-full py-2.5 rounded-xl text-[13px] font-medium text-white disabled:opacity-50" style={{ background: 'linear-gradient(90deg,#0c5ebd,#2a9ae0)' }}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Guardar y continuar'}
                    </button>
                    <button type="button" onClick={changeLater} className="w-full py-2 rounded-xl text-[12px] text-sky-100/40 border border-white/8">
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
