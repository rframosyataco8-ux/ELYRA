import { useCallback, useEffect, useRef, useState } from 'react';

type RecognitionEvent = any;

interface UseVoiceOptions {
  onCommand?: (transcript: string) => void;
}

const isDesktop = () => typeof window !== 'undefined' && !!window.elyra?.isDesktop;

export function useVoice({ onCommand }: UseVoiceOptions = {}) {
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [naturalTts, setNaturalTts] = useState(false);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  // Check edge-tts availability on desktop
  useEffect(() => {
    if (isDesktop()) {
      window.elyra?.ttsStatus().then((s) => setNaturalTts(!!s.edgeTts));
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  /** Prefer natural neural TTS (edge-tts); fallback to best browser voice */
  const speak = useCallback(
    async (text: string) => {
      stopSpeaking();
      if (!text?.trim()) return;

      // 1) Desktop + edge-tts → natural neural voice
      if (isDesktop() && window.elyra) {
        try {
          const result = await window.elyra.ttsSpeak(text);
          if (result.ok && result.file) {
            setSpeaking(true);
            const audio = new Audio(`file://${result.file.replace(/\\/g, '/')}`);
            audioRef.current = audio;
            audio.onended = () => {
              setSpeaking(false);
              audioRef.current = null;
            };
            audio.onerror = () => {
              setSpeaking(false);
              // fallback below
              speakBrowser(text);
            };
            await audio.play();
            return;
          }
        } catch {
          // fall through to browser
        }
      }

      speakBrowser(text);
    },
    [stopSpeaking],
  );

  function speakBrowser(text: string) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 1.02;
    utterance.pitch = 1.05;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    // Prefer natural-sounding Spanish voices
    const preferred = voices.find(
      (v) =>
        /elvira|dalia|alvaro|sabina|paulina|jorge|google.*español|microsoft.*(helena|pablo|sabina)/i.test(
          v.name,
        ) && v.lang.startsWith('es'),
    )
      || voices.find((v) => v.lang.startsWith('es-ES') && /neural|natural|premium/i.test(v.name))
      || voices.find((v) => v.lang.startsWith('es-MX'))
      || voices.find((v) => v.lang.startsWith('es'))
      || null;

    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    // Chrome bug: sometimes needs a tick
    setTimeout(() => window.speechSynthesis.speak(utterance), 50);
  }

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.');
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
      if (event.error === 'no-speech') setError('No detecté ninguna voz. Intenta de nuevo.');
      else if (event.error === 'not-allowed') setError('Necesito permiso para usar el micrófono.');
      else setError('Error de reconocimiento de voz.');
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
