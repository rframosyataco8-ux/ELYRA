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
  Fingerprint,
  Zap,
  CreditCard,
  Sun,
  Moon,
  ChevronRight,
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
            background: i < length ? '#3b9eff' : 'rgba(59,158,255,0.25)',
            transform: i < length ? 'scale(1.15)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  );
}

/** HUD izquierdo: perfil neural + escaneo */
function LoginHeroArt({ scanning }: { scanning: boolean }) {
  return (
    <div className="relative hidden lg:flex flex-col justify-between h-full min-h-[520px] flex-1 pr-6">
      <div className="relative flex-1 flex items-center justify-center">
        {/* Halo */}
        <div
          className="absolute w-[340px] h-[340px] rounded-full opacity-30"
          style={{
            background:
              'radial-gradient(circle, rgba(59,158,255,0.45) 0%, transparent 65%)',
            filter: 'blur(20px)',
          }}
        />
        {/* Anillos */}
        <div className="absolute w-72 h-72 rounded-full border border-cyan-400/20" />
        <div className="absolute w-80 h-80 rounded-full border border-cyan-400/10" />
        <motion.div
          className="absolute w-96 h-96 rounded-full border border-cyan-400/15"
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
          style={{ borderStyle: 'dashed' }}
        />

        {/* Cabeza wireframe (SVG) */}
        <svg
          viewBox="0 0 280 360"
          className="relative w-[280px] h-[360px] drop-shadow-[0_0_30px_rgba(59,158,255,0.35)]"
          aria-hidden
        >
          <defs>
            <linearGradient id="faceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5cc8ff" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#1a6fd4" stopOpacity="0.7" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Perfil simplificado con malla */}
          <path
            d="M150 40 C 95 45 55 100 52 160 C 50 210 65 255 95 295 C 110 315 125 330 145 340 L 155 300 C 140 280 125 250 122 210 C 118 160 135 110 170 90 C 185 82 195 70 195 55 C 185 42 168 38 150 40 Z"
            fill="none"
            stroke="url(#faceGrad)"
            strokeWidth="1.5"
            filter="url(#glow)"
          />
          <path
            d="M155 55 C 175 70 185 100 182 140 C 180 180 170 220 160 250"
            fill="none"
            stroke="#3b9eff"
            strokeWidth="0.8"
            opacity="0.5"
          />
          <path
            d="M100 120 C 120 115 145 118 165 130"
            fill="none"
            stroke="#5cc8ff"
            strokeWidth="0.7"
            opacity="0.4"
          />
          <path
            d="M95 170 C 120 165 150 168 170 180"
            fill="none"
            stroke="#5cc8ff"
            strokeWidth="0.7"
            opacity="0.35"
          />
          <path
            d="M100 220 C 125 218 150 225 165 240"
            fill="none"
            stroke="#5cc8ff"
            strokeWidth="0.7"
            opacity="0.3"
          />
          {/* Ojo / láser */}
          <circle cx="145" cy="155" r="4" fill="#7dd3fc" filter="url(#glow)" />
          <motion.line
            x1="145"
            y1="155"
            x2="270"
            y2="155"
            stroke="#3b9eff"
            strokeWidth="2"
            opacity="0.85"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1, opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2.2, repeat: Infinity }}
          />
          {/* Puntos de malla */}
          {[80, 110, 140, 170, 200, 230].map((y, i) => (
            <circle
              key={y}
              cx={90 + (i % 3) * 25}
              cy={y}
              r="1.5"
              fill="#5cc8ff"
              opacity="0.6"
            />
          ))}
        </svg>

        {/* Tarjeta de escaneo */}
        <motion.div
          className="absolute left-2 top-[28%] rounded-xl px-3.5 py-3 backdrop-blur-md"
          style={{
            background: 'rgba(8, 18, 40, 0.75)',
            border: '1px solid rgba(59,158,255,0.35)',
            boxShadow: '0 0 24px rgba(59,158,255,0.15)',
          }}
          animate={{ opacity: scanning ? 1 : 0.85 }}
        >
          <p className="text-[10px] tracking-[0.14em] uppercase text-cyan-300/90 mb-1">
            Escaneando rostro
          </p>
          <p className="text-2xl font-semibold text-white tabular-nums leading-none">98%</p>
          <div className="mt-2 h-1.5 w-28 rounded-full overflow-hidden bg-white/10">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg,#1d8cff,#5cc8ff)' }}
              initial={{ width: '40%' }}
              animate={{ width: ['40%', '98%', '70%', '98%'] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <Shield className="w-3 h-3 text-cyan-400" />
            <span className="text-[10px] text-cyan-100/80 tracking-wide uppercase">
              Verificando identidad…
            </span>
          </div>
        </motion.div>
      </div>

      {/* Chips inferiores */}
      <div className="grid grid-cols-4 gap-2 pb-2">
        {[
          { icon: Shield, t: 'Seguridad', s: 'Avanzada' },
          { icon: Fingerprint, t: 'Biometría', s: 'Facial' },
          { icon: Lock, t: 'Acceso', s: 'Protegido' },
          { icon: Zap, t: 'Rápido', s: 'Y eficiente' },
        ].map(({ icon: Icon, t, s }) => (
          <div
            key={t}
            className="rounded-xl px-2 py-3 text-center"
            style={{
              background: 'rgba(10, 22, 48, 0.7)',
              border: '1px solid rgba(59,158,255,0.2)',
            }}
          >
            <Icon className="w-4 h-4 mx-auto mb-1.5 text-cyan-400" />
            <p className="text-[10px] font-semibold tracking-wide text-cyan-100/95 uppercase">{t}</p>
            <p className="text-[9px] text-cyan-200/50 mt-0.5">{s}</p>
          </div>
        ))}
      </div>
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
  const [theme, setTheme] = useState<ThemeId>(() => getStoredTheme());

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

  const toggleTheme = () => {
    const next: ThemeId = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyTheme(next);
  };

  const cardStyle = {
    background: 'rgba(12, 22, 45, 0.82)',
    border: '1px solid rgba(59,158,255,0.22)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)',
    backdropFilter: 'blur(20px)',
  } as const;

  return (
    <div
      className="h-screen w-screen flex flex-col relative overflow-hidden select-none"
      style={{
        background: 'linear-gradient(145deg, #050b18 0%, #0a162e 45%, #071020 100%)',
        color: '#e8f1ff',
      }}
    >
      {/* Ambiente lab */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(59,158,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59,158,255,0.5) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
        <div
          className="absolute top-0 left-0 w-[50%] h-full opacity-40"
          style={{
            background:
              'radial-gradient(ellipse at 30% 50%, rgba(29,100,220,0.35) 0%, transparent 60%)',
          }}
        />
      </div>

      {/* Title bar */}
      <div className="h-9 flex items-center justify-between px-3 shrink-0 drag-region relative z-30">
        <div className="flex items-center gap-2 text-[11px] pl-1 text-cyan-100/50">
          <span className="font-medium text-cyan-100/80">ELYRA</span>
          <span>· Acceso</span>
        </div>
        <div className="flex items-center gap-1 no-drag">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-full text-cyan-200/70 hover:bg-white/5"
            title="Tema"
          >
            {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>
          {isDesktop && (
            <>
              <button type="button" onClick={() => window.elyra?.minimize?.()} className="w-8 h-8 flex items-center justify-center rounded-full text-cyan-200/60 hover:bg-white/5">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => window.elyra?.maximize?.()} className="w-8 h-8 flex items-center justify-center rounded-full text-cyan-200/60 hover:bg-white/5">
                <Square className="w-3 h-3" />
              </button>
              <button type="button" onClick={() => window.elyra?.close?.()} className="w-8 h-8 flex items-center justify-center rounded-full text-cyan-200/60 hover:bg-red-500/20 hover:text-red-300">
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-stretch justify-center relative z-10 px-4 pb-4 pt-2 min-h-0">
        <div className="w-full max-w-6xl flex gap-8 items-center">
          <LoginHeroArt scanning={step === 'face' || step === 'face-register' || step === 'pick'} />

          {/* Columna derecha */}
          <div className="w-full max-w-[420px] mx-auto lg:mx-0 flex flex-col">
            <div className="text-center mb-5">
              <div
                className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3"
                style={{
                  background: 'radial-gradient(circle, rgba(59,158,255,0.35) 0%, rgba(10,30,60,0.9) 70%)',
                  border: '2px solid rgba(92,200,255,0.55)',
                  boxShadow: '0 0 32px rgba(59,158,255,0.4)',
                }}
              >
                <div className="w-5 h-5 rounded-full border-2 border-cyan-300" style={{ boxShadow: 'inset 0 0 8px #3b9eff' }} />
              </div>
              <h1 className="text-2xl font-semibold tracking-[0.2em] text-white">ELYRA</h1>
              <p className="text-[12px] mt-1 text-cyan-200/55">Laboratorio · PIN y biometría facial</p>
            </div>

            <motion.div
              className="rounded-2xl p-5 sm:p-6 space-y-4"
              style={cardStyle}
              animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.42 }}
            >
              <AnimatePresence mode="wait">
                {step === 'pick' && (
                  <motion.div key="pick" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-[15px] font-medium text-white">
                        <Shield className="w-4 h-4 text-cyan-400" />
                        Iniciar sesión
                      </div>
                      <p className="text-[12px] mt-1 text-cyan-100/45">Seleccione su usuario para continuar</p>
                    </div>

                    {users.length > 5 && (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyan-200/40" />
                        <input
                          type="search"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Buscar…"
                          className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none bg-white/5 border border-cyan-400/15 text-white placeholder:text-cyan-100/30"
                        />
                      </div>
                    )}

                    <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-0.5">
                      {filteredUsers.map((u) => {
                        const face = hasFaceRegistered(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setSelected(u.id);
                              setStep('pin');
                              setPin('');
                              setError('');
                              setShowPin(false);
                            }}
                            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all group"
                            style={{
                              background: face
                                ? 'linear-gradient(90deg, rgba(29,100,220,0.35), rgba(20,50,100,0.25))'
                                : 'rgba(255,255,255,0.03)',
                              border: face
                                ? '1px solid rgba(59,158,255,0.55)'
                                : '1px solid rgba(255,255,255,0.06)',
                            }}
                          >
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                              style={{
                                background: face ? 'rgba(59,158,255,0.35)' : 'rgba(255,255,255,0.06)',
                                color: face ? '#7dd3fc' : '#94a3b8',
                              }}
                            >
                              {u.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-white truncate">{u.displayName}</p>
                              <p className="text-[11px] text-cyan-100/45 truncate">
                                {u.roleLabel}
                                {face ? ' · Rostro' : ''}
                              </p>
                            </div>
                            {face && <ScanFace className="w-4 h-4 text-cyan-400 shrink-0" />}
                            {u.isAdmin && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0 bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                                Admin
                              </span>
                            )}
                            <ChevronRight className="w-4 h-4 text-cyan-100/25 group-hover:text-cyan-300 shrink-0" />
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-1">
                      <p className="text-[10px] tracking-[0.16em] uppercase text-center text-cyan-100/35 mb-2">
                        Otras opciones
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (filteredUsers[0]) {
                              setSelected(filteredUsers[0].id);
                              setStep('pin');
                            }
                          }}
                          className="rounded-xl px-3 py-3 text-left border border-cyan-400/15 bg-white/[0.03] hover:border-cyan-400/40 transition-colors"
                        >
                          <Lock className="w-4 h-4 text-cyan-400 mb-1" />
                          <p className="text-[12px] font-medium text-white">Acceso con PIN</p>
                          <p className="text-[10px] text-cyan-100/40">Ingresar código</p>
                        </button>
                        <button
                          type="button"
                          disabled
                          className="rounded-xl px-3 py-3 text-left border border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed"
                          title="Próximamente"
                        >
                          <CreditCard className="w-4 h-4 text-cyan-400/60 mb-1" />
                          <p className="text-[12px] font-medium text-white/80">Tarjeta de acceso</p>
                          <p className="text-[10px] text-cyan-100/30">Lector NFC</p>
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-center text-cyan-100/35 flex items-center justify-center gap-1.5 pt-1">
                      <Lock className="w-3 h-3" /> Acceso local · Solo en este equipo
                    </p>
                  </motion.div>
                )}

                {step === 'pin' && selectedUser && (
                  <motion.div key="pin" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={goPick} className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 text-cyan-100/60 hover:bg-white/10">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold bg-cyan-500/25 text-cyan-300">
                        {selectedUser.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">{selectedUser.displayName}</p>
                        <p className="text-[11px] text-cyan-100/45">{selectedUser.roleLabel}</p>
                      </div>
                    </div>

                    {selectedHasFace && (
                      <button
                        type="button"
                        onClick={() => { setError(''); setStep('face'); }}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white"
                        style={{
                          background: 'linear-gradient(90deg,#1a6fd4,#3b9eff)',
                          boxShadow: '0 0 24px rgba(59,158,255,0.35)',
                        }}
                      >
                        <ScanFace className="w-4 h-4" /> Entrar con el rostro
                      </button>
                    )}

                    {selectedHasFace && (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-[11px] text-cyan-100/35">o contraseña</span>
                        <div className="flex-1 h-px bg-white/10" />
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs text-cyan-100/50 flex items-center gap-1.5">
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
                          style={{ borderColor: error ? 'rgba(248,81,73,0.55)' : 'rgba(59,158,255,0.2)' }}
                          placeholder="······"
                          autoFocus={!selectedHasFace}
                        />
                        <button type="button" onClick={() => setShowPin((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-cyan-100/40" tabIndex={-1}>
                          {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <PinDots length={pin.length} />
                      <p className="text-[11px] text-center text-cyan-100/35">
                        Primera vez: use 123456
                      </p>
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
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium disabled:opacity-40"
                      style={{
                        background: selectedHasFace ? 'rgba(255,255,255,0.06)' : 'linear-gradient(90deg,#1a6fd4,#3b9eff)',
                        color: '#fff',
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
                    <p className="text-[11px] text-center text-cyan-100/35">
                      Cancelar omite el registro facial y entra con contraseña.
                    </p>
                  </motion.div>
                )}

                {step === 'change' && pendingUser && (
                  <motion.div key="change" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <KeyRound className="w-4 h-4 text-cyan-400" />
                      Cambiar contraseña
                    </div>
                    <p className="text-[13px] text-cyan-100/55">
                      Hola <strong className="text-white">{pendingUser.displayName}</strong>. Cambie la contraseña temporal.
                    </p>
                    <div className="space-y-3">
                      <input
                        type={showNew ? 'text' : 'password'}
                        inputMode="numeric"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
                        className="w-full rounded-xl px-4 py-3 text-center tracking-[0.3em] bg-white/5 border border-cyan-400/20 text-white outline-none"
                        placeholder="Nueva ····"
                        autoFocus
                      />
                      <input
                        type={showNew ? 'text' : 'password'}
                        inputMode="numeric"
                        value={newPin2}
                        onChange={(e) => setNewPin2(e.target.value.replace(/\D/g, '').slice(0, 12))}
                        onKeyDown={(e) => e.key === 'Enter' && !loading && submitChange()}
                        className="w-full rounded-xl px-4 py-3 text-center tracking-[0.3em] bg-white/5 border border-cyan-400/20 text-white outline-none"
                        placeholder="Confirmar ····"
                      />
                      <button type="button" onClick={() => setShowNew((v) => !v)} className="text-[11px] text-cyan-300/60">
                        {showNew ? 'Ocultar' : 'Mostrar'} dígitos
                      </button>
                    </div>
                    {error && (
                      <p role="alert" className="text-[13px] rounded-xl px-3 py-2 text-center text-red-300 bg-red-500/10 border border-red-400/20">{error}</p>
                    )}
                    <button type="button" onClick={submitChange} disabled={loading} className="w-full py-3 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: 'linear-gradient(90deg,#1a6fd4,#3b9eff)' }}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Guardar y continuar'}
                    </button>
                    <button type="button" onClick={changeLater} className="w-full py-2.5 rounded-xl text-sm text-cyan-100/50 border border-white/10">
                      Cambiar en otro momento
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <p className="text-center text-[10px] mt-5 text-cyan-100/25">
              © {new Date().getFullYear()} ELYRA · Sistema de gestión de laboratorio
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
