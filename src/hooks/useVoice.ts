import { useCallback, useEffect, useRef, useState } from 'react';

type RecognitionEvent = any;

interface UseVoiceOptions {
  onCommand?: (transcript: string) => void;
}

const isDesktop = () => typeof window !== 'undefined' && !!window.elyra?.isDesktop;

/** Limpieza en el cliente (por si llega texto crudo) */
function cleanForSpeech(text: string): string {
  if (!text) return '';
  let t = text;
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/`([^`]+)`/g, '$1');
  t = t.replace(/\*\*?([^*]+)\*\*?/g, '$1');
  t = t.replace(/https?:\/\/\S+/g, ' un enlace ');
  t = t.replace(/[A-Za-z]:\\[^\s\]"']+/g, ' la carpeta de documentos ');
  t = t.replace(/\\+/g, ' ');
  t = t.replace(/\/(?:Users|home|Documents|Informes)\S*/gi, ' la ruta del archivo ');
  t = t.replace(/[_|<>{}\[\]#~^]/g, ' ');
  t = t.replace(/\//g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  if (t.length > 1200) {
    t = t.slice(0, 1200);
    const last = t.lastIndexOf('.');
    if (last > 400) t = t.slice(0, last + 1);
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
  const speakTokenRef = useRef(0); // evita solapar / dobles
  const lastSpokenRef = useRef(''); // evita repetir el mismo texto seguido
  onCommandRef.current = onCommand;

  useEffect(() => {
    if (isDesktop()) {
      window.elyra?.ttsStatus().then((s) => setNaturalTts(!!s.edgeTts));
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    speakTokenRef.current += 1; // invalida speaks en curso
    if (audioRef.current) {
      try {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current.src = '';
      } catch {}
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  function speakBrowser(text: string, token: number) {
    if (!('speechSynthesis' in window)) return;
    if (token !== speakTokenRef.current) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    // Estilo JARVIS: más pausado, tono estable
    utterance.rate = 0.92;
    utterance.pitch = 0.85;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    // Preferir voces masculinas españolas
    const preferred =
      voices.find((v) => /alvaro|jorge|pablo|diego|miguel/i.test(v.name) && v.lang.startsWith('es')) ||
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

  /**
   * Habla UNA sola vez, UNA sola voz, texto limpio.
   * Cancela cualquier audio anterior.
   */
  const speak = useCallback(
    async (rawText: string) => {
      const text = cleanForSpeech(rawText);
      if (!text) return;

      // Evitar repetir exactamente lo mismo en menos de 2s
      if (text === lastSpokenRef.current && speaking) return;
      lastSpokenRef.current = text;

      // Cancelar todo lo anterior y reservar token nuevo
      stopSpeaking();
      const token = speakTokenRef.current;

      // Desktop + edge-tts (voz fija Álvaro)
      if (isDesktop() && window.elyra) {
        try {
          const result = await window.elyra.ttsSpeak(text);
          // Si mientras esperábamos se pidió otro speak, abortar
          if (token !== speakTokenRef.current) return;

          if (result.ok && result.dataUrl) {
            // Asegurar que speechSynthesis no hable nunca en paralelo
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
                // Solo fallback si sigue siendo el speak actual
                speakBrowser(text, token);
              }
            };
            await audio.play();
            return; // NO llamar a speakBrowser si tuvo éxito
          }
        } catch {
          // fallback abajo
        }
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
      const transcript = event.results[0][0].transcript as string;
      onCommandRef.current?.(transcript);
    };

    recognition.onerror = (event: RecognitionEvent) => {
      if (event.error === 'no-speech') setError('No detecté voz. Intenta de nuevo.');
      else if (event.error === 'not-allowed') setError('Permiso de micrófono necesario.');
      else if (event.error !== 'aborted') setError('Error de reconocimiento de voz.');
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
