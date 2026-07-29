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
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [naturalTts, setNaturalTts] = useState(false);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onCommandRef = useRef(onCommand);
  const speakTokenRef = useRef(0);
  const lastSpokenRef = useRef('');
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
      voices.find((v) => /dalia|elvira|sabina|paulina|maria|laura|helena|google.*español.*femenino/i.test(v.name)) ||
      voices.find((v) => v.lang.startsWith('es-MX')) ||
      voices.find((v) => v.lang.startsWith('es-ES')) ||
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

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError('Reconocimiento de voz no disponible.');
      return;
    }
    if (recognitionRef.current) recognitionRef.current.stop();
    const recognition = new SR();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setListening(true);
      setError(null);
    };
    recognition.onresult = (event: RecognitionEvent) => {
      onCommandRef.current?.(event.results[0][0].transcript as string);
    };
    recognition.onerror = (event: RecognitionEvent) => {
      if (event.error === 'no-speech') setError('No detecté voz.');
      else if (event.error === 'not-allowed') setError('Permiso de micrófono necesario.');
      else if (event.error !== 'aborted') setError('Error de reconocimiento.');
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(!!SR && 'speechSynthesis' in window);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    return () => {
      recognitionRef.current?.stop();
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
