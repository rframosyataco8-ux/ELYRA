import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { NetworkGlobe } from '@/components/NetworkGlobe';
import { Sidebar } from '@/components/Sidebar';
import { SystemPanel } from '@/components/SystemPanel';
import { Mic, Send, Minus, Square, X, Loader2 } from 'lucide-react';

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
  const [thinking, setThinking] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  const speakRef = useRef<(text: string) => void | Promise<void>>(() => {});
  const startTimeRef = useRef(Date.now());
  const messagesRef = useRef<Message[]>([]);
  const bootOnceRef = useRef(false);
  const processingRef = useRef(false);
  messagesRef.current = messages;

  const addMessage = useCallback((role: 'user' | 'elyra', text: string) => {
    const entry = { id: `${Date.now()}-${Math.random()}`, role, text, timestamp: Date.now() };
    setMessages((prev) => [...prev, entry]);
    if (isDesktop) {
      window.elyra?.memorySaveHistory({ role, text, at: new Date().toISOString() });
    }
  }, []);

  const processInput = useCallback(
    async (text: string) => {
      if (processingRef.current) return;
      processingRef.current = true;
      addMessage('user', text);
      setThinking(true);
      try {
        if (isDesktop && window.elyra) {
          const history = messagesRef.current.slice(-10).map((m) => ({
            role: m.role,
            text: m.text,
          }));
          const result = await window.elyra.agentChat(text, history);
          const reply = (result.response || '').trim();
          if (reply) {
            addMessage('elyra', reply);
            await speakRef.current(reply);
          }
        } else {
          const msg =
            'Mis capacidades completas están en la aplicación de escritorio. Ábrela con npm run dev:electron.';
          addMessage('elyra', msg);
          await speakRef.current(msg);
        }
      } catch (err: any) {
        const msg = `Hubo un problema: ${err?.message || 'error desconocido'}`;
        addMessage('elyra', msg);
        await speakRef.current(msg);
      } finally {
        setThinking(false);
        processingRef.current = false;
      }
    },
    [addMessage],
  );

  const { speak, stopSpeaking, startListening, stopListening, speaking, listening, supported, error, naturalTts } =
    useVoice({ onCommand: processInput });

  speakRef.current = speak;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      setUptime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!booted || !isDesktop) return;
    window.elyra?.memoryGet().then((mem) => {
      if (mem.history?.length) {
        setMessages(
          mem.history.slice(-20).map((h: any, i: number) => ({
            id: `hist-${i}`,
            role: h.role === 'user' ? 'user' : 'elyra',
            text: h.text,
            timestamp: new Date(h.at || Date.now()).getTime(),
          })),
        );
      }
    });
    window.elyra?.agentConfigGet().then((c) => setHasApiKey(c.hasKey));
  }, [booted]);

  // Boot UNA sola vez (evita doble saludo por StrictMode)
  useEffect(() => {
    if (bootOnceRef.current) return;
    bootOnceRef.current = true;

    const timer = setTimeout(async () => {
      setBooted(true);
      const bootMsg = isDesktop
        ? 'Sistema en línea. Soy ELYRA. Todos los módulos operativos. ¿En qué puedo ayudarte?'
        : 'Soy ELYRA. Abre la versión de escritorio para control total del sistema.';
      addMessage('elyra', bootMsg);
      await speak(bootMsg);
    }, 800);

    return () => clearTimeout(timer);
  }, [addMessage, speak]);

  useEffect(() => {
    if (!isDesktop) return;
    return window.elyra?.onAutonomousMode((value) => setAutonomous(value));
  }, []);

  const handleToggleListen = () => {
    if (listening) stopListening();
    else {
      stopSpeaking();
      startListening();
    }
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || thinking || processingRef.current) return;
    setInputValue('');
    await processInput(text);
  };

  const formatUptime = (s: number) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    return `${h}h ${m}m ${s % 60}s`;
  };

  const statusLabel = thinking
    ? 'Procesando...'
    : speaking
    ? 'Transmitiendo...'
    : listening
    ? 'Escuchando...'
    : autonomous
    ? 'En espera · autónomo'
    : 'En espera';

  const recentMessages = messages.slice(-6);

  return (
    <div className="h-screen w-screen bg-[#030810] text-sky-100 flex overflow-hidden select-none">
      <Sidebar active={page} onNavigate={setPage} />

      <div className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-10 flex items-center justify-between px-3 border-b border-sky-500/10 drag-region">
          <div className="flex items-center gap-2 text-[11px] text-sky-400/40 pl-1">
            <span className="font-medium text-sky-300/70 tracking-widest">ELYRA</span>
            {isDesktop && <span className="text-sky-500/30">· Escritorio</span>}
            {naturalTts && <span className="text-emerald-400/50">· Voz Álvaro</span>}
            {hasApiKey && <span className="text-violet-400/50">· IA activa</span>}
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
            ) : null}
          </div>
        </header>

        <div className="flex-1 flex min-h-0">
          <main className="flex-1 flex flex-col items-center justify-between py-5 px-6 relative min-w-0">
            <div className="w-full text-center space-y-2 z-10">
              <h2 className="text-2xl font-semibold text-white tracking-wide">Hola, Fabricio</h2>
              <p className="text-sm text-sky-300/55">
                {hasApiKey
                  ? 'Sistemas en línea. Puedes pedirme cualquier cosa.'
                  : isDesktop
                  ? 'Conectando inteligencia…'
                  : 'Versión limitada en navegador.'}
              </p>
              <div className="inline-flex items-center gap-2 mt-1 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20">
                {thinking ? (
                  <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                ) : (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      speaking || listening ? 'bg-sky-400 animate-pulse' : autonomous ? 'bg-emerald-400' : 'bg-sky-500/50'
                    }`}
                  />
                )}
                <span className="text-xs text-sky-300/80 tracking-wide">{statusLabel}</span>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center relative min-h-0">
              <NetworkGlobe speaking={speaking || thinking} listening={listening} size={380} />
            </div>

            {/* Últimos mensajes (compacto) */}
            {recentMessages.length > 0 && (
              <div className="w-full max-w-xl mb-3 max-h-28 overflow-y-auto space-y-1.5 px-1">
                {recentMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`text-[11px] leading-snug px-3 py-1.5 rounded-lg ${
                      m.role === 'user'
                        ? 'bg-sky-500/10 text-sky-200/80 ml-8'
                        : 'bg-white/5 text-sky-100/70 mr-8'
                    }`}
                  >
                    <span className="opacity-40 mr-1">{m.role === 'user' ? 'Tú' : 'ELYRA'}:</span>
                    {m.text.length > 160 ? m.text.slice(0, 160) + '…' : m.text}
                  </div>
                ))}
              </div>
            )}

            <div className="w-full max-w-xl z-10">
              {error && <p className="text-red-400/70 text-xs text-center mb-2">{error}</p>}
              {!supported && (
                <p className="text-amber-400/70 text-xs text-center mb-2">Micrófono no disponible. Puedes escribir.</p>
              )}

              <div className="flex items-center gap-3 rounded-full bg-[#0a1525]/95 border border-sky-500/25 px-4 py-2.5 shadow-[0_0_40px_rgba(14,165,233,0.1)]">
                <button
                  onClick={handleToggleListen}
                  disabled={thinking}
                  className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    listening
                      ? 'bg-sky-500/35 text-sky-200 shadow-[0_0_18px_rgba(56,189,248,0.45)]'
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
                  disabled={thinking}
                  placeholder="Habla o escribe una orden…"
                  className="flex-1 bg-transparent outline-none text-sm text-sky-100 placeholder:text-sky-500/40 disabled:opacity-50"
                />

                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || thinking}
                  className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sky-400/60 hover:text-sky-300 hover:bg-sky-500/10 disabled:opacity-30 transition-all"
                >
                  {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </main>

          <div className="pr-5 py-5 flex flex-col">
            <SystemPanel />
          </div>
        </div>

        <footer className="h-9 flex items-center justify-between px-5 border-t border-sky-500/10 text-[11px] text-sky-400/45">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {isDesktop ? 'Escritorio' : 'Web'}
            </span>
            <span>Uptime: {formatUptime(uptime)}</span>
            {isDesktop && <span className="text-sky-500/25">Ctrl+Shift+E</span>}
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
