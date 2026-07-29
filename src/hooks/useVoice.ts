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

export function useVoice({ onCommand }: UseVoiceOptions = {}) {
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
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
  const vadTimerRef = useRef<number | null>(null);
  const ampRafRef = useRef<number>(0);
  const ampCtxRef = useRef<AudioContext | null>(null);
  const ampAnalyserRef = useRef<AnalyserNode | null>(null);
  onCommandRef.current = onCommand;

  useEffect(() => {
    if (isDesktop()) window.elyra?.ttsStatus().then((s) => setNaturalTts(!!s.edgeTts));
  }, []);

  const stopMediaTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
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
          const rms = Math.sqrt(sum / data.length);
          // Suavizar 0–1
          const level = Math.min(1, rms * 4.5);
          setAmplitude((prev) => prev * 0.55 + level * 0.45);
          ampRafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        // Algunos entornos bloquean createMediaElementSource si el audio ya suena
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
            // Monitor ANTES de play para capturar el stream
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
    const text = (raw || '').trim();
    if (!text) return;
    if (Date.now() < ignoreUntilRef.current || speakingRef.current) return;
    const n = normalize(text);
    const last = lastSpokenNormRef.current;
    if (last) {
      if (n === last || last.includes(n) || (n.length < 18 && last.includes(n))) return;
    }
    onCommandRef.current?.(text);
  }, []);

  const startWhisperListening = useCallback(async () => {
    try {
      if (speakingRef.current || Date.now() < ignoreUntilRef.current - 400) {
        setError('Espera a que termine de hablar.');
        return false;
      }
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      mediaStreamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);

      const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data?.size) chunksRef.current.push(e.data);
      };

      let speechStarted = false;
      let silenceMs = 0;
      let totalMs = 0;
      const TICK = 80;
      const SPEECH_THRESHOLD = 12;
      const SILENCE_TO_STOP = 900;
      const MAX_MS = 7000;
      const MIN_SPEECH_MS = 350;

      const finish = () => {
        if (vadTimerRef.current) {
          window.clearInterval(vadTimerRef.current);
          vadTimerRef.current = null;
        }
        try {
          if (recorder.state === 'recording') recorder.stop();
        } catch {}
        try {
          audioCtx.close();
        } catch {}
      };

      recorder.onstop = async () => {
        setListening(false);
        listeningModeRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        stopMediaTracks();
        if (speakingRef.current || Date.now() < ignoreUntilRef.current) return;
        if (!speechStarted || blob.size < 1500) {
          setError('No capturé tu voz. Habla un poco más fuerte y cerca del micrófono.');
          return;
        }
        try {
          const buffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);
          const result = await window.elyra!.sttTranscribe({
            base64,
            mimeType: blob.type || 'audio/webm',
          });
          if (result.ok && result.text) {
            setError(null);
            acceptTranscript(result.text);
          } else {
            setError(result.error || 'No entendí. Intenta de nuevo.');
          }
        } catch (e: any) {
          setError(e?.message || 'Error al transcribir.');
        }
      };

      mediaRecorderRef.current = recorder;
      listeningModeRef.current = 'whisper';
      recorder.start(200);
      setListening(true);

      vadTimerRef.current = window.setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length) * 100;
        totalMs += TICK;
        if (rms > SPEECH_THRESHOLD) {
          speechStarted = true;
          silenceMs = 0;
        } else if (speechStarted) {
          silenceMs += TICK;
        }
        if (speechStarted && silenceMs >= SILENCE_TO_STOP && totalMs > MIN_SPEECH_MS + SILENCE_TO_STOP) finish();
        else if (totalMs >= MAX_MS) finish();
      }, TICK);

      return true;
    } catch (e: any) {
      stopMediaTracks();
      setListening(false);
      listeningModeRef.current = null;
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        setError('Permiso de micrófono denegado. Actívalo en Windows → Privacidad → Micrófono.');
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
      listeningModeRef.current = 'python';
      const result = await window.elyra.sttListenPython(5);
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
      setError(e?.message || 'Error en STT Python');
      return false;
    }
  }, [acceptTranscript]);

  const startWebSpeechListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || speakingRef.current) return false;
    if (recognitionRef.current) recognitionRef.current.stop();
    const recognition = new SR();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => {
      setListening(true);
      setError(null);
      listeningModeRef.current = 'webspeech';
    };
    recognition.onresult = (event: RecognitionEvent) => {
      acceptTranscript(event.results[0][0].transcript as string);
    };
    recognition.onerror = (event: RecognitionEvent) => {
      if (event.error === 'no-speech') setError('No detecté voz.');
      else if (event.error === 'not-allowed') setError('Permiso de micrófono necesario.');
      else if (event.error !== 'aborted') setError('Error de reconocimiento.');
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
    if (vadTimerRef.current) {
      window.clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    mediaRecorderRef.current = null;
    recognitionRef.current?.stop();
    stopMediaTracks();
    setListening(false);
    listeningModeRef.current = null;
  }, []);

  // Barge-in global (Ctrl+Espacio desde main)
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
      recognitionRef.current?.stop();
      try {
        mediaRecorderRef.current?.stop();
      } catch {}
      if (vadTimerRef.current) window.clearInterval(vadTimerRef.current);
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
    supported,
    error,
    naturalTts,
    amplitude,
  };
}
