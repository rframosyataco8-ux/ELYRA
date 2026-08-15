import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Loader2, ScanFace, Check, X } from 'lucide-react';
import {
  requestCameraStream,
  stopStream,
  extractDescriptorFromVideo,
  captureThumbFromVideo,
  registerFace,
  verifyFace,
} from '@/lib/faceAuth';
import { captureError } from '@/lib/errors';
import { elyTransition } from '@/lib/motion';

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

  const [phase, setPhase] = useState<'permission' | 'ready' | 'working' | 'done' | 'error'>('permission');
  const [message, setMessage] = useState('Solicitando permiso de cámara…');
  const [sampleCount, setSampleCount] = useState(0);
  const [error, setError] = useState('');

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
            ? 'Centre su rostro y pulse Registrar (se tomarán 3 muestras).'
            : 'Centre su rostro y pulse Verificar.',
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

  const captureSample = (): number[] => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) throw new Error('La cámara aún no está lista.');
    return extractDescriptorFromVideo(video);
  };

  const handleRegister = async () => {
    setError('');
    setPhase('working');
    try {
      const desc = captureSample();
      samplesRef.current.push(desc);
      const n = samplesRef.current.length;
      setSampleCount(n);
      setMessage(`Muestra ${n} de ${REGISTER_SAMPLES} capturada.`);

      if (n < REGISTER_SAMPLES) {
        setPhase('ready');
        setMessage(`Mueva ligeramente la cabeza y pulse de nuevo (${n}/${REGISTER_SAMPLES}).`);
        return;
      }

      const thumb = videoRef.current ? captureThumbFromVideo(videoRef.current) : undefined;
      registerFace(userId, samplesRef.current, thumb);
      setPhase('done');
      setMessage('Rostro registrado y guardado en este equipo.');
      cleanup();
      window.setTimeout(() => onSuccess(), 700);
    } catch (e) {
      setPhase('ready');
      setError(captureError(e, 'No se pudo capturar el rostro.'));
    }
  };

  const handleVerify = async () => {
    setError('');
    setPhase('working');
    try {
      await new Promise((r) => setTimeout(r, 200));
      const live = captureSample();
      const result = verifyFace(userId, live);
      if (!result.ok) {
        setPhase('ready');
        setError('Rostro no reconocido. Intente de nuevo con buena luz o use la contraseña.');
        return;
      }
      setPhase('done');
      setMessage('Identidad verificada.');
      cleanup();
      window.setTimeout(() => onSuccess(), 500);
    } catch (e) {
      setPhase('ready');
      setError(captureError(e, 'Error al verificar.'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--ely-text)' }}>
        <ScanFace className="w-4 h-4" style={{ color: 'var(--ely-accent)' }} />
        <span>{mode === 'register' ? 'Registrar rostro' : 'Acceso facial'} · {userName}</span>
      </div>

      <div
        className="relative mx-auto rounded-2xl overflow-hidden bg-black"
        style={{ width: '100%', maxWidth: 320, aspectRatio: '4/3', border: '1px solid var(--ely-border)' }}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-cover mirror"
          playsInline
          muted
          style={{ transform: 'scaleX(-1)' }}
        />
        {/* Guía oval */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="rounded-full border-2"
            style={{
              width: '58%',
              height: '72%',
              borderColor:
                phase === 'done'
                  ? 'var(--ely-success)'
                  : phase === 'error'
                    ? 'var(--ely-danger)'
                    : 'var(--ely-accent)',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
            }}
          />
        </div>
        {phase === 'permission' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--ely-accent)' }} />
            <p className="text-xs text-white/80">Permiso de cámara…</p>
          </div>
        )}
        {phase === 'done' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'var(--ely-success)' }}
            >
              <Check className="w-7 h-7 text-white" />
            </motion.div>
          </div>
        )}
      </div>

      <p className="text-[13px] text-center leading-relaxed" style={{ color: 'var(--ely-text-muted)' }}>
        {message}
      </p>

      {mode === 'register' && sampleCount > 0 && phase !== 'done' && (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: REGISTER_SAMPLES }).map((_, i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                background: i < sampleCount ? 'var(--ely-accent)' : 'var(--ely-border)',
              }}
            />
          ))}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="text-[12px] rounded-xl px-3 py-2 text-center"
          style={{
            color: 'var(--ely-danger)',
            background: 'rgba(248,81,73,0.1)',
            border: '1px solid rgba(248,81,73,0.2)',
          }}
        >
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
          className="flex-1 py-2.5 rounded-full text-sm font-medium flex items-center justify-center gap-1.5"
          style={{
            background: 'var(--ely-bg-soft)',
            color: 'var(--ely-text-muted)',
            border: '1px solid var(--ely-border)',
          }}
        >
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
        {mode === 'register' ? (
          <motion.button
            type="button"
            disabled={phase !== 'ready'}
            onClick={handleRegister}
            className="flex-1 py-2.5 rounded-full text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-45"
            style={{ background: 'var(--ely-accent)', color: '#fff' }}
            whileTap={{ scale: 0.98 }}
            transition={elyTransition.fast}
          >
            {phase === 'working' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Camera className="w-4 h-4" />
                {sampleCount >= REGISTER_SAMPLES ? 'Guardar' : 'Capturar'}
              </>
            )}
          </motion.button>
        ) : (
          <motion.button
            type="button"
            disabled={phase !== 'ready'}
            onClick={handleVerify}
            className="flex-1 py-2.5 rounded-full text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-45"
            style={{ background: 'var(--ely-accent)', color: '#fff' }}
            whileTap={{ scale: 0.98 }}
          >
            {phase === 'working' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <ScanFace className="w-4 h-4" /> Verificar
              </>
            )}
          </motion.button>
        )}
      </div>

      <p className="text-[10px] text-center" style={{ color: 'var(--ely-text-dim)' }}>
        Los datos del rostro se guardan solo en este equipo (localStorage). No se suben a internet.
      </p>
    </div>
  );
}
