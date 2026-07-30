import { useCallback, useEffect, useRef, useState } from 'react';

type RecognitionEvent = any;

interface UseVoiceOptions {
  onCommand?: (transcript: string) => void;
}

const isDesktop = () => typeof window !== 'undefined' && !!window.elyra?.isDesktop;

function cleanForSpeech(text: string): string {
  if (!text) return '';
  let t = text;
  if (/rate limit|429|tokens per|TPD|org_[a-z0-9]+/i.test(t)) {
    return 'El servicio de inteligencia está saturado un momento. Espera un poco y vuelve a intentarlo.';
  }
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/`([^`]+)`/g, '$1');
  t = t.replace(/\*\*?([^*]+)\*\*?/g, '$1');
  t = t.replace(/https?:\/\/\S+/g, ' un enlace ');
  t = t.replace(/[A-Za-z]:\\[^\s\]"']+/g, ' la carpeta de documentos ');
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
    [/\bbloc de nota\b/gi, 'bloc de notas'],
    [/\bvs code\b/gi, 'code'],
    [/\belira\b/gi, 'elyra'],
    [/\bhazme\b/gi, 'hazme'],
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

export function useVoice({ onCommand }: UseVoiceOptions = {}) {
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
  const listeningModeRef = useRef<'whisper' | 'webspeech' | 'python' | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const ampRafRef = useRef(0);
  const ampCtxRef = useRef<AudioContext | null>(null);
  const ampAnalyserRef = useRef<AnalyserNode | null>(null);
  const levelTimerRef = useRef<number | null>(null);
  const speechStartedRef = useRef(false);
  onCommandRef.current = onCommand;

  useEffect(() => {
    if (isDesktop()) window.elyra?.ttsStatus().then((s) => setNaturalTts(!!s.edgeTts));
  }, []);

  useEffect(() => {
    if (!isDesktop()) return;
    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
      })
      .catch(() => {});
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
    if (ampRafRef.current) {
      cancelAnimationFrame(ampRafRef.current);
      ampRafRef.current = 0;
    }
    try {
      ampCtxRef.current?.close();
    } catch {}
    ampCtxRef.current = null;
    ampAnalyserRef.current = null;
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
        ampAnalyserRef.current = analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!ampAnalyserRef.current) return;
          ampAnalyserRef.current.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const level = Math.min(1, Math.sqrt(sum / data.length) * 4.5);
          setAmplitude((prev) => prev * 0.55 + level * 0.45);
          ampRafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setAmplitude(0.35);
      }
    },
    [stopAmplitudeMonitor],
  );

  const stopSpeaking = useCallback(() => {
    speakTokenRef.current += 1;
    stopAmplitudeMonitor();
    if (audioRef.current) {
      try {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current.src = '';
      } catch {}
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    speakingRef.current = false;
    setSpeaking(false);
    ignoreUntilRef.current = Date.now() + 900;
  }, [stopAmplitudeMonitor]);

  function speakBrowser(text: string, token: number) {
    if (!('speechSynthesis' in window) || token !== speakTokenRef.current) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-MX';
    utterance.rate = 0.98;
    utterance.pitch = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => /dalia|elvira|sabina|paulina|maria|laura|helena/i.test(v.name)) ||
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
        ignoreUntilRef.current = Date.now() + 1200;
      }
    };
    setTimeout(() => {
      if (token === speakTokenRef.current) window.speechSynthesis.speak(utterance);
    }, 30);
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
      recognitionRef.current?.stop();
      stopMediaTracks();
      clearTimers();
      setListening(false);
      listeningModeRef.current = null;

      stopSpeaking();
      const token = speakTokenRef.current;
      ignoreUntilRef.current = Date.now() + 60000;

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
                ignoreUntilRef.current = Date.now() + 1400;
              }
            };
            audio.onerror = () => {
              if (token === speakTokenRef.current) {
                stopAmplitudeMonitor();
                speakingRef.current = false;
                setSpeaking(false);
                ignoreUntilRef.current = Date.now() + 800;
                speakBrowser(text, token);
              }
            };
            startAmplitudeMonitor(audio);
            await audio.play();
            return;
          }
        } catch {}
      }
      if (token === speakTokenRef.current) speakBrowser(text, token);
    },
    [stopSpeaking, startAmplitudeMonitor, stopAmplitudeMonitor],
  );

  const acceptTranscript = useCallback((raw: string) => {
    const text = fixSpanishTranscript((raw || '').trim());
    if (!text) return;
    if (Date.now() < ignoreUntilRef.current || speakingRef.current) return;
    const n = normalize(text);
    const last = lastSpokenNormRef.current;
    if (last) {
      if (n === last || last.includes(n) || (n.length < 18 && last.includes(n))) return;
    }
    if (/^(thanks for watching|thank you|gracias por ver|subtitles by)/i.test(text)) return;
    onCommandRef.current?.(text);
  }, []);

  /**
   * Grabación con VAD ligero:
   * - Auto-corte tras ~1.4s de silencio una vez detectó voz
   * - Máximo 12s
   * - Segundo clic sigue detiene al instante
   * Listo para modo continuo (App relanza con elyra-relisten)
   */
  const startWhisperListening = useCallback(async () => {
    try {
      if (speakingRef.current) {
        setError('Espera a que termine de hablar (o Ctrl+Espacio).');
        return false;
      }
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
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      mediaStreamRef.current = stream;

      const mimeCandidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      // Nivel + VAD (silencio)
      try {
        const ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        const data = new Uint8Array(an.frequencyBinCount);
        const SILENCE_THRESHOLD = 0.018;
        const SPEECH_THRESHOLD = 0.035;
        const SILENCE_MS = 1400;

        levelTimerRef.current = window.setInterval(() => {
          an.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          setAmplitude(Math.min(1, rms * 5));

          if (rms >= SPEECH_THRESHOLD) {
            speechStartedRef.current = true;
            if (silenceTimerRef.current) {
              window.clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          } else if (speechStartedRef.current && rms < SILENCE_THRESHOLD && !silenceTimerRef.current) {
            silenceTimerRef.current = window.setTimeout(() => {
              try {
                if (mediaRecorderRef.current?.state === 'recording') {
                  mediaRecorderRef.current.stop();
                }
              } catch {}
            }, SILENCE_MS);
          }
        }, 60);
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
          const ctx = (recorder as any)._elyraCtx as AudioContext | undefined;
          await ctx?.close();
        } catch {}

        if (speakingRef.current) return;

        if (!blob.size || blob.size < 400) {
          setError('No se grabó audio. Revisa el micrófono en Windows → Privacidad → Micrófono.');
          return;
        }

        setTranscribing(true);
        setError(null);
        try {
          const base64 = await blobToBase64(blob);
          if (!window.elyra?.sttTranscribe) {
            setError('STT no disponible. Reinicia la app de escritorio.');
            setTranscribing(false);
            return;
          }
          const result = await window.elyra.sttTranscribe({
            base64,
            mimeType: mime,
          });
          setTranscribing(false);
          if (result.ok && result.text) {
            setError(null);
            acceptTranscript(result.text);
          } else {
            const err = result.error || 'No entendí. Habla más cerca y prueba otra vez.';
            if (/api key|sin api/i.test(err)) {
              setError('Falta API key de Groq en %USERPROFILE%\\.elyra\\config.json');
            } else if (/429|límite/i.test(err)) {
              setError('Límite de voz de Groq. Espera 20–30 s.');
            } else {
              setError(err);
            }
          }
        } catch (e: any) {
          setTranscribing(false);
          setError(e?.message || 'Error al transcribir. Revisa internet y la API key.');
        }
      };

      mediaRecorderRef.current = recorder;
      listeningModeRef.current = 'whisper';
      recorder.start(250);
      setListening(true);

      maxTimerRef.current = window.setTimeout(() => {
        try {
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        } catch {}
      }, 12000);

      return true;
    } catch (e: any) {
      stopMediaTracks();
      clearTimers();
      setListening(false);
      listeningModeRef.current = null;
      const name = e?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError(
          'Micrófono bloqueado. Windows → Configuración → Privacidad → Micrófono → permitir apps de escritorio.',
        );
      } else if (name === 'NotFoundError') {
        setError('No hay micrófono detectado en este PC.');
      } else {
        setError(e?.message || 'No pude acceder al micrófono.');
      }
      return false;
    }
  }, [acceptTranscript]);

  const startPythonListening = useCallback(async () => {
    if (!window.elyra?.sttListenPython) return false;
    try {
      setError(null);
      setListening(true);
      setTranscribing(false);
      listeningModeRef.current = 'python';
      const result = await window.elyra.sttListenPython(6);
      setListening(false);
      listeningModeRef.current = null;
      if (result.ok && result.text) {
        acceptTranscript(result.text);
        return true;
      }
      setError(result.error || 'No entendí con el motor Python.');
      return false;
    } catch (e: any) {
      setListening(false);
      listeningModeRef.current = null;
      setError(e?.message || 'Error STT Python');
      return false;
    }
  }, [acceptTranscript]);

  const startWebSpeechListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || speakingRef.current) return false;
    try {
      if (recognitionRef.current) recognitionRef.current.stop();
    } catch {}
    const recognition = new SR();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognition.onstart = () => {
      setListening(true);
      setError(null);
      listeningModeRef.current = 'webspeech';
    };
    recognition.onresult = (event: RecognitionEvent) => {
      const t = event.results?.[0]?.[0]?.transcript;
      if (t) acceptTranscript(String(t));
    };
    recognition.onerror = (event: RecognitionEvent) => {
      const code = event.error || '';
      if (code === 'no-speech') setError('No detecté voz. Habla al pulsar el mic.');
      else if (code === 'not-allowed') setError('Permiso de micrófono necesario.');
      else if (code === 'network') setError('Web Speech necesita red. Usa el modo escritorio con Whisper.');
      else if (code !== 'aborted') setError(`Reconocimiento: ${code}`);
    };
    recognition.onend = () => {
      setListening(false);
      listeningModeRef.current = null;
    };
    recognitionRef.current = recognition;
    recognition.start();
    return true;
  }, [acceptTranscript]);

  const startListening = useCallback(async () => {
    setError(null);
    if (speakingRef.current) {
      setError('Espera a que termine de hablar.');
      return;
    }
    if (isDesktop() && window.elyra?.sttTranscribe) {
      const ok = await startWhisperListening();
      if (ok) return;
      return;
    }
    if (isDesktop() && window.elyra?.sttListenPython) {
      const ok = await startPythonListening();
      if (ok) return;
    }
    if (!startWebSpeechListening()) {
      setError('No hay reconocimiento de voz disponible.');
      setSupported(false);
    }
  }, [startWhisperListening, startPythonListening, startWebSpeechListening]);

  const stopListening = useCallback(() => {
    clearTimers();
    if (mediaRecorderRef.current?.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      return;
    }
    mediaRecorderRef.current = null;
    try {
      recognitionRef.current?.stop();
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
    });
  }, [stopSpeaking, stopListening]);

  useEffect(() => {
    setSupported(true);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
      try {
        mediaRecorderRef.current?.stop();
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
