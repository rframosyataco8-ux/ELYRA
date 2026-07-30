import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Escucha continua (Web Speech) esperando la palabra de activación "Elyra".
 * Estilo JARVIS: "Elyra, ¿estás ahí?" / "Elyra abre Chrome".
 */

const WAKE_RE =
  /\b(hey\s+)?(elyra|elira|eliara|elira|hey\s+elira|oiga\s+elyra)\b/i;

function stripWake(raw: string): string {
  return String(raw || '')
    .replace(WAKE_RE, ' ')
    .replace(/[,\.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPresenceOnly(cmd: string): boolean {
  const t = cmd.toLowerCase().trim();
  if (!t) return true;
  return /^(estas ahi|estás ahí|estas alli|estás allí|me escuchas|hola|buenos dias|buenas tardes|buenas noches|oye|hey|si|sí)$/i.test(
    t,
  );
}

interface UseWakeWordOptions {
  enabled: boolean;
  busy: boolean; // hablando / pensando / grabando whisper
  onWake: (commandAfterWake: string, isPresence: boolean) => void;
}

export function useWakeWord({ enabled, busy, onWake }: UseWakeWordOptions) {
  const [active, setActive] = useState(false);
  const [lastHeard, setLastHeard] = useState('');
  const recRef = useRef<any>(null);
  const onWakeRef = useRef(onWake);
  const busyRef = useRef(busy);
  const enabledRef = useRef(enabled);
  const restartTimer = useRef<number | null>(null);
  const cooldownUntil = useRef(0);

  onWakeRef.current = onWake;
  busyRef.current = busy;
  enabledRef.current = enabled;

  const stop = useCallback(() => {
    if (restartTimer.current) {
      window.clearTimeout(restartTimer.current);
      restartTimer.current = null;
    }
    try {
      recRef.current?.stop();
    } catch {}
    recRef.current = null;
    setActive(false);
  }, []);

  const start = useCallback(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return false;

    stop();

    const rec = new SR();
    rec.lang = 'es-ES';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => setActive(true);

    rec.onresult = (event: any) => {
      if (busyRef.current) return;
      if (Date.now() < cooldownUntil.current) return;

      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal || r[0].confidence > 0.4) {
          transcript += r[0].transcript + ' ';
        }
      }
      transcript = transcript.trim();
      if (!transcript) return;

      setLastHeard(transcript);

      // Solo reaccionar en resultados finales o si ya contiene wake word clara
      const isFinal = event.results[event.results.length - 1]?.isFinal;
      const n = transcript
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      if (!WAKE_RE.test(n) && !/\belyra\b|\belira\b|\beliara\b/.test(n)) return;
      if (!isFinal && transcript.split(/\s+/).length < 2) return;

      // Evitar eco de su propia voz
      if (/sistemas online|soy elyra|configura tu api/i.test(transcript)) return;

      const cmd = stripWake(transcript);
      const presence = isPresenceOnly(cmd);

      cooldownUntil.current = Date.now() + 2500;
      onWakeRef.current(cmd, presence);
    };

    rec.onerror = (e: any) => {
      if (e.error === 'aborted' || e.error === 'no-speech') return;
      // reiniciar tras error de red temporal
      if (e.error === 'network' || e.error === 'audio-capture') {
        scheduleRestart(1500);
      }
    };

    rec.onend = () => {
      setActive(false);
      if (enabledRef.current && !busyRef.current) {
        scheduleRestart(400);
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      return true;
    } catch {
      scheduleRestart(800);
      return false;
    }
  }, [stop]);

  function scheduleRestart(ms: number) {
    if (restartTimer.current) window.clearTimeout(restartTimer.current);
    restartTimer.current = window.setTimeout(() => {
      if (enabledRef.current && !busyRef.current) start();
    }, ms);
  }

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }
    if (busy) {
      // Pausar wake mientras habla / graba
      try {
        recRef.current?.stop();
      } catch {}
      return;
    }
    start();
    return () => stop();
  }, [enabled, busy, start, stop]);

  return { active, lastHeard, start, stop };
}

export { stripWake, isPresenceOnly, WAKE_RE };
