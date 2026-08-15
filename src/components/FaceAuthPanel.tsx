import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check, Lock, ShieldCheck } from 'lucide-react';
import {
  requestCameraStream,
  stopStream,
  extractDescriptorFromVideo,
  captureThumbFromVideo,
  registerFace,
  verifyFace,
  resetLivenessState,
} from '@/lib/faceAuth';
import { FaceMeshOverlay } from '@/components/FaceMeshOverlay';
import { captureError } from '@/lib/errors';

type Mode = 'register' | 'verify';

interface FaceAuthPanelProps {
  userId: string;
  userName: string;
  mode: Mode;
  onSuccess: () => void;
  onCancel: () => void;
}

type Phase = 'permission' | 'looking' | 'scanning' | 'done' | 'fail' | 'error';

/** Desbloqueo facial tipo smartphone con liveness y UI premium. */
export function FaceAuthPanel({ userId, userName, mode, onSuccess, onCancel }: FaceAuthPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samplesRef = useRef<number[][]>([]);
  const lastBoxRef = useRef<{ x: number; y: number; width: number; height: number } | undefined>();
  const aliveRef = useRef(true);
  const loopRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('permission');
  const [message, setMessage] = useState('Activando cámara…');
  const [hint, setHint] = useState('');
  const [progress, setProgress] = useState(0);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [error, setError] = useState('');

  const cleanup = useCallback(() => {
    aliveRef.current = false;
    loopRef.current = false;
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    resetLivenessState();
  }, []);

  const finishOk = useCallback(
    (msg: string) => {
      setPhase('done');
      setMessage(msg);
      setHint('');
      setProgress(100);
      stopStream(streamRef.current);
      streamRef.current = null;
      window.setTimeout(() => {
        if (aliveRef.current) onSuccess();
      }, 520);
    },
    [onSuccess],
  );

  const runVerifyLoop = useCallback(async () => {
    if (loopRef.current) return;
    loopRef.current = true;
    resetLivenessState();
    setPhase('looking');
    setMessage('Mire a la cámara');
    setHint('Mantenga el rostro dentro del círculo');
    setProgress(6);
    setError('');
    setConfidence(null);

    const maxAttempts = 32;
    let matched = 0;
    let attempts = 0;
    const needMatch = 2;

    while (aliveRef.current && loopRef.current && attempts < maxAttempts) {
      attempts++;
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        await new Promise((r) => setTimeout(r, 180));
        continue;
      }

      setPhase('scanning');
      setProgress(Math.min(90, 8 + attempts * 2.5));

      try {
        const { descriptor, quality } = await extractDescriptorFromVideo(video);
        const result = verifyFace(userId, descriptor);
        setConfidence(result.confidence);

        if (result.ok && quality > 0.35) {
          matched++;
          setProgress(Math.min(99, 50 + matched * 22));
          setMessage(matched >= needMatch ? 'Identidad confirmada' : 'Un momento…');
          setHint(matched >= needMatch ? '' : 'No se mueva');
          if (matched >= needMatch) {
            finishOk('Desbloqueado');
            loopRef.current = false;
            return;
          }
        } else {
          if (matched > 0 && result.confidence < 42) matched = 0;
          if (result.confidence > 50) {
            setMessage('Casi…');
            setHint('Centre el rostro y mire de frente');
          } else {
            setMessage('Buscando rostro');
            setHint('Acérquese y mejore la luz');
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Ajuste la posición';
        setMessage('Ajuste el rostro');
        setHint(msg);
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    if (aliveRef.current && loopRef.current) {
      loopRef.current = false;
      setPhase('fail');
      setProgress(0);
      setError('No se pudo verificar. Reintente o use el PIN.');
      setMessage('No reconocido');
      setHint('');
    }
  }, [userId, finishOk]);

  const runRegisterLoop = useCallback(async () => {
    if (loopRef.current) return;
    loopRef.current = true;
    samplesRef.current = [];
    resetLivenessState();
    setPhase('scanning');
    setMessage('Registre su rostro');
    setHint('Gire un poco la cabeza entre capturas');
    setError('');
    setConfidence(null);

    const need = 5;
    let tries = 0;
    let motionGate = false;

    while (aliveRef.current && loopRef.current && samplesRef.current.length < need && tries < 48) {
      tries++;
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        await new Promise((r) => setTimeout(r, 180));
        continue;
      }

      try {
        // Tras 2 muestras, exigir micro-movimiento (anti-foto)
        const requireMotion = samplesRef.current.length >= 2 || motionGate;
        const { descriptor, box, motion, quality } = await extractDescriptorFromVideo(video, {
          requireMotion: requireMotion && samplesRef.current.length < need - 1,
          minMotion: 1.1,
        });

        if (motion > 1.5) motionGate = true;

        if (quality < 0.28) {
          setHint('Mejore la iluminación');
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }

        lastBoxRef.current = box;
        samplesRef.current.push(descriptor);
        const n = samplesRef.current.length;
        setProgress(Math.round((n / need) * 100));
        setMessage(n < need ? `Escaneando ${n}/${need}` : 'Guardando plantilla…');
        setHint(n === 1 ? 'Ahora gire ligeramente a la izquierda' : n === 3 ? 'Ahora un poco a la derecha' : 'Mantenga la mirada');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Centre el rostro';
        setHint(msg);
      }

      await new Promise((r) => setTimeout(r, 280));
    }

    if (!aliveRef.current || !loopRef.current) return;

    try {
      const video = videoRef.current;
      const thumb = video ? captureThumbFromVideo(video, lastBoxRef.current) : undefined;
      registerFace(userId, samplesRef.current, thumb);
      finishOk('Rostro registrado');
    } catch (e) {
      loopRef.current = false;
      setPhase('fail');
      setError(captureError(e, 'No se pudo registrar el rostro.'));
      setMessage('Error al registrar');
      setHint('');
    }
  }, [userId, finishOk]);

  useEffect(() => {
    aliveRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const stream = await requestCameraStream();
        if (cancelled) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        await new Promise((r) => setTimeout(r, 320));
        if (cancelled || !aliveRef.current) return;

        if (mode === 'verify') void runVerifyLoop();
        else {
          setPhase('looking');
          setMessage('Prepare su rostro');
          void runRegisterLoop();
        }
      } catch (e) {
        setPhase('error');
        setError(captureError(e, 'No se pudo acceder a la cámara.'));
        setMessage('Cámara no disponible');
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [mode, cleanup, runVerifyLoop, runRegisterLoop]);

  const retry = () => {
    setError('');
    setProgress(0);
    setConfidence(null);
    samplesRef.current = [];
    resetLivenessState();
    if (mode === 'verify') void runVerifyLoop();
    else void runRegisterLoop();
  };

  const ringColor =
    phase === 'done'
      ? '#3fb950'
      : phase === 'fail' || phase === 'error'
        ? 'rgba(248,81,73,0.85)'
        : '#38bdf8';

  return (
    <div className="space-y-5">
      <div className="text-center space-y-0.5">
        <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-sky-300/50 font-medium">
          <ShieldCheck className="w-3 h-3" />
          {mode === 'register' ? 'Registro biométrico' : 'Face Unlock'}
        </div>
        <p className="text-[15px] font-semibold text-white tracking-tight">{userName}</p>
      </div>

      {/* Escáner circular premium */}
      <div className="relative mx-auto" style={{ width: 236, height: 236 }}>
        {/* Halo exterior */}
        <div
          className="absolute inset-[-6px] rounded-full pointer-events-none"
          style={{
            background:
              phase === 'done'
                ? 'radial-gradient(circle, rgba(63,185,80,0.2) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(56,189,248,0.14) 0%, transparent 70%)',
          }}
        />

        <div
          className="absolute inset-0 rounded-full overflow-hidden"
          style={{
            border: `2px solid ${ringColor}`,
            boxShadow:
              phase === 'done'
                ? '0 0 40px rgba(63,185,80,0.35), inset 0 0 20px rgba(0,0,0,0.35)'
                : '0 0 36px rgba(56,180,255,0.22), inset 0 0 20px rgba(0,0,0,0.4)',
          }}
        >
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            style={{ transform: 'scaleX(-1)' }}
          />

          {(phase === 'looking' || phase === 'scanning') && (
            <FaceMeshOverlay videoRef={videoRef} active mirrored />
          )}

          {/* Viñeta suave */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at center, transparent 42%, rgba(0,0,0,0.45) 100%)',
            }}
          />

          {phase === 'permission' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <Loader2 className="w-7 h-7 animate-spin text-sky-400" />
            </div>
          )}

          <AnimatePresence>
            {phase === 'done' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-black/50"
              >
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 16 }}
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(145deg,#3fb950,#2ea043)',
                    boxShadow: '0 0 28px rgba(63,185,80,0.55)',
                  }}
                >
                  <Check className="w-9 h-9 text-white" strokeWidth={2.5} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Anillo de progreso SVG */}
        {(phase === 'scanning' || phase === 'looking') && (
          <svg
            className="absolute inset-[-4px] w-[calc(100%+8px)] h-[calc(100%+8px)] -rotate-90 pointer-events-none"
            viewBox="0 0 100 100"
          >
            <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(56,180,255,0.1)" strokeWidth="1.2" />
            <circle
              cx="50"
              cy="50"
              r="47"
              fill="none"
              stroke="url(#elyFaceGrad)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`${(progress / 100) * 295} 295`}
              style={{ transition: 'stroke-dasharray 0.28s ease' }}
            />
            <defs>
              <linearGradient id="elyFaceGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0369a1" />
                <stop offset="100%" stopColor="#7dd3fc" />
              </linearGradient>
            </defs>
          </svg>
        )}

        {/* Pulso suave al buscar */}
        {phase === 'looking' && (
          <motion.div
            className="absolute inset-0 rounded-full border border-sky-400/30 pointer-events-none"
            animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>

      <div className="text-center space-y-1 min-h-[3rem]">
        <p className="text-[15px] font-medium text-white tracking-tight">{message}</p>
        {hint && <p className="text-[12px] text-sky-100/45">{hint}</p>}
        {confidence != null && phase === 'scanning' && (
          <p className="text-[11px] text-sky-200/50 tabular-nums">Confianza {confidence}%</p>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="text-[12px] rounded-xl px-3 py-2.5 text-center text-red-300/90 bg-red-500/10 border border-red-400/15"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {(phase === 'fail' || phase === 'error') && (
          <button
            type="button"
            onClick={retry}
            className="w-full py-2.5 rounded-full text-[13px] font-medium text-white"
            style={{
              background: 'linear-gradient(90deg,#0c5ebd,#2a9ae0)',
              boxShadow: '0 0 20px rgba(56,180,255,0.2)',
            }}
          >
            Reintentar
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            cleanup();
            onCancel();
          }}
          className="w-full py-2.5 rounded-full text-[13px] font-medium flex items-center justify-center gap-1.5 text-sky-100/50 border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
        >
          {mode === 'verify' ? (
            <>
              <Lock className="w-3.5 h-3.5" /> Usar PIN
            </>
          ) : (
            'Omitir por ahora'
          )}
        </button>
      </div>

      <p className="text-[10px] text-center text-sky-100/22 leading-relaxed">
        Liveness · multi-plantilla · matching híbrido · datos solo en este equipo
      </p>
    </div>
  );
}
