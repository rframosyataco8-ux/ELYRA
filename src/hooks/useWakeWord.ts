import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Wake word continuo — "Elyra" / variantes de STT español.
 * Robusto ante reinicios, eco y falsos positivos.
 */

const WAKE_RE =
  /\b(hey\s+|oiga\s+|oye\s+)?(elyra|elira|eliara|elira|elira|heira|heira|elera|el ara|eli ra)\b/i;

function stripWake(raw: string): string {
  return String(raw || '')
    .replace(WAKE_RE, ' ')
    .replace(/\b(hey|oiga|oye)\b/gi, ' ')
    .replace(/[,.!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPresenceOnly(cmd: string): boolean {
  const t = cmd.toLowerCase().trim();
  if (!t) return true;
  return /^(estas ahi|estás ahí|estas alli|estás allí|me escuchas|hola|buenos dias|buenas tardes|buenas noches|oye|hey|si|sí|ok|okay)$/i.test(
    t,
  );
}

function normalizeSpeak(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface UseWakeWordOptions {
  enabled: boolean;
  busy: boolean;
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
  const startingRef = useRef(false);

  onWakeRef.current = onWake;
  busyRef.current = busy;
  enabledRef.current = enabled;

  const stop = useCallback(() => {
    if (restartTimer.current) {
      window.clearTimeout(restartTimer.current);
      restartTimer.current = null;
    }
    try {
      recRef.current?.abort?.();
    } catch {}
    try {
      recRef.current?.stop?.();
    } catch {}
    recRef.current = null;
    startingRef.current = false;
    setActive(false);
  }, []);

  const scheduleRestart = useCallback((ms: number) => {
    if (restartTimer.current) window.clearTimeout(restartTimer.current);
    restartTimer.current = window.setTimeout(() => {
      if (enabledRef.current && !busyRef.current) startInternal();
    }, ms);
  }, []);

  const startInternal = () => {
    if (!enabledRef.current || busyRef.current) return false;
    if (startingRef.current) return false;

    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return false;

    startingRef.current = true;
    try {
      recRef.current?.abort?.();
    } catch {}
    try {
      recRef.current?.stop?.();
    } catch {}

    const rec = new SR();
    rec.lang = 'es-ES';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      startingRef.current = false;
      setActive(true);
    };

    rec.onresult = (event: any) => {
      if (busyRef.current) return;
      if (Date.now() < cooldownUntil.current) return;

      let transcript = '';
      let anyFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const alt = r[0]?.transcript || '';
        if (r.isFinal) {
          anyFinal = true;
          transcript += alt + ' ';
        } else if ((r[0]?.confidence ?? 0.5) > 0.35) {
          transcript += alt + ' ';
        }
      }
      transcript = transcript.trim();
      if (!transcript) return;

      setLastHeard(transcript);
      const n = normalizeSpeak(transcript);

      const hasWake =
        WAKE_RE.test(n) ||
        /\b(elyra|elira|eliara|elera|heira)\b/.test(n) ||
        /\bel\s*ira\b/.test(n);

      if (!hasWake) return;

      const words = transcript.split(/\s+/).length;
      if (!anyFinal && words < 2) return;

      if (
        /sistemas operativos|estoy a su disposicion|buenos dias|buenas tardes|buenas noches|soy elyra|configura|api key/i.test(
          transcript,
        )
      ) {
        return;
      }

      const cmd = stripWake(transcript);
      const presence = isPresenceOnly(cmd);

      cooldownUntil.current = Date.now() + 2800;
      onWakeRef.current(cmd, presence);
    };

    rec.onerror = (e: any) => {
      startingRef.current = false;
      const err = e?.error || '';
      if (err === 'aborted' || err === 'no-speech') return;
      if (err === 'network' || err === 'audio-capture' || err === 'not-allowed') {
        scheduleRestart(err === 'not-allowed' ? 4000 : 1600);
      }
    };

    rec.onend = () => {
      startingRef.current = false;
      setActive(false);
      if (enabledRef.current && !busyRef.current) {
        scheduleRestart(350);
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      return true;
    } catch {
      startingRef.current = false;
      scheduleRestart(900);
      return false;
    }
  };

  const start = useCallback(() => startInternal(), [stop, scheduleRestart]);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }
    if (busy) {
      try {
        recRef.current?.stop?.();
      } catch {}
      return;
    }
    startInternal();
    return () => stop();
  }, [enabled, busy]);

  return { active, lastHeard, start, stop };
}

export { stripWake, isPresenceOnly, WAKE_RE };
