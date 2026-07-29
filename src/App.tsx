import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { NetworkGlobe } from '@/components/NetworkGlobe';
import { Sidebar } from '@/components/Sidebar';
import { SystemPanel } from '@/components/SystemPanel';
import { ConversationLog, type Message } from '@/components/ConversationLog';
import { Mic, Send, Minus, Square, X, Loader2, Ear } from 'lucide-react';

const isDesktop = typeof window !== 'undefined' && !!window.elyra?.isDesktop;

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [booted, setBooted] = useState(false);
  const [page, setPage] = useState<'inicio' | 'asistente' | 'config'>('inicio');
  const [inputValue, setInputValue] = useState('');
  const [uptime, setUptime] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [thinking, setThinking] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [continuous, setContinuous] = useState(false);

  const speakRef = useRef<(text: string) => void | Promise<void>>(() => {});
  const startTimeRef = useRef(Date.now());
  const messagesRef = useRef<Message[]>([]);
  const bootOnceRef = useRef(false);
  const processingRef = useRef(false);
  const continuousRef = useRef(false);
  continuousRef.current = continuous;
  messagesRef.current = messages;

  const addMessage = useCallback((role: 'user' | 'elyra', text: string) => {
    const entry = { id: `${Date.now()}-${Math.random()}`, role, text, timestamp: Date.now() };
    setMessages((prev) => [...prev, entry]);
    if (isDesktop) window.elyra?.memorySaveHistory({ role, text, at: new Date().toISOString() });
  }, []);

  const processInput = useCallback(
    async (text: string) => {
      const cleaned = (text || '').trim();
      if (!cleaned || processingRef.current) return;

      const lastElyra = [...messagesRef.current].reverse().find((m) => m.role === 'elyra');
      if (lastElyra) {
        const a = cleaned.toLowerCase();
        const b = lastElyra.text.toLowerCase();
        if (a.length < 20 && b.includes(a)) return;
      }

      processingRef.current = true;
      addMessage('user', cleaned);
      setThinking(true);
      try {
        if (isDesktop && window.elyra) {
          const history = messagesRef.current.slice(-12).map((m) => ({ role: m.role, text: m.text }));
          const result = await window.elyra.agentChat(cleaned, history);
          let reply = (result.response || '').trim();
          if (/rate limit|"error".*429|org_[a-z0-9]+/i.test(reply)) {
            reply = 'El servicio está saturado un momento. Espera un poco y lo intentamos otra vez.';
          }
          if (reply) {
            addMessage('elyra', reply);
            await speakRef.current(reply);
          }
        } else {
          const msg = 'Abre la app de escritorio para usar todas las funciones.';
          addMessage('elyra', msg);
          await speakRef.current(msg);
        }
      } catch {
        const msg = 'No pude completar eso ahora. Prueba de nuevo en unos segundos.';
        addMessage('elyra', msg);
        await speakRef.current(msg);
      } finally {
        setThinking(false);
        processingRef.current = false;
        if (continuousRef.current) {
          setTimeout(() => window.dispatchEvent(new CustomEvent('elyra-relisten')), 1800);
        }
      }
    },
    [addMessage],
  );

  const {
    speak,
    stopSpeaking,
    startListening,
    stopListening,
    speaking,
    listening,
    supported,
    error,
    naturalTts,
    amplitude,
  } = useVoice({ onCommand: processInput });

  speakRef.current = speak;

  useEffect(() => {
    const onRelisten = () => {
      if (continuousRef.current && !processingRef.current && !speaking) startListening();
    };
    window.addEventListener('elyra-relisten', onRelisten);
    return () => window.removeEventListener('elyra-relisten', onRelisten);
  }, [startListening, speaking]);

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentTime(new Date());
      setUptime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!booted || !isDesktop) return;
    window.elyra?.agentConfigGet().then((c) => setHasApiKey(c.hasKey));
  }, [booted]);

  useEffect(() => {
    if (bootOnceRef.current) return;
    bootOnceRef.current = true;
    const t = setTimeout(async () => {
      setBooted(true);
      const bootMsg = isDesktop
        ? 'Hola. Soy ELYRA. Dime qué necesitas y lo hacemos.'
        : 'Soy ELYRA. Usa la versión de escritorio para el control total.';
      addMessage('elyra', bootMsg);
      await speak(bootMsg);
    }, 600);
    return () => clearTimeout(t);
  }, [addMessage, speak]);

  const handleToggleListen = () => {
    if (listening) {
      stopListening();
      return;
    }
    if (speaking || thinking) return;
    stopSpeaking();
    setTimeout(() => startListening(), 200);
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || thinking || processingRef.current) return;
    setInputValue('');
    await processInput(text);
  };

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m ${s % 60}s`;
  };

  const statusLabel = thinking
    ? 'Trabajando...'
    : speaking
    ? 'Hablando...'
    : listening
    ? continuous
      ? 'Escucha continua'
      : 'Escuchando…'
    : 'Lista';

  return (
    <div className="h-screen w-screen bg-[#030810] text-sky-100 flex overflow-hidden select-none">
      <Sidebar active={page} onNavigate={setPage} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-10 flex items-center justify-between px-3 border-b border-sky-500/10 drag-region">
          <div className="flex items-center gap-2 text-[11px] text-sky-400/40 pl-1">
            <span className="font-medium text-sky-300/70 tracking-widest">ELYRA</span>
            {isDesktop && <span>· Escritorio</span>}
            {naturalTts && <span className="text-emerald-400/50">· Voz Dalia</span>}
            {hasApiKey && <span className="text-violet-400/50">· IA</span>}
          </div>
          <div className="flex items-center gap-1 no-drag">
            {isDesktop && (
              <>
                <button onClick={() => window.elyra?.minimize()} className="w-8 h-7 flex items-center justify-center rounded hover:bg-sky-500/10 text-sky-400/50">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => window.elyra?.maximize()} className="w-8 h-7 flex items-center justify-center rounded hover:bg-sky-500/10 text-sky-400/50">
                  <Square className="w-3 h-3" />
                </button>
                <button onClick={() => window.elyra?.close()} className="w-8 h-7 flex items-center justify-center rounded hover:bg-red-500/20 text-sky-400/50 hover:text-red-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 flex min-h-0">
          <main className="flex-1 flex flex-col min-w-0 px-5 py-4">
            {page === 'inicio' && (
              <>
                <div className="text-center space-y-1 mb-2">
                  <h2 className="text-2xl font-semibold text-white">Hola, Fabricio</h2>
                  <p className="text-sm text-sky-300/50">
                    {listening ? 'Habla ahora… al callarte envío solo' : 'Dime qué hacemos. Ctrl+Espacio corta la voz.'}
                  </p>
                  <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20">
                    {thinking ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                    ) : (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          speaking || listening ? 'bg-sky-400 animate-pulse' : 'bg-emerald-400'
                        }`}
                      />
                    )}
                    <span className="text-xs text-sky-300/80">{statusLabel}</span>
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-center min-h-0">
                  <NetworkGlobe
                    speaking={speaking || thinking}
                    listening={listening}
                    size={340}
                    amplitude={amplitude}
                  />
                </div>
                <div className="max-w-xl mx-auto w-full mb-2 max-h-24 overflow-hidden">
                  <ConversationLog messages={messages.slice(-4)} compact />
                </div>
              </>
            )}

            {page === 'asistente' && (
              <div className="flex-1 flex flex-col min-h-0 max-w-2xl mx-auto w-full">
                <h2 className="text-lg font-medium text-white mb-3">Conversación</h2>
                <ConversationLog messages={messages} />
              </div>
            )}

            {page === 'config' && (
              <div className="max-w-md mx-auto w-full space-y-4 pt-6">
                <h2 className="text-lg font-medium text-white">Configuración</h2>
                <div className="rounded-xl border border-sky-500/15 bg-[#0a1525]/80 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-sky-100">Escucha continua</p>
                      <p className="text-[11px] text-sky-400/50">Se reactiva sola tras responder</p>
                    </div>
                    <button
                      onClick={() => setContinuous((v) => !v)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${continuous ? 'bg-sky-500' : 'bg-sky-900'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${continuous ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                  <p className="text-[12px] text-sky-400/60 leading-relaxed">
                    Ctrl+Espacio: interrumpir voz · Ctrl+Shift+E: mostrar/ocultar
                    <br />
                    API key en: %USERPROFILE%\.elyra\config.json
                  </p>
                </div>
              </div>
            )}

            <div className="w-full max-w-xl mx-auto mt-auto pt-3">
              {error && <p className="text-red-400/70 text-xs text-center mb-2">{error}</p>}
              {!supported && null}
              <div className="flex items-center gap-2 rounded-full bg-[#0a1525]/95 border border-sky-500/25 px-3 py-2">
                <button
                  onClick={handleToggleListen}
                  disabled={thinking || speaking}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    listening
                      ? 'bg-sky-500/35 text-sky-200 shadow-[0_0_16px_rgba(56,189,248,0.4)]'
                      : 'text-sky-400/60 hover:bg-sky-500/10'
                  } disabled:opacity-40`}
                  title={listening ? 'Detener' : 'Hablar'}
                >
                  <Mic className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setContinuous((v) => !v)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    continuous ? 'text-amber-300 bg-amber-500/15' : 'text-sky-500/40'
                  }`}
                  title="Escucha continua"
                >
                  <Ear className="w-3.5 h-3.5" />
                </button>
                <input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  disabled={thinking}
                  placeholder={listening ? 'Escuchando…' : 'Habla o escribe…'}
                  className="flex-1 bg-transparent outline-none text-sm text-sky-100 placeholder:text-sky-500/40"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || thinking}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sky-400/60 hover:bg-sky-500/10 disabled:opacity-30"
                >
                  {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </main>

          {page === 'inicio' && (
            <div className="pr-4 py-4 hidden lg:flex">
              <SystemPanel />
            </div>
          )}
        </div>

        <footer className="h-8 flex items-center justify-between px-5 border-t border-sky-500/10 text-[11px] text-sky-400/40">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Activo
            </span>
            <span>{formatUptime(uptime)}</span>
          </span>
          <span>{currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
        </footer>
      </div>
    </div>
  );
}
