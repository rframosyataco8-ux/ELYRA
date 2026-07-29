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

export function useVoice({ onCommand }: UseVoiceOptions = {}) {
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [naturalTts, setNaturalTts] = useState(false);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onCommandRef = useRef(onCommand);
  const speakTokenRef = useRef(0);
  const lastSpokenRef = useRef('');
  const listeningModeRef = useRef<'whisper' | 'webspeech' | null>(null);
  onCommandRef.current = onCommand;

  useEffect(() => {
    if (isDesktop()) {
      window.elyra?.ttsStatus().then((s) => setNaturalTts(!!s.edgeTts));
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    speakTokenRef.current += 1;
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
    setSpeaking(false);
  }, []);

  function speakBrowser(text: string, token: number) {
    if (!('speechSynthesis' in window)) return;
    if (token !== speakTokenRef.current) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-MX';
    utterance.rate = 0.98;
    utterance.pitch = 1.05;
    utterance.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => /dalia|elvira|sabina|paulina|maria|laura|helena/i.test(v.name)) ||
      voices.find((v) => v.lang.startsWith('es-MX')) ||
      voices.find((v) => v.lang.startsWith('es')) ||
      null;
    if (preferred) utterance.voice = preferred;
    utterance.onstart = () => {
      if (token === speakTokenRef.current) setSpeaking(true);
    };
    utterance.onend = () => {
      if (token === speakTokenRef.current) setSpeaking(false);
    };
    utterance.onerror = () => {
      if (token === speakTokenRef.current) setSpeaking(false);
    };
    setTimeout(() => {
      if (token !== speakTokenRef.current) return;
      window.speechSynthesis.speak(utterance);
    }, 30);
  }

  const speak = useCallback(
    async (rawText: string) => {
      const text = cleanForSpeech(rawText);
      if (!text) return;
      if (text === lastSpokenRef.current && speaking) return;
      lastSpokenRef.current = text;
      stopSpeaking();
      const token = speakTokenRef.current;

      if (isDesktop() && window.elyra) {
        try {
          const result = await window.elyra.ttsSpeak(text);
          if (token !== speakTokenRef.current) return;
          if (result.ok && result.dataUrl) {
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
            setSpeaking(true);
            const audio = new Audio(result.dataUrl);
            audioRef.current = audio;
            audio.onended = () => {
              if (token === speakTokenRef.current) {
                setSpeaking(false);
                audioRef.current = null;
              }
            };
            audio.onerror = () => {
              if (token === speakTokenRef.current) {
                setSpeaking(false);
                speakBrowser(text, token);
              }
            };
            await audio.play();
            return;
          }
        } catch {}
      }
      if (token !== speakTokenRef.current) return;
      speakBrowser(text, token);
    },
    [stopSpeaking, speaking],
  );

  const stopMediaTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  };

  /**
   * Reconocimiento fiable: graba con MediaRecorder y transcribe con Whisper (Groq).
   */
  const startWhisperListening = useCallback(async () => {
    try {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este equipo no permite acceso al micrófono.');
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
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

      recorder.onstop = async () => {
        setListening(false);
        listeningModeRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        stopMediaTracks();

        if (blob.size < 800) {
          setError('No capturé audio. Mantén pulsado un segundo y habla claro.');
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
            onCommandRef.current?.(result.text);
          } else {
            setError(result.error || 'No entendí lo que dijiste. Intenta de nuevo.');
          }
        } catch (e: any) {
          setError(e?.message || 'Error al transcribir.');
        }
      };

      mediaRecorderRef.current = recorder;
      listeningModeRef.current = 'whisper';
      recorder.start();
      setListening(true);

      // Auto-stop a los 8s si el usuario no suelta
      window.setTimeout(() => {
        if (mediaRecorderRef.current === recorder && recorder.state === 'recording') {
          recorder.stop();
        }
      }, 8000);

      return true;
    } catch (e: any) {
      stopMediaTracks();
      setListening(false);
      listeningModeRef.current = null;
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        setError(
          'Permiso de micrófono denegado. En Windows: Configuración → Privacidad → Micrófono → permite a las apps de escritorio.',
        );
      } else {
        setError(e?.message || 'No pude acceder al micrófono.');
      }
      return false;
    }
  }, []);

  const startWebSpeechListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return false;

    if (recognitionRef.current) recognitionRef.current.stop();
    const recognition = new SR();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setError(null);
      listeningModeRef.current = 'webspeech';
    };
    recognition.onresult = (event: RecognitionEvent) => {
      const transcript = event.results[0][0].transcript as string;
      onCommandRef.current?.(transcript);
    };
    recognition.onerror = (event: RecognitionEvent) => {
      if (event.error === 'no-speech') setError('No detecté voz.');
      else if (event.error === 'not-allowed') setError('Permiso de micrófono necesario.');
      else if (event.error === 'network')
        setError('Reconocimiento web no disponible aquí. Usa el modo Whisper (automático en escritorio).');
      else if (event.error !== 'aborted') setError('Error de reconocimiento.');
    };
    recognition.onend = () => {
      setListening(false);
      listeningModeRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    return true;
  }, []);

  const startListening = useCallback(async () => {
    setError(null);
    // En escritorio: Whisper primero (fiable). Web Speech suele fallar en Electron.
    if (isDesktop() && window.elyra?.sttTranscribe) {
      const ok = await startWhisperListening();
      if (ok) return;
    }
    if (!startWebSpeechListening()) {
      setError('No hay reconocimiento de voz disponible.');
      setSupported(false);
    }
  }, [startWhisperListening, startWebSpeechListening]);

  const stopListening = useCallback(() => {
    if (listeningModeRef.current === 'whisper' && mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }
    recognitionRef.current?.stop();
    stopMediaTracks();
    setListening(false);
    listeningModeRef.current = null;
  }, []);

  useEffect(() => {
    // Escritorio siempre “soportado” si hay micrófono; web depende de SpeechRecognition
    if (isDesktop()) setSupported(true);
    else {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setSupported(!!SR);
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    return () => {
      recognitionRef.current?.stop();
      try {
        mediaRecorderRef.current?.stop();
      } catch {}
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
  };
}
