import { useCallback, useEffect, useRef, useState } from 'react';

type RecognitionEvent = any;

interface UseVoiceOptions {
  onCommand?: (transcript: string) => void;
  /** Si true, reabre el mic tras hablar (conversación continua) */
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

export function useVoice({ onCommand, continuous = false }: UseVoiceOptions = {}) {
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [naturalTts, setNaturalTts] = useState(false);
  const [amplitude, setAmplitude] = useState(0);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onCommandRef = useRef(onCommand);
  const speakTokenRef = useRef(0);
  const lastSpokenRef = useRef('');
  const lastSpokenNormRef = useRef('');
  const speakingRef = useRef(false);
  const ignoreUntilRef = useRef(0);
  const listeningModeRef = useRef<'webspeech' | null>(null);
  const continuousRef = useRef(continuous);
  const wantListenRef = useRef(false);
  const startListeningRef = useRef<(() => Promise<void>) | null>(null);
  const ampRafRef = useRef(0);
  const ampCtxRef = useRef<AudioContext | null>(null);

  continuousRef.current = continuous;
  onCommandRef.current = onCommand;

  useEffect(() => {
    if (isDesktop()) window.elyra?.ttsStatus().then((s) => setNaturalTts(!!s.edgeTts));
  }, []);

  useEffect(() => {
    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => stream.getTracks().forEach((t) => t.stop()))
      .catch(() => {});
  }, []);

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
    if (!continuousRef.current && !wantListenRef.current) return;
    window.setTimeout(() => {
      if (speakingRef.current) return;
      startListeningRef.current?.();
    }, 450);
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
        ignoreUntilRef.current = Date.now() + 350;
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
        recognitionRef.current?.stop();
      } catch {}
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
                ignoreUntilRef.current = Date.now() + 320;
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

  /** Web Speech — sin API key. continuous = conversación natural */
  const startWebSpeechListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return false;
    if (speakingRef.current) stopSpeaking();
    try {
      recognitionRef.current?.stop();
    } catch {}

    const recognition = new SR();
    recognition.lang = 'es-MX';
    recognition.continuous = !!continuousRef.current;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      setListening(true);
      setError(null);
      setTranscribing(false);
      listeningModeRef.current = 'webspeech';
      setAmplitude(0.25);
    };

    recognition.onresult = (event: RecognitionEvent) => {
      const results = event.results;
      if (!results || !results.length) return;
      // Último resultado final
      for (let i = event.resultIndex; i < results.length; i++) {
        if (!results[i].isFinal && continuousRef.current) continue;
        let best = '';
        let bestScore = -1;
        const row = results[i];
        for (let j = 0; j < row.length; j++) {
          const conf = row[j].confidence ?? 0.5;
          if (conf > bestScore) {
            bestScore = conf;
            best = row[j].transcript;
          }
        }
        if (best) acceptTranscript(String(best));
      }
    };

    recognition.onerror = (event: RecognitionEvent) => {
      const code = event.error || '';
      if (code === 'no-speech') {
        // En modo continuo no molestar
        if (!continuousRef.current) setError('No detecté voz. Habla cuando el mic esté activo.');
      } else if (code === 'not-allowed') {
        setError('Permiso de micrófono necesario en Windows → Privacidad → Micrófono.');
      } else if (code === 'network') {
        setError('Reconocimiento de voz necesita internet (Web Speech).');
      } else if (code !== 'aborted') {
        setError('Mic: ' + code);
      }
    };

    recognition.onend = () => {
      setListening(false);
      setAmplitude(0);
      listeningModeRef.current = null;
      // Reabrir en conversación continua si no estamos hablando
      if ((continuousRef.current || wantListenRef.current) && !speakingRef.current) {
        window.setTimeout(() => {
          if (!speakingRef.current && (continuousRef.current || wantListenRef.current)) {
            try {
              recognition.start();
            } catch {
              startListeningRef.current?.();
            }
          }
        }, 280);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      return true;
    } catch {
      return false;
    }
  }, [acceptTranscript, stopSpeaking]);

  const startListening = useCallback(async () => {
    setError(null);
    wantListenRef.current = true;
    // 1.7: Web Speech PRIMERO (sin API key)
    if (startWebSpeechListening()) return;
    setError(
      'Tu sistema no expone reconocimiento de voz. En Electron/Chromium debería estar disponible. Revisa permisos de micrófono.',
    );
    setSupported(false);
  }, [startWebSpeechListening]);

  startListeningRef.current = startListening;

  const stopListening = useCallback(() => {
    wantListenRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {}
    setListening(false);
    setAmplitude(0);
    listeningModeRef.current = null;
  }, []);

  useEffect(() => {
    if (!isDesktop() || !window.elyra?.onBargeIn) return;
    return window.elyra.onBargeIn(() => {
      stopSpeaking();
      stopListening();
      wantListenRef.current = true;
      ignoreUntilRef.current = Date.now() + 180;
      window.setTimeout(() => startListeningRef.current?.(), 220);
    });
  }, [stopSpeaking, stopListening]);

  // Activar escucha continua cuando continuous pasa a true
  useEffect(() => {
    if (continuous) {
      wantListenRef.current = true;
      if (!speakingRef.current && !listening) {
        startListeningRef.current?.();
      }
    }
  }, [continuous, listening]);

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
