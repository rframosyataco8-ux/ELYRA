import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Check, X, Lock } from 'lucide-react';
import {
  requestCameraStream,
  stopStream,
  extractDescriptorFromVideo,
  captureThumbFromVideo,
  registerFace,
  verifyFace,
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

/** Desbloqueo facial tipo smartphone: abre cámara y escanea solo hasta reconocer. */
export function FaceAuthPanel({ userId, userName, mode, onSuccess, onCancel }: FaceAuthPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samplesRef = useRef<number[][]>([]);
  const lastBoxRef = useRef<{ x: number; y: number; width: number; height: number } | undefined>();
  const aliveRef = useRef(true);
  const loopRef = useRef(false);

  const [phase, setPhase] = useState<'permission' | 'looking' | 'scanning' | 'done' | 'fail' | 'error'>('permission');
  const [message, setMessage] = useState('Activando cámara…');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const cleanup = useCallback(() => {
    aliveRef.current = false;
    loopRef.current = false;
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const finishOk = useCallback(
    (msg: string) => {
      setPhase('done');
      setMessage(msg);
      setProgress(100);
      stopStream(streamRef.current);
      streamRef.current = null;
      window.setTimeout(() => {
        if (aliveRef.current) onSuccess();
      }, 480);
    },
    [onSuccess],
  );

  /** Bucle continuo de verificación (como Face ID). */
  const runVerifyLoop = useCallback(async () => {
    if (loopRef.current) return;
    loopRef.current = true;
    setPhase('looking');
    setMessage('Mire a la cámara');
    setProgress(8);
    setError('');

    const maxAttempts = 28; // ~8–10 s
    let matched = 0;
    let attempts = 0;
    const needMatch = 2;

    while (aliveRef.current && loopRef.current && attempts < maxAttempts) {
      attempts++;
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }

      setPhase('scanning');
      setProgress(Math.min(92, 10 + attempts * 3));

      try {
        const { descriptor } = await extractDescriptorFromVideo(video);
        const result = verifyFace(userId, descriptor);

        if (result.ok) {
          matched++;
          setProgress(Math.min(99, 55 + matched * 20));
          setMessage(matched >= needMatch ? 'Reconocido' : 'Mantenga la mirada…');
          if (matched >= needMatch) {
            finishOk('Desbloqueado');
            loopRef.current = false;
            return;
          }
        } else {
          // no resetear matched a 0 del todo: tolerancia ligera
          if (matched > 0 && result.confidence < 40) matched = 0;
          setMessage(result.confidence > 45 ? 'Casi… centre el rostro' : 'Mire a la cámara');
        }
      } catch {
        setMessage('Acerque el rostro y mejore la luz');
      }

      await new Promise((r) => setTimeout(r, 220));
    }

    if (aliveRef.current && loopRef.current) {
      loopRef.current = false;
      setPhase('fail');
      setProgress(0);
      setError('No se pudo verificar el rostro. Use el PIN o reintente.');
      setMessage('No reconocido');
    }
  }, [userId, finishOk]);

  /** Registro: varias capturas automáticas. */
  const runRegisterLoop = useCallback(async () => {
    if (loopRef.current) return;
    loopRef.current = true;
    samplesRef.current = [];
    setPhase('scanning');
    setMessage('Gire un poco la cabeza…');
    setError('');

    const need = 4;
    let tries = 0;

    while (aliveRef.current && loopRef.current && samplesRef.current.length < need && tries < 40) {
      tries++;
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }

      try {
        const { descriptor, box } = await extractDescriptorFromVideo(video);
        lastBoxRef.current = box;
        samplesRef.current.push(descriptor);
        const n = samplesRef.current.length;
        setProgress(Math.round((n / need) * 100));
        setMessage(n < need ? `Registrando… ${n}/${need}` : 'Guardando…');
      } catch {
        setMessage('Centre el rostro con buena luz');
      }

      await new Promise((r) => setTimeout(r, 320));
    }

    if (!aliveRef.current || !loopRef.current) return;

    try {
      const video = videoRef.current;
      const thumb = video ? captureThumbFromVideo(video, lastBoxRef.current) : undefined;
      registerFace(userId, samplesRef.current, thumb);
      finishOk('Rostro guardado');
    } catch (e) {
      loopRef.current = false;
      setPhase('fail');
      setError(captureError(e, 'No se pudo registrar el rostro.'));
      setMessage('Error al registrar');
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
        // Pequeña pausa para estabilizar el stream (como el teléfono)
        await new Promise((r) => setTimeout(r, 350));
        if (cancelled || !aliveRef.current) return;

        if (mode === 'verify') {
          void runVerifyLoop();
        } else {
          setPhase('looking');
          setMessage('Centre el rostro para registrar');
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
    samplesRef.current = [];
    if (mode === 'verify') void runVerifyLoop();
    else void runRegisterLoop();
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-[13px] font-medium text-white">{userName}</p>
        <p className="text-[11px] text-sky-100/40 mt-0.5">
          {mode === 'register' ? 'Registrar Face ID' : 'Desbloqueo facial'}
        </p>
      </div>

      {/* Vista circular tipo móvil */}
      <div className="relative mx-auto" style={{ width: 220, height: 220 }}>
        <div
          className="absolute inset-0 rounded-full overflow-hidden"
          style={{
            border:
              phase === 'done'
                ? '2.5px solid #3fb950'
                : phase === 'fail' || phase === 'error'
                  ? '2.5px solid rgba(248,81,73,0.7)'
                  : '2.5px solid rgba(56,180,255,0.55)',
            boxShadow:
              phase === 'done'
                ? '0 0 32px rgba(63,185,80,0.35)'
                : '0 0 28px rgba(56,180,255,0.2)',
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

          {phase === 'permission' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
            </div>
          )}

          {phase === 'done' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                className="w-14 h-14 rounded-full flex items-center justify-center bg-emerald-500"
              >
                <Check className="w-8 h-8 text-white" strokeWidth={2.5} />
              </motion.div>
            </div>
          )}
        </div>

        {/* Anillo de progreso sutil */}
        {(phase === 'scanning' || phase === 'looking') && (
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(56,180,255,0.12)" strokeWidth="1.5" />
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeDasharray={`${(progress / 100) * 301} 301`}
              style={{ transition: 'stroke-dasharray 0.25s ease' }}
            />
          </svg>
        )}
      </div>

      <p className="text-[14px] text-center font-medium text-white/90 min-h-[1.25rem]">{message}</p>

      {error && (
        <p role="alert" className="text-[12px] rounded-xl px-3 py-2 text-center text-red-300/90 bg-red-500/10 border border-red-400/15">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {(phase === 'fail' || phase === 'error') && (
          <button
            type="button"
            onClick={retry}
            className="w-full py-2.5 rounded-full text-[13px] font-medium text-white"
            style={{ background: 'linear-gradient(90deg,#0c5ebd,#2a9ae0)' }}
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
          className="w-full py-2.5 rounded-full text-[13px] font-medium flex items-center justify-center gap-1.5 text-sky-100/55 border border-white/10 bg-white/[0.04]"
        >
          {mode === 'verify' ? (
            <>
              <Lock className="w-3.5 h-3.5" /> Usar PIN
            </>
          ) : (
            <>
              <X className="w-3.5 h-3.5" /> Omitir
            </>
          )}
        </button>
      </div>

      <p className="text-[10px] text-center text-sky-100/25">
        Desbloqueo local · sin enviar datos a internet
      </p>
    </div>
  );
}
