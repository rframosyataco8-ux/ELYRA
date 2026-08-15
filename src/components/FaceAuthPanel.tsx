import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ScanFace, Check, X } from 'lucide-react';
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

const REGISTER_SAMPLES = 4;
const VERIFY_SAMPLES = 5;

export function FaceAuthPanel({ userId, userName, mode, onSuccess, onCancel }: FaceAuthPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samplesRef = useRef<number[][]>([]);
  const lastBoxRef = useRef<{ x: number; y: number; width: number; height: number } | undefined>();
  const scanningRef = useRef(false);

  const [phase, setPhase] = useState<'permission' | 'ready' | 'scanning' | 'done' | 'error'>('permission');
  const [message, setMessage] = useState('Solicitando permiso de cámara…');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);

  const cleanup = useCallback(() => {
    scanningRef.current = false;
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
            ? 'Mire a la cámara. El sistema escaneará su rostro en varios fotogramas.'
            : 'Centre el rostro. Se realizará un escaneo continuo para verificar identidad.',
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

  /** Escaneo real: varias capturas en el tiempo, no una sola foto */
  const runScan = async () => {
    if (scanningRef.current) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      setError('La cámara aún no está lista.');
      return;
    }

    scanningRef.current = true;
    setError('');
    setConfidence(null);
    setPhase('scanning');
    samplesRef.current = [];
    setProgress(0);

    const total = mode === 'register' ? REGISTER_SAMPLES : VERIFY_SAMPLES;

    try {
      for (let i = 0; i < total; i++) {
        if (!scanningRef.current) return;
        setMessage(
          mode === 'register'
            ? `Escaneando rostro… muestra ${i + 1}/${total}`
            : `Verificando identidad… lectura ${i + 1}/${total}`,
        );
        setProgress(Math.round(((i + 0.35) / total) * 100));

        // pequeña variación temporal (movimiento natural)
        await new Promise((r) => setTimeout(r, 280 + i * 40));

        const { descriptor, box } = await extractDescriptorFromVideo(video);
        lastBoxRef.current = box;
        samplesRef.current.push(descriptor);
        setProgress(Math.round(((i + 1) / total) * 100));
      }

      if (mode === 'register') {
        const thumb = captureThumbFromVideo(video, lastBoxRef.current);
        registerFace(userId, samplesRef.current, thumb);
        setPhase('done');
        setMessage('Rostro registrado con escaneo multi-fotograma.');
        cleanup();
        window.setTimeout(() => onSuccess(), 650);
        return;
      }

      // Verificación: mayoría de lecturas deben coincidir
      const results = samplesRef.current.map((d) => verifyFace(userId, d));
      const okCount = results.filter((r) => r.ok).length;
      const avgConf = Math.round(
        results.reduce((a, r) => a + r.confidence, 0) / Math.max(1, results.length),
      );
      setConfidence(avgConf);

      if (okCount < Math.ceil(total * 0.6)) {
        setPhase('ready');
        setProgress(0);
        setError(
          `Rostro no reconocido (confianza ${avgConf}%). Mejore la luz o use el PIN.`,
        );
        scanningRef.current = false;
        return;
      }

      setPhase('done');
      setMessage(`Identidad verificada · confianza ${avgConf}%`);
      cleanup();
      window.setTimeout(() => onSuccess(), 550);
    } catch (e) {
      setPhase('ready');
      setProgress(0);
      setError(captureError(e, 'Error durante el escaneo facial.'));
      scanningRef.current = false;
    }
  };

  return (
    <div className="space-y-3.5">
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
          boxShadow: '0 0 28px rgba(56,180,255,0.12)',
        }}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Malla de landmarks en vivo */}
        {(phase === 'ready' || phase === 'scanning') && (
          <FaceMeshOverlay videoRef={videoRef} active mirrored />
        )}

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

        {phase === 'scanning' && (
          <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 pt-6 bg-gradient-to-t from-black/80 to-transparent">
            <div className="h-1 rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg,#0369a1,#38bdf8)',
                }}
              />
            </div>
            <p className="text-[10px] text-center text-sky-100/80 mt-1.5 tabular-nums">
              Escaneando {progress}%
            </p>
          </div>
        )}
      </div>

      <p className="text-[13px] text-center leading-relaxed text-sky-100/55">{message}</p>

      {confidence != null && phase !== 'done' && (
        <p className="text-[11px] text-center text-sky-200/70">Confianza: {confidence}%</p>
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
        <button
          type="button"
          disabled={phase !== 'ready'}
          onClick={runScan}
          className="flex-1 py-2.5 rounded-full text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-45 text-white"
          style={{ background: 'linear-gradient(90deg,#0c5ebd,#38bdf8)' }}
        >
          {phase === 'scanning' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <ScanFace className="w-4 h-4" />
              {mode === 'register' ? 'Iniciar escaneo' : 'Escanear y verificar'}
            </>
          )}
        </button>
      </div>

      <p className="text-[10px] text-center text-sky-100/28">
        Escaneo multi-fotograma local · malla facial en vivo · datos solo en este equipo
      </p>
    </div>
  );
}
