import { useCallback, useEffect, useRef, useState } from 'react';

type RecognitionEvent = any;

interface UseVoiceOptions {
  onCommand?: (transcript: string) => void;
  continuous?: boolean;
}

const isDesktop = () => typeof window !== 'undefined' && !!window.elyra?.isDesktop;

function cleanForSpeech(text: string): string {
  if (!text) return '';
  let t = text;
  if (/rate limit|429|tokens per|TPD|org_[a-z0-9]+/i.test(t)) {
    return 'El servicio está saturado un momento. Espera e inténtalo de nuevo.';
  }
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/`([^`]+)`/g, '$1');
  t = t.replace(/\*\*?([^*]+)\*\*?/g, '$1');
  t = t.replace(/https?:\/\/\S+/g, ' un enlace ');
  t = t.replace(/[A-Za-z]:\\[^\s\]"']+/g, ' la carpeta ');
  t = t.replace(/\\+/g, ' ');
  t = t.replace(/\{[\s\S]*\}/g, ' ');
  t = t.replace(/[_|<>{}\[\]#~^]/g, ' ');
  t = t.replace(/\//g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  if (t.length > 900) {
    t = t.slice(0, 900);
    const last = t.lastIndexOf('.');
    if (last > 300) t = t.slice(0, last + 1);
  }
  return t;
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fixSpanishTranscript(raw: string) {
  let t = (raw || '').trim();
  const pairs: [RegExp, string][] = [
    [/\bwork\b/gi, 'word'],
    [/\bwuar\b/gi, 'word'],
    [/\bcrom\b/gi, 'chrome'],
    [/\bgrome\b/gi, 'chrome'],
    [/\bnot pad\b/gi, 'notepad'],
    [/\belira\b/gi, 'elyra'],
    [/\beliara\b/gi, 'elyra'],
    [/\bexcelente\b/gi, 'excel'],
    [/\byutub\b/gi, 'youtube'],
    [/\bcadmio\b/gi, 'cadmio'],
  ];
  for (const [re, rep] of pairs) t = t.replace(re, rep);
  return t;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      if (!base64) reject(new Error('Audio vacío'));
      else resolve(base64);
    };
    reader.onerror = () => reject(new Error('No pude leer el audio'));
    reader.readAsDataURL(blob);
  });
}

const VAD = {
  SILENCE_THRESHOLD: 0.011,
  SPEECH_THRESHOLD: 0.018,
  SILENCE_MS: 1200,
  MAX_RECORD_MS: 16000,
  POLL_MS: 40,
};

export function useVoice({ onCommand, continuous = false }: UseVoiceOptions = {}) {
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [naturalTts, setNaturalTts] = useState(false);
  const [amplitude, setAmplitude] = useState(0);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onCommandRef = useRef(onCommand);
  const speakTokenRef = useRef(0);
  const lastSpokenRef = useRef('');
  const lastSpokenNormRef = useRef('');
  const speakingRef = useRef(false);
  const ignoreUntilRef = useRef(0);
  const listeningModeRef = useRef<'whisper' | 'webspeech' | null>(null);
  const continuousRef = useRef(continuous);
  const maxTimerRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const levelTimerRef = useRef<number | null>(null);
  const speechStartedRef = useRef(false);
  const startListeningRef = useRef<(() => Promise<void>) | null>(null);
  const ampRafRef = useRef(0);
  const ampCtxRef = useRef<AudioContext | null>(null);
  const relistenLockRef = useRef(false);

  continuousRef.current = continuous;
  onCommandRef.current = onCommand;

  useEffect(() => {
    if (isDesktop()) window.elyra?.ttsStatus().then((s) => setNaturalTts(!!s.edgeTts));
  }, []);

  const stopMediaTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  };

  const clearTimers = () => {
    if (maxTimerRef.current) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (levelTimerRef.current) {
      window.clearInterval(levelTimerRef.current);
      levelTimerRef.current = null;
    }
  };

  const stopAmplitudeMonitor = useCallback(() => {
    if (ampRafRef.current) cancelAnimationFrame(ampRafRef.current);
    ampRafRef.current = 0;
    try {
      ampCtxRef.current?.close();
    } catch {}
    ampCtxRef.current = null;
    setAmplitude(0);
  }, []);

  const startAmplitudeMonitor = useCallback(
    (audio: HTMLAudioElement) => {
      stopAmplitudeMonitor();
      try {
        const ctx = new AudioContext();
        const source = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        ampCtxRef.current = ctx;
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          setAmplitude(Math.min(1, Math.sqrt(sum / data.length) * 4.5));
          ampRafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setAmplitude(0.35);
      }
    },
    [stopAmplitudeMonitor],
  );

  const scheduleRelisten = useCallback(() => {
    if (!continuousRef.current) return;
    if (relistenLockRef.current) return;
    relistenLockRef.current = true;
    window.setTimeout(() => {
      relistenLockRef.current = false;
      if (speakingRef.current) return;
      if (!continuousRef.current) return;
      startListeningRef.current?.();
    }, 700);
  }, []);

  const stopSpeaking = useCallback(() => {
    speakTokenRef.current += 1;
    stopAmplitudeMonitor();
    if (audioRef.current) {
      try {
        audioRef.current.onended = null;
        audioRef.current.pause();
        audioRef.current.src = '';
      } catch {}
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    speakingRef.current = false;
    setSpeaking(false);
    ignoreUntilRef.current = Date.now() + 250;
  }, [stopAmplitudeMonitor]);

  function speakBrowser(text: string, token: number) {
    if (!('speechSynthesis' in window) || token !== speakTokenRef.current) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-MX';
    utterance.rate = 0.94;
    utterance.pitch = 1.02;
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => /dalia|elvira|sabina|paulina|maria|laura|helena|ximena|renata/i.test(v.name)) ||
      voices.find((v) => v.lang.startsWith('es')) ||
      null;
    if (preferred) utterance.voice = preferred;
    utterance.onstart = () => {
      if (token === speakTokenRef.current) {
        speakingRef.current = true;
        setSpeaking(true);
        setAmplitude(0.4);
      }
    };
    utterance.onend = utterance.onerror = () => {
      if (token === speakTokenRef.current) {
        speakingRef.current = false;
        setSpeaking(false);
        setAmplitude(0);
        ignoreUntilRef.current = Date.now() + 400;
        scheduleRelisten();
      }
    };
    setTimeout(() => {
      if (token === speakTokenRef.current) window.speechSynthesis.speak(utterance);
    }, 10);
  }

  const speak = useCallback(
    async (rawText: string) => {
      const text = cleanForSpeech(rawText);
      if (!text) return;
      if (text === lastSpokenRef.current && speakingRef.current) return;
      lastSpokenRef.current = text;
      lastSpokenNormRef.current = normalize(text);

      try {
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      } catch {}
      try {
        recognitionRef.current?.stop();
      } catch {}
      stopMediaTracks();
      clearTimers();
      setListening(false);
      listeningModeRef.current = null;

      stopSpeaking();
      const token = speakTokenRef.current;
      ignoreUntilRef.current = Date.now() + 9000;

      if (isDesktop() && window.elyra) {
        try {
          const result = await window.elyra.ttsSpeak(text);
          if (token !== speakTokenRef.current) return;
          if (result.ok && result.dataUrl) {
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
            speakingRef.current = true;
            setSpeaking(true);
            const audio = new Audio(result.dataUrl);
            audio.crossOrigin = 'anonymous';
            audioRef.current = audio;
            audio.onended = () => {
              if (token === speakTokenRef.current) {
                stopAmplitudeMonitor();
                speakingRef.current = false;
                setSpeaking(false);
                audioRef.current = null;
                ignoreUntilRef.current = Date.now() + 400;
                scheduleRelisten();
              }
            };
            audio.onerror = () => {
              if (token === speakTokenRef.current) {
                stopAmplitudeMonitor();
                speakingRef.current = false;
                setSpeaking(false);
                speakBrowser(text, token);
              }
            };
            startAmplitudeMonitor(audio);
            ignoreUntilRef.current = Date.now() + 600;
            await audio.play();
            return;
          }
        } catch {}
      }
      if (token === speakTokenRef.current) speakBrowser(text, token);
    },
    [stopSpeaking, startAmplitudeMonitor, stopAmplitudeMonitor, scheduleRelisten],
  );

  const acceptTranscript = useCallback((raw: string) => {
    const text = fixSpanishTranscript((raw || '').trim());
    if (!text) return;
    if (Date.now() < ignoreUntilRef.current || speakingRef.current) return;
    const n = normalize(text);
    if (n.length < 1) return;
    const last = lastSpokenNormRef.current;
    if (last && (n === last || last.includes(n) || (n.length < 18 && last.includes(n)))) return;
    if (/^(thanks for watching|thank you|gracias por ver)/i.test(text)) return;
    setError(null);
    onCommandRef.current?.(text);
  }, []);

  /** Web Speech (sin API key) */
  const startWebSpeechListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return false;
    if (speakingRef.current) stopSpeaking();
    try {
      recognitionRef.current?.abort?.();
      recognitionRef.current?.stop?.();
    } catch {}

    const recognition = new SR();
    recognition.lang = 'es-MX';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      setListening(true);
      setError(null);
      setTranscribing(false);
      listeningModeRef.current = 'webspeech';
      setAmplitude(0.22);
    };

    recognition.onresult = (event: RecognitionEvent) => {
      const row = event.results?.[0];
      if (!row) return;
      let best = '';
      let bestScore = -1;
      for (let i = 0; i < row.length; i++) {
        const conf = row[i].confidence ?? 0.5;
        if (conf > bestScore) {
          bestScore = conf;
          best = row[i].transcript;
        }
      }
      if (best) acceptTranscript(String(best));
    };

    recognition.onerror = (event: RecognitionEvent) => {
      const code = event.error || '';
      if (code === 'no-speech' || code === 'aborted') return;
      if (code === 'not-allowed') {
        setError('Permite el micrófono en Windows → Privacidad → Micrófono.');
      } else if (code === 'network') {
        // Web Speech needs network — silent, try whisper next time
        setError(null);
      }
    };

    recognition.onend = () => {
      setListening(false);
      setAmplitude(0);
      listeningModeRef.current = null;
      scheduleRelisten();
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      return true;
    } catch {
      return false;
    }
  }, [acceptTranscript, stopSpeaking, scheduleRelisten]);

  /** Whisper vía MediaRecorder (si hay API key STT) */
  const startWhisperListening = useCallback(async () => {
    if (!isDesktop() || !window.elyra?.sttTranscribe) return false;
    try {
      if (speakingRef.current) stopSpeaking();
      setError(null);
      setTranscribing(false);
      speechStartedRef.current = false;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      mediaStreamRef.current = stream;

      const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      try {
        const ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const an = ctx.createAnalyser();
        an.fftSize = 1024;
        an.smoothingTimeConstant = 0.3;
        src.connect(an);
        const data = new Uint8Array(an.frequencyBinCount);

        levelTimerRef.current = window.setInterval(() => {
          an.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          setAmplitude(Math.min(1, rms * 6));

          if (rms >= VAD.SPEECH_THRESHOLD) {
            speechStartedRef.current = true;
            if (silenceTimerRef.current) {
              window.clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          } else if (speechStartedRef.current && rms < VAD.SILENCE_THRESHOLD && !silenceTimerRef.current) {
            silenceTimerRef.current = window.setTimeout(() => {
              try {
                if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
              } catch {}
            }, VAD.SILENCE_MS);
          }
        }, VAD.POLL_MS);
        (recorder as any)._elyraCtx = ctx;
      } catch {}

      recorder.onstop = async () => {
        clearTimers();
        setListening(false);
        setAmplitude(0);
        listeningModeRef.current = null;
        const mime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mime });
        stopMediaTracks();
        try {
          await (recorder as any)._elyraCtx?.close?.();
        } catch {}

        if (speakingRef.current) return;
        if (!blob.size || blob.size < 180) {
          scheduleRelisten();
          return;
        }

        setTranscribing(true);
        try {
          const base64 = await blobToBase64(blob);
          const result = await window.elyra!.sttTranscribe({ base64, mimeType: mime });
          setTranscribing(false);
          if (result.ok && result.text) {
            setError(null);
            acceptTranscript(result.text);
          } else if (result.fallback === 'webspeech' || result.code === 'NO_STT_KEY' || /USE_WEB_SPEECH/i.test(result.error || '')) {
            // Sin clave: reintentar con Web Speech en el próximo turno
            setError(null);
            startWebSpeechListening();
            return;
          } else if (result.error && !/USE_WEB_SPEECH/i.test(result.error)) {
            setError(result.error);
          }
          scheduleRelisten();
        } catch (e: any) {
          setTranscribing(false);
          setError(e?.message || 'Error al transcribir');
          scheduleRelisten();
        }
      };

      mediaRecorderRef.current = recorder;
      listeningModeRef.current = 'whisper';
      recorder.start(100);
      setListening(true);

      maxTimerRef.current = window.setTimeout(() => {
        try {
          if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
        } catch {}
      }, VAD.MAX_RECORD_MS);

      return true;
    } catch (e: any) {
      stopMediaTracks();
      clearTimers();
      setListening(false);
      listeningModeRef.current = null;
      const name = e?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Micrófono bloqueado. Windows → Privacidad → Micrófono.');
      } else if (name === 'NotFoundError') {
        setError('No hay micrófono detectado.');
      }
      return false;
    }
  }, [acceptTranscript, stopSpeaking, scheduleRelisten, startWebSpeechListening]);

  const startListening = useCallback(async () => {
    if (speakingRef.current || listeningModeRef.current) return;
    setError(null);

    // 1) Web Speech primero (sin API key)
    if (startWebSpeechListening()) return;

    // 2) Whisper si hay motor STT de escritorio
    if (isDesktop() && window.elyra?.sttTranscribe) {
      const ok = await startWhisperListening();
      if (ok) return;
    }

    setError('No pude activar el micrófono. Revisa permisos del sistema.');
    setSupported(false);
  }, [startWebSpeechListening, startWhisperListening]);

  startListeningRef.current = startListening;

  const stopListening = useCallback(() => {
    clearTimers();
    if (mediaRecorderRef.current?.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    mediaRecorderRef.current = null;
    try {
      recognitionRef.current?.abort?.();
      recognitionRef.current?.stop?.();
    } catch {}
    stopMediaTracks();
    setListening(false);
    setAmplitude(0);
    listeningModeRef.current = null;
  }, []);

  useEffect(() => {
    if (!isDesktop() || !window.elyra?.onBargeIn) return;
    return window.elyra.onBargeIn(() => {
      stopSpeaking();
      stopListening();
      ignoreUntilRef.current = Date.now() + 200;
      window.setTimeout(() => startListeningRef.current?.(), 250);
    });
  }, [stopSpeaking, stopListening]);

  // Solo reescucha automática si continuous está activo (icono oreja / modo escritorio)
  useEffect(() => {
    if (!continuous) return;
    const id = window.setTimeout(() => {
      if (!speakingRef.current && !listeningModeRef.current) startListeningRef.current?.();
    }, 800);
    return () => clearTimeout(id);
  }, [continuous]);

  useEffect(() => {
    setSupported(true);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {}
      try {
        mediaRecorderRef.current?.stop?.();
      } catch {}
      clearTimers();
      stopMediaTracks();
      stopSpeaking();
    };
  }, [stopSpeaking]);

  return {
    speak,
    stopSpeaking,
    startListening,
    stopListening,
    speaking,
    listening,
    transcribing,
    supported,
    error,
    naturalTts,
    amplitude,
  };
}
