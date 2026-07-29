import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { processCommand } from '@/lib/commands';
import { supabase } from '@/lib/supabase';
import { ParticleField } from '@/components/ParticleField';
import { ArcReactor } from '@/components/ArcReactor';
import { ControlPanel } from '@/components/ControlPanel';
import { ConversationLog, type Message } from '@/components/ConversationLog';
import { TextInput } from '@/components/TextInput';
import { AudioVisualizer } from '@/components/AudioVisualizer';
import { SystemStats } from '@/components/SystemStats';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [booted, setBooted] = useState(false);
  const [poweredOff, setPoweredOff] = useState(false);

  const speakRef = useRef<(text: string) => void>(() => {});

  const addMessage = useCallback((role: 'user' | 'jarvis', text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, role, text, timestamp: Date.now() },
    ]);
    supabase.from('conversation_history').insert({ role, text }).then(({ error }) => {
      if (error) console.error('Error guardando mensaje:', error);
    });
  }, []);

  const handleCommand = useCallback(
    (transcript: string) => {
      addMessage('user', transcript);
      const result = processCommand(transcript);
      addMessage('jarvis', result.response);
      speakRef.current(result.response);
    },
    [addMessage],
  );

  const { speak, stopSpeaking, startListening, stopListening, speaking, listening, supported, error } =
    useVoice({ onCommand: handleCommand });

  speakRef.current = speak;

  // Load conversation history from Supabase on boot
  useEffect(() => {
    if (!booted || poweredOff) return;
    supabase
      .from('conversation_history')
      .select('id, role, text, created_at')
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data, error }) => {
        if (error) {
          console.error('Error cargando historial:', error);
          return;
        }
        if (data && data.length > 0) {
          setMessages(
            data.map((row) => ({
              id: row.id,
              role: row.role as 'user' | 'jarvis',
              text: row.text,
              timestamp: new Date(row.created_at).getTime(),
            }))
          );
        }
      });
  }, [booted, poweredOff]);

  const handleToggleListen = () => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSend = (text: string) => {
    addMessage('user', text);
    const result = processCommand(text);
    addMessage('jarvis', result.response);
    speak(result.response);
  };

  const handleShutdown = () => {
    stopSpeaking();
    stopListening();
    setPoweredOff(true);
  };

  const handleBoot = () => {
    setPoweredOff(false);
    setBooted(true);
    const bootMsg = 'Sistema iniciado. Todos los módulos operativos. Hola, señor. J.A.R.V.I.S. a su servicio.';
    addMessage('jarvis', bootMsg);
    setTimeout(() => speak(bootMsg), 300);
  };

  // Auto-boot on first load
  useEffect(() => {
    if (!booted && !poweredOff) {
      const timer = setTimeout(() => {
        setBooted(true);
        const bootMsg = 'Sistema iniciado. Todos los módulos operativos. Hola, señor. J.A.R.V.I.S. a su servicio.';
        addMessage('jarvis', bootMsg);
        setTimeout(() => speak(bootMsg), 500);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [booted, poweredOff, addMessage, speak]);

  if (poweredOff) {
    return (
      <div className="min-h-screen bg-dark-900 grid-bg flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="w-24 h-24 mx-auto rounded-full border-2 border-jarvis-500/20 flex items-center justify-center">
            <button
              onClick={handleBoot}
              className="w-16 h-16 rounded-full border-2 border-jarvis-500/40 hover:border-jarvis-glow hover:animate-glow-pulse flex items-center justify-center transition-all"
            >
              <span className="font-display text-jarvis-500 text-xs tracking-widest">ON</span>
            </button>
          </div>
          <p className="font-display text-jarvis-500/40 text-sm tracking-[0.3em] uppercase">
            Sistema Apagado
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-dark-900 grid-bg relative overflow-hidden flex flex-col">
      {/* Background glow */}
      <div className="absolute inset-0 radial-glow pointer-events-none" />
      <ParticleField active={speaking || listening} />

      {/* Scan line effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute left-0 right-0 h-px bg-jarvis-glow/20 animate-scan" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-3 border-b border-jarvis-500/15">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-jarvis-glow animate-pulse" />
          <h1 className="font-display text-lg tracking-[0.3em] text-jarvis-glow text-glow-strong">
            J.A.R.V.I.S.
          </h1>
          <span className="text-[10px] text-jarvis-500/50 tracking-widest hidden sm:inline">
            v2.0.1 — JUST A RATHER VERY INTELLIGENT SYSTEM
          </span>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-jarvis-500/60 tracking-widest uppercase">
          <span className="hidden md:inline">Sistema Operativo</span>
          <span className={`flex items-center gap-1 ${speaking || listening ? 'text-jarvis-glow' : ''}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-jarvis-glow animate-pulse" />
            {speaking ? 'TX' : listening ? 'RX' : 'IDLE'}
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0">
        {/* Left panel - System stats */}
        <aside className="hud-panel hud-corner rounded-lg p-4 lg:w-64 flex-shrink-0">
          <h2 className="font-display text-xs tracking-widest text-jarvis-500/60 uppercase mb-3">
            Estado del Sistema
          </h2>
          <SystemStats />
          <div className="mt-4 pt-4 border-t border-jarvis-500/10">
            <h3 className="font-display text-[10px] tracking-widest text-jarvis-500/50 uppercase mb-2">
              Capacidades
            </h3>
            <ul className="space-y-1.5 text-[11px] text-jarvis-300/70">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-jarvis-glow" /> Voz y escucha
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-jarvis-glow" /> Abrir sitios web
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-jarvis-glow" /> Búsqueda Google
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-jarvis-glow" /> Calculadora
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-jarvis-glow" /> Hora y fecha
              </li>
            </ul>
          </div>
        </aside>

        {/* Center - Arc reactor + visualizer */}
        <section className="flex-1 flex flex-col items-center justify-center gap-8 min-h-0">
          <ArcReactor speaking={speaking} listening={listening} />
          <AudioVisualizer active={speaking || listening} bars={32} />

          {!supported && (
            <p className="text-amber-400/70 text-xs text-center max-w-md">
              Su navegador no soporta reconocimiento de voz. Use Chrome o Edge para activar el micrófono.
              Puede seguir escribiendo comandos.
            </p>
          )}

          {error && (
            <p className="text-red-400/70 text-xs text-center max-w-md animate-fade-in">
              {error}
            </p>
          )}

          <ControlPanel
            listening={listening}
            speaking={speaking}
            onToggleListen={handleToggleListen}
            onStopSpeak={stopSpeaking}
            onShutdown={handleShutdown}
          />
        </section>

        {/* Right panel - Conversation log */}
        <aside className="hud-panel hud-corner rounded-lg p-4 lg:w-80 flex flex-col min-h-0 max-h-[40vh] lg:max-h-none">
          <h2 className="font-display text-xs tracking-widest text-jarvis-500/60 uppercase mb-3 flex-shrink-0">
            Registro de Comunicación
          </h2>
          <ConversationLog messages={messages} />
        </aside>
      </main>

      {/* Bottom - Text input */}
      <footer className="relative z-10 px-4 pb-4">
        <TextInput onSend={handleSend} disabled={poweredOff} />
      </footer>
    </div>
  );
}
