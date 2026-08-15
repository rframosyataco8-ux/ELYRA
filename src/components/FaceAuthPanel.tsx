import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Loader2, ScanFace, Check, X } from 'lucide-react';
import {
  requestCameraStream,
  stopStream,
  extractDescriptorFromVideo,
  captureThumbFromVideo,
  registerFace,
  verifyFaceMulti,
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

const REGISTER_SAMPLES = 3;

export function FaceAuthPanel({ userId, userName, mode, onSuccess, onCancel }: FaceAuthPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samplesRef = useRef<number[][]>([]);
  const lastBoxRef = useRef<{ x: number; y: number; width: number; height: number } | undefined>();

  const [phase, setPhase] = useState<'permission' | 'ready' | 'working' | 'done' | 'error'>('permission');
  const [message, setMessage] = useState('Solicitando permiso de cámara…');
  const [sampleCount, setSampleCount] = useState(0);
  const [error, setError] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);

  const cleanup = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
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
        setPhase('ready');
        setMessage(
          mode === 'register'
            ? 'Centre el rostro en el óvalo. Se capturarán 3 muestras con ligero movimiento.'
            : 'Centre el rostro. Se tomarán 3 lecturas para confirmar identidad.',
        );
      } catch (e) {
        setPhase('error');
        setError(captureError(e, 'No se pudo acceder a la cámara.'));
      }
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [mode, cleanup]);

  const handleRegister = async () => {
    setError('');
    setPhase('working');
    try {
      const video = videoRef.current;
      if (!video || video.readyState < 2) throw new Error('La cámara aún no está lista.');

      const { descriptor, box } = await extractDescriptorFromVideo(video);
      lastBoxRef.current = box;
      samplesRef.current.push(descriptor);
      const n = samplesRef.current.length;
      setSampleCount(n);
      setMessage(`Muestra ${n}/${REGISTER_SAMPLES} · calidad OK`);

      if (n < REGISTER_SAMPLES) {
        setPhase('ready');
        setMessage(`Gire un poco la cabeza y pulse Capturar (${n}/${REGISTER_SAMPLES}).`);
        return;
      }

      const thumb = captureThumbFromVideo(video, lastBoxRef.current);
      registerFace(userId, samplesRef.current, thumb);
      setPhase('done');
      setMessage('Rostro registrado de forma segura en este equipo.');
      cleanup();
      window.setTimeout(() => onSuccess(), 700);
    } catch (e) {
      setPhase('ready');
      setError(captureError(e, 'No se pudo capturar el rostro.'));
    }
  };

  const handleVerify = async () => {
    setError('');
    setConfidence(null);
    setPhase('working');
    setMessage('Escaneando rostro…');
    try {
      const video = videoRef.current;
      if (!video || video.readyState < 2) throw new Error('La cámara aún no está lista.');

      const result = await verifyFaceMulti(userId, video, 3);
      setConfidence(result.confidence);

      if (!result.ok) {
        setPhase('ready');
        setError(
          `No coincide (confianza ${result.confidence}%). Mejor luz, mire de frente o use PIN.`,
        );
        return;
      }

      setPhase('done');
      setMessage(`Identidad verificada · confianza ${result.confidence}%`);
      cleanup();
      window.setTimeout(() => onSuccess(), 550);
    } catch (e) {
      setPhase('ready');
      setError(captureError(e, 'Error al verificar.'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-white">
        <ScanFace className="w-4 h-4 text-sky-400" />
        <span>
          {mode === 'register' ? 'Registrar rostro' : 'Acceso facial'} · {userName}
        </span>
      </div>

      <div
        className="relative mx-auto rounded-2xl overflow-hidden bg-black"
        style={{
          width: '100%',
          maxWidth: 320,
          aspectRatio: '4/3',
          border: '1px solid rgba(56,180,255,0.35)',
          boxShadow: '0 0 32px rgba(56,180,255,0.15)',
        }}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Barrido de escaneo */}
        {phase === 'working' && (
          <motion.div
            className="absolute left-0 right-0 h-0.5 z-10"
            style={{ background: 'linear-gradient(90deg, transparent, #38bdf8, transparent)' }}
            animate={{ top: ['15%', '85%', '15%'] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="rounded-full border-2"
            style={{
              width: '58%',
              height: '72%',
              borderColor:
                phase === 'done'
                  ? '#3fb950'
                  : phase === 'error'
                    ? '#f85149'
                    : '#38bdf8',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
            }}
          />
        </div>

        {phase === 'permission' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
            <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
            <p className="text-xs text-white/80">Permiso de cámara…</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-14 h-14 rounded-full flex items-center justify-center bg-emerald-500"
            >
              <Check className="w-7 h-7 text-white" />
            </motion.div>
          </div>
        )}

        {confidence != null && phase !== 'done' && (
          <div className="absolute bottom-2 left-0 right-0 text-center text-[11px] text-sky-200/90">
            Confianza estimada: {confidence}%
          </div>
        )}
      </div>

      <p className="text-[13px] text-center leading-relaxed text-sky-100/55">{message}</p>

      {mode === 'register' && sampleCount > 0 && phase !== 'done' && (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: REGISTER_SAMPLES }).map((_, i) => (
            <span
              key={i}
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: i < sampleCount ? '#38bdf8' : 'rgba(255,255,255,0.15)' }}
            />
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-[12px] rounded-xl px-3 py-2 text-center text-red-300 bg-red-500/10 border border-red-400/20">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            cleanup();
            onCancel();
          }}
          className="flex-1 py-2.5 rounded-full text-sm font-medium flex items-center justify-center gap-1.5 text-sky-100/60 border border-white/10 bg-white/5"
        >
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
        {mode === 'register' ? (
          <button
            type="button"
            disabled={phase !== 'ready'}
            onClick={handleRegister}
            className="flex-1 py-2.5 rounded-full text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-45 text-white"
            style={{ background: 'linear-gradient(90deg,#0c5ebd,#38bdf8)' }}
          >
            {phase === 'working' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Camera className="w-4 h-4" /> Capturar
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            disabled={phase !== 'ready'}
            onClick={handleVerify}
            className="flex-1 py-2.5 rounded-full text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-45 text-white"
            style={{ background: 'linear-gradient(90deg,#0c5ebd,#38bdf8)' }}
          >
            {phase === 'working' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <ScanFace className="w-4 h-4" /> Verificar identidad
              </>
            )}
          </button>
        )}
      </div>

      <p className="text-[10px] text-center text-sky-100/30">
        Detección local del rostro · datos solo en este equipo · no se suben a internet
      </p>
    </div>
  );
}
