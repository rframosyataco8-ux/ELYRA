import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { processCommand } from '@/lib/commands';
import { NetworkGlobe } from '@/components/NetworkGlobe';
import { Sidebar } from '@/components/Sidebar';
import { SystemPanel } from '@/components/SystemPanel';
import { Mic, Send, Minus, Square, X } from 'lucide-react';

export interface Message {
  id: string;
  role: 'user' | 'elyra';
  text: string;
  timestamp: number;
}

const isDesktop = typeof window !== 'undefined' && !!window.elyra?.isDesktop;

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [booted, setBooted] = useState(false);
  const [page, setPage] = useState<'inicio' | 'asistente' | 'config'>('inicio');
  const [inputValue, setInputValue] = useState('');
  const [uptime, setUptime] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [autonomous, setAutonomous] = useState(true);

  const speakRef = useRef<(text: string) => void>(() => {});
  const startTimeRef = useRef(Date.now());

  const addMessage = useCallback((role: 'user' | 'elyra', text: string) => {
    const entry = { id: `${Date.now()}-${Math.random()}`, role, text, timestamp: Date.now() };
    setMessages((prev) => [...prev, entry]);
    if (isDesktop) {
      window.elyra?.memorySaveHistory({ role, text, at: new Date().toISOString() });
    }
  }, []);

  const handleCommand = useCallback(
    async (transcript: string) => {
      addMessage('user', transcript);
      const result = await processCommand(transcript);
      addMessage('elyra', result.response);
      speakRef.current(result.response);
    },
    [addMessage],
  );

  const { speak, stopSpeaking, startListening, stopListening, speaking, listening, supported, error } =
    useVoice({ onCommand: handleCommand });

  speakRef.current = speak;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      setUptime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load local memory history on boot
  useEffect(() => {
    if (!booted || !isDesktop) return;
    window.elyra?.memoryGet().then((mem) => {
      if (mem.history?.length) {
        setMessages(
          mem.history.slice(-30).map((h: any, i: number) => ({
            id: `hist-${i}`,
            role: h.role === 'user' ? 'user' : 'elyra',
            text: h.text,
            timestamp: new Date(h.at || Date.now()).getTime(),
          })),
        );
      }
    });
  }, [booted]);

  // Auto-boot
  useEffect(() => {
    if (!booted) {
      const timer = setTimeout(() => {
        setBooted(true);
        const bootMsg = isDesktop
          ? 'ELYRA en línea. Módulos de sistema activos. Puedo controlar tu PC. ¿En qué te ayudo?'
          : 'ELYRA en línea. Ejecuta la app de escritorio para control total del PC.';
        addMessage('elyra', bootMsg);
        setTimeout(() => speak(bootMsg), 400);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [booted, addMessage, speak]);

  // Autonomous mode listener from tray
  useEffect(() => {
    if (!isDesktop) return;
    return window.elyra?.onAutonomousMode((value) => setAutonomous(value));
  }, []);

  const handleToggleListen = () => {
    if (listening) stopListening();
    else startListening();
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text) return;
    setInputValue('');
    addMessage('user', text);
    const result = await processCommand(text);
    addMessage('elyra', result.response);
    speak(result.response);
  };

  const formatUptime = (s: number) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    return `${h}h ${m}m ${s % 60}s`;
  };

  const statusLabel = speaking ? 'Hablando...' : listening ? 'Conversando...' : autonomous ? 'Modo autónomo' : 'En espera';

  return (
    <div className="h-screen w-screen bg-[#030810] text-sky-100 flex overflow-hidden select-none">
      <Sidebar active={page} onNavigate={setPage} />

      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Custom title bar */}
        <header className="h-10 flex items-center justify-between px-3 border-b border-sky-500/10 drag-region">
          <div className="flex items-center gap-2 text-[11px] text-sky-400/40 pl-1">
            <span className="font-medium text-sky-300/60">ELYRA</span>
            {isDesktop && <span className="text-sky-500/30">· Escritorio</span>}
          </div>
          <div className="flex items-center gap-1 no-drag">
            {isDesktop ? (
              <>
                <button onClick={() => window.elyra?.minimize()} className="w-8 h-7 flex items-center justify-center rounded hover:bg-sky-500/10 text-sky-400/50 hover:text-sky-300 transition-colors">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => window.elyra?.maximize()} className="w-8 h-7 flex items-center justify-center rounded hover:bg-sky-500/10 text-sky-400/50 hover:text-sky-300 transition-colors">
                  <Square className="w-3 h-3" />
                </button>
                <button onClick={() => window.elyra?.close()} className="w-8 h-7 flex items-center justify-center rounded hover:bg-red-500/20 text-sky-400/50 hover:text-red-400 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button className="w-3 h-3 rounded-sm bg-sky-500/20" />
                <button className="w-3 h-3 rounded-sm bg-sky-500/20" />
                <button className="w-3 h-3 rounded-sm bg-red-500/40" />
              </>
            )}
          </div>
        </header>

        <div className="flex-1 flex min-h-0">
          <main className="flex-1 flex flex-col items-center justify-between py-5 px-8 relative min-w-0">
            <div className="w-full text-center space-y-2 z-10">
              <h2 className="text-2xl font-semibold text-white tracking-wide">Hola, Fabricio</h2>
              <p className="text-sm text-sky-300/60">
                {isDesktop
                  ? 'Monitoreo activo. Control de sistema disponible.'
                  : 'Estoy lista para ayudarte. Usa la app de escritorio para control total.'}
              </p>
              <div className="inline-flex items-center gap-2 mt-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20">
                <span className={`w-1.5 h-1.5 rounded-full ${speaking || listening ? 'bg-sky-400 animate-pulse' : autonomous ? 'bg-emerald-400' : 'bg-sky-500/50'}`} />
                <span className="text-xs text-sky-300/80">{statusLabel}</span>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center relative">
              <NetworkGlobe speaking={speaking} listening={listening} size={400} />
            </div>

            <div className="w-full max-w-xl z-10">
              {!supported && (
                <p className="text-amber-400/70 text-xs text-center mb-2">
                  Micrófono no disponible. Puedes escribir comandos.
                </p>
              )}
              {error && <p className="text-red-400/70 text-xs text-center mb-2">{error}</p>}

              <div className="flex items-center gap-3 rounded-full bg-[#0a1525]/90 border border-sky-500/20 px-4 py-2.5 shadow-[0_0_30px_rgba(14,165,233,0.08)]">
                <button
                  onClick={handleToggleListen}
                  className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    listening
                      ? 'bg-sky-500/30 text-sky-300 shadow-[0_0_15px_rgba(56,189,248,0.4)]'
                      : 'text-sky-400/60 hover:text-sky-300 hover:bg-sky-500/10'
                  }`}
                  title={listening ? 'Detener' : 'Hablar'}
                >
                  <Mic className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Pregúntame o dame una orden..."
                  className="flex-1 bg-transparent outline-none text-sm text-sky-100 placeholder:text-sky-500/40"
                />

                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sky-400/60 hover:text-sky-300 hover:bg-sky-500/10 disabled:opacity-30 transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </main>

          <div className="pr-5 py-5 flex flex-col">
            <SystemPanel />
          </div>
        </div>

        <footer className="h-9 flex items-center justify-between px-5 border-t border-sky-500/10 text-[11px] text-sky-400/50">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {isDesktop ? 'Escritorio' : 'Web'}
            </span>
            <span>Uptime: {formatUptime(uptime)}</span>
            {isDesktop && <span className="text-sky-500/30">Ctrl+Shift+E</span>}
          </div>
          <span>
            {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}{' '}
            {currentTime.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </span>
        </footer>
      </div>
    </div>
  );
}
