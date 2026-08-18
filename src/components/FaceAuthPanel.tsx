import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check, Lock, ShieldCheck, ScanFace } from 'lucide-react';
import {
  requestCameraStream,
  stopStream,
  extractDescriptorFromVideo,
  captureThumbFromVideo,
  registerFace,
  verifyFace,
  resetLivenessState,
  hasEnoughSpoofHistory,
} from '@/lib/faceAuth';
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

/**
 * Face ID estilo móvil: la cámara trabaja en segundo plano (oculta).
 * El usuario solo ve animación abstracta + feedback, como en iPhone/Android.
 */
export function FaceAuthPanel({ userId, userName, mode, onSuccess, onCancel }: FaceAuthPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samplesRef = useRef<number[][]>([]);
  const lastBoxRef = useRef<{ x: number; y: number; width: number; height: number } | undefined>();
  const aliveRef = useRef(true);
  const loopRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('permission');
  const [message, setMessage] = useState('Activando sensor…');
  const [hint, setHint] = useState('');
  const [progress, setProgress] = useState(0);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [depthPct, setDepthPct] = useState<number | null>(null);
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
      }, 560);
    },
    [onSuccess],
  );

  const runVerifyLoop = useCallback(async () => {
    if (loopRef.current) return;
    loopRef.current = true;
    resetLivenessState();
    setPhase('looking');
    setMessage('Face ID');
    setHint('Mire al sensor · gire un poco la cabeza');
    setProgress(6);
    setError('');
    setConfidence(null);
    setDepthPct(null);

    const maxAttempts = 36;
    let matched = 0;
    let spoofPasses = 0;
    let attempts = 0;
    const needMatch = 2;
    const needSpoof = 2;

    while (aliveRef.current && loopRef.current && attempts < maxAttempts) {
      attempts++;
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        await new Promise((r) => setTimeout(r, 180));
        continue;
      }

      setPhase('scanning');
      setProgress(Math.min(90, 8 + attempts * 2.2));

      try {
        const { descriptor, quality, spoof } = await extractDescriptorFromVideo(video, {
          enforceSpoof: true,
        });
        const result = verifyFace(userId, descriptor);
        setConfidence(result.confidence);
        setDepthPct(Math.round(spoof.depthProxy * 100));

        if (hasEnoughSpoofHistory() && spoof.ok) {
          spoofPasses++;
        } else if (hasEnoughSpoofHistory() && !spoof.ok) {
          spoofPasses = Math.max(0, spoofPasses - 1);
          matched = 0;
          setMessage('Verificando profundidad');
          setHint(spoof.reason || 'Gire ligeramente la cabeza');
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }

        if (result.ok && quality > 0.35 && spoofPasses >= needSpoof) {
          matched++;
          setProgress(Math.min(99, 55 + matched * 20));
          setMessage(matched >= needMatch ? 'Identidad confirmada' : 'Reconociendo…');
          setHint('Rostro verificado');
          if (matched >= needMatch) {
            finishOk('Desbloqueado');
            loopRef.current = false;
            return;
          }
        } else if (result.ok && quality > 0.35) {
          setMessage('Comprobando que es usted…');
          setHint('Mueva un poco la cabeza');
        } else {
          if (matched > 0 && result.confidence < 42) matched = 0;
          if (result.confidence > 50) {
            setMessage('Casi…');
            setHint('Mantenga el rostro de frente');
          } else {
            setMessage('Buscando rostro');
            setHint('Acérquese · buena luz');
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Ajuste la posición';
        setMessage('Ajuste');
        setHint(msg);
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    if (aliveRef.current && loopRef.current) {
      loopRef.current = false;
      setPhase('fail');
      setProgress(0);
      setError('No se pudo verificar. Use el PIN.');
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
    setMessage('Registrar Face ID');
    setHint('Gire la cabeza con naturalidad');
    setError('');
    setConfidence(null);
    setDepthPct(null);

    const need = 5;
    let tries = 0;

    while (aliveRef.current && loopRef.current && samplesRef.current.length < need && tries < 52) {
      tries++;
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        await new Promise((r) => setTimeout(r, 180));
        continue;
      }

      try {
        const requireMotion = samplesRef.current.length >= 1;
        const { descriptor, box, quality, spoof } = await extractDescriptorFromVideo(video, {
          requireMotion: requireMotion && samplesRef.current.length < need - 1,
          minMotion: 1.05,
          enforceSpoof: samplesRef.current.length >= 2,
        });

        setDepthPct(Math.round(spoof.depthProxy * 100));

        if (quality < 0.28) {
          setHint('Mejore la iluminación');
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }

        lastBoxRef.current = box;
        samplesRef.current.push(descriptor);
        const n = samplesRef.current.length;
        setProgress(Math.round((n / need) * 100));
        setMessage(n < need ? `Capturando ${n}/${need}` : 'Guardando…');
        setHint(
          n === 1
            ? 'Gire un poco a la izquierda'
            : n === 3
              ? 'Ahora un poco a la derecha'
              : 'Mantenga movimiento natural',
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Centre el rostro';
        setHint(msg);
      }

      await new Promise((r) => setTimeout(r, 260));
    }

    if (!aliveRef.current || !loopRef.current) return;

    try {
      const video = videoRef.current;
      const thumb = video ? captureThumbFromVideo(video, lastBoxRef.current) : undefined;
      registerFace(userId, samplesRef.current, thumb);
      finishOk('Face ID listo');
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
        setMessage('Sensor no disponible');
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
    setDepthPct(null);
    samplesRef.current = [];
    resetLivenessState();
    if (mode === 'verify') void runVerifyLoop();
    else void runRegisterLoop();
  };

  const isActive = phase === 'looking' || phase === 'scanning';
  const isDone = phase === 'done';
  const isFail = phase === 'fail' || phase === 'error';
  const ringColor = isDone ? '#3fb950' : isFail ? 'rgba(248,81,73,0.9)' : '#5b9fff';

  return (
    <div className="space-y-5">
      {/* Video oculto: captura real sin mostrar preview (estilo móvil) */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        aria-hidden
        tabIndex={-1}
        style={{
          position: 'fixed',
          left: -9999,
          top: 0,
          width: 640,
          height: 480,
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />

      <div className="text-center space-y-1">
        <div
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-medium"
          style={{ color: 'var(--ely-text-dim)' }}
        >
          <ShieldCheck className="w-3 h-3" style={{ color: 'var(--ely-accent)' }} />
          {mode === 'register' ? 'Registrar Face ID' : 'Face ID'}
        </div>
        <p className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--ely-text)' }}>
          {userName}
        </p>
      </div>

      {/* Anillo abstracto — sin cámara visible */}
      <div className="relative mx-auto" style={{ width: 200, height: 200 }}>
        {/* Glow */}
        <div
          className="absolute inset-[-12px] rounded-full pointer-events-none"
          style={{
            background: isDone
              ? 'radial-gradient(circle, rgba(63,185,80,0.18) 0%, transparent 70%)'
              : isFail
                ? 'radial-gradient(circle, rgba(248,81,73,0.12) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(91,159,255,0.14) 0%, transparent 70%)',
          }}
        />

        {/* Anillos orbitando */}
        {isActive && (
          <>
            <motion.div
              className="absolute inset-[-4px] rounded-full border border-dashed"
              style={{ borderColor: 'color-mix(in srgb, var(--ely-accent) 28%, transparent)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute inset-[-14px] rounded-full border"
              style={{ borderColor: 'color-mix(in srgb, var(--ely-accent) 12%, transparent)' }}
              animate={{ rotate: -360 }}
              transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
            />
          </>
        )}

        {/* Progreso circular */}
        <svg
          className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
          viewBox="0 0 100 100"
        >
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="var(--ely-track)"
            strokeWidth="2.5"
          />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke={ringColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${(progress / 100) * 289} 289`}
            style={{ transition: 'stroke-dasharray 0.3s ease, stroke 0.3s ease' }}
          />
        </svg>

        {/* Núcleo */}
        <div
          className="absolute inset-[14px] rounded-full flex items-center justify-center"
          style={{
            background: 'var(--ely-surface)',
            border: `1.5px solid ${isDone || isFail ? ringColor : 'var(--ely-border)'}`,
            boxShadow: isDone
              ? '0 0 28px rgba(63,185,80,0.25)'
              : isActive
                ? '0 0 24px color-mix(in srgb, var(--ely-accent) 20%, transparent)'
                : 'var(--ely-shadow-sm)',
          }}
        >
          <AnimatePresence mode="wait">
            {phase === 'permission' && (
              <motion.div
                key="perm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--ely-accent)' }} />
              </motion.div>
            )}

            {isActive && (
              <motion.div
                key="scan"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative flex items-center justify-center"
              >
                <ScanFace
                  className="w-14 h-14"
                  strokeWidth={1.25}
                  style={{ color: 'var(--ely-accent)' }}
                />
                {/* Línea de escaneo */}
                <motion.div
                  className="absolute left-[18%] right-[18%] h-[2px] rounded-full"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, var(--ely-accent), transparent)',
                    boxShadow: '0 0 10px var(--ely-accent)',
                  }}
                  animate={{ top: ['22%', '72%', '22%'] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                />
              </motion.div>
            )}

            {isDone && (
              <motion.div
                key="ok"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(145deg,#3fb950,#2ea043)',
                  boxShadow: '0 0 24px rgba(63,185,80,0.45)',
                }}
              >
                <Check className="w-9 h-9 text-white" strokeWidth={2.5} />
              </motion.div>
            )}

            {isFail && (
              <motion.div
                key="fail"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-1"
              >
                <Lock className="w-9 h-9" style={{ color: 'var(--ely-danger)' }} strokeWidth={1.5} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Pulso exterior al escanear */}
        {isActive && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ border: '1px solid color-mix(in srgb, var(--ely-accent) 35%, transparent)' }}
            animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>

      <div className="text-center space-y-1 min-h-[3.25rem]">
        <p className="text-[15px] font-medium tracking-tight" style={{ color: 'var(--ely-text)' }}>
          {message}
        </p>
        {hint && (
          <p className="text-[12px]" style={{ color: 'var(--ely-text-muted)' }}>
            {hint}
          </p>
        )}
        <div
          className="flex items-center justify-center gap-3 text-[11px] tabular-nums pt-0.5"
          style={{ color: 'var(--ely-text-dim)' }}
        >
          {confidence != null && isActive && <span>Coincidencia {confidence}%</span>}
          {depthPct != null && isActive && <span>Profundidad {depthPct}%</span>}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="text-[12px] rounded-xl px-3 py-2.5 text-center"
          style={{
            color: 'var(--ely-danger)',
            background: 'color-mix(in srgb, var(--ely-danger) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--ely-danger) 18%, transparent)',
          }}
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {isFail && (
          <button type="button" onClick={retry} className="ely-btn-primary w-full">
            Reintentar
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            cleanup();
            onCancel();
          }}
          className="w-full py-2.5 rounded-full text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors"
          style={{
            color: 'var(--ely-text-muted)',
            border: '1px solid var(--ely-border)',
            background: 'var(--ely-bg-soft)',
          }}
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

      <p className="text-[10px] text-center leading-relaxed" style={{ color: 'var(--ely-text-dim)' }}>
        Sensor oculto · anti-spoof 3D · solo en este equipo
      </p>
    </div>
  );
}
