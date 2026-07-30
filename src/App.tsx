import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { NetworkGlobe } from '@/components/NetworkGlobe';
import { Sidebar } from '@/components/Sidebar';
import { SystemPanel } from '@/components/SystemPanel';
import { ConversationLog, type Message } from '@/components/ConversationLog';
import { ParticleField } from '@/components/ParticleField';
import {
  Mic, Send, Minus, Square, X, Loader2, Ear, Key, Check, Sparkles,
  FolderOpen, Chrome, Calculator, Camera, Volume2,
} from 'lucide-react';

const isDesktop = typeof window !== 'undefined' && !!window.elyra?.isDesktop;

const QUICK_ACTIONS = [
  { label: 'Chrome', icon: Chrome, cmd: 'Abre Chrome' },
  { label: 'Descargas', icon: FolderOpen, cmd: 'Abre la carpeta Descargas' },
  { label: 'Calculadora', icon: Calculator, cmd: 'Abre la calculadora' },
  { label: 'Captura', icon: Camera, cmd: 'Haz una captura de pantalla' },
  { label: 'Volumen +', icon: Volume2, cmd: 'Sube el volumen' },
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [booted, setBooted] = useState(false);
  const [bootPhase, setBootPhase] = useState(0);
  const [page, setPage] = useState<'inicio' | 'asistente' | 'config'>('inicio');
  const [inputValue, setInputValue] = useState('');
  const [uptime, setUptime] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [thinking, setThinking] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [configSaved, setConfigSaved] = useState(false);
  const [configModel, setConfigModel] = useState('llama-3.1-8b-instant');
  const [configBase, setConfigBase] = useState('https://api.groq.com/openai/v1');

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
            reply = 'El servicio está saturado un momento. Espere un instante y lo intentamos de nuevo.';
          }
          if (reply) {
            addMessage('elyra', reply);
            await speakRef.current(reply);
          }
        } else {
          const msg = 'Abra la aplicación de escritorio para acceder a todas las funciones, señor.';
          addMessage('elyra', msg);
          await speakRef.current(msg);
        }
      } catch {
        const msg = 'No pude completar esa solicitud ahora. Pruebe de nuevo en unos segundos.';
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
    transcribing,
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
    window.elyra?.agentConfigGet().then((c) => {
      setHasApiKey(c.hasKey);
      if (c.model) setConfigModel(c.model);
      if (c.baseUrl) setConfigBase(c.baseUrl);
    });
  }, [booted]);

  // Boot sequence cinematográfico
  useEffect(() => {
    if (bootOnceRef.current) return;
    bootOnceRef.current = true;
    const timers = [
      setTimeout(() => setBootPhase(1), 200),
      setTimeout(() => setBootPhase(2), 700),
      setTimeout(() => setBootPhase(3), 1200),
      setTimeout(async () => {
        setBooted(true);
        setBootPhase(4);
        const hour = new Date().getHours();
        const saludo =
          hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
        const bootMsg = isDesktop
          ? `${saludo}, Fabricio. Soy ELYRA. Sistemas online. Pulse el micrófono, hable, y pulse de nuevo para enviar.`
          : 'Soy ELYRA. Use la versión de escritorio para el control total del sistema.';
        addMessage('elyra', bootMsg);
        await speak(bootMsg);
      }, 1600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [addMessage, speak]);

  const handleToggleListen = () => {
    if (transcribing) return;
    if (listening) {
      stopListening();
      return;
    }
    if (speaking || thinking) {
      stopSpeaking();
      setTimeout(() => startListening(), 400);
      return;
    }
    startListening();
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || thinking || processingRef.current) return;
    setInputValue('');
    await processInput(text);
  };

  const handleSaveConfig = async () => {
    if (!isDesktop || !window.elyra) return;
    const partial: { apiKey?: string; baseUrl?: string; model?: string } = {};
    if (apiKeyInput.trim()) partial.apiKey = apiKeyInput.trim();
    if (configBase.trim()) partial.baseUrl = configBase.trim();
    if (configModel.trim()) partial.model = configModel.trim();
    await window.elyra.agentConfigSet(partial);
    const c = await window.elyra.agentConfigGet();
    setHasApiKey(c.hasKey);
    setConfigSaved(true);
    setApiKeyInput('');
    setTimeout(() => setConfigSaved(false), 2500);
  };

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m ${s % 60}s`;
  };

  const statusLabel = thinking
    ? 'Procesando...'
    : transcribing
    ? 'Transcribiendo...'
    : speaking
    ? 'Hablando...'
    : listening
    ? 'Escuchando… pulse el mic de nuevo'
    : 'Lista';

  if (!booted) {
    return (
      <div className="h-screen w-screen bg-[#02060e] flex flex-col items-center justify-center select-none relative overflow-hidden">
        <ParticleField active={bootPhase >= 2} />
        <div className={`relative z-10 text-center transition-all duration-700 ${bootPhase >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border border-sky-400/30 animate-pulse-glow" />
            <div className="absolute inset-2 rounded-full border border-sky-500/20" style={{ animation: 'ring-spin 8s linear infinite' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg viewBox="0 0 40 40" className="w-12 h-12">
                <circle cx="20" cy="20" r="6" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
                <ellipse cx="20" cy="20" rx="14" ry="6" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.6" />
                <ellipse cx="20" cy="20" rx="14" ry="6" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.6" transform="rotate(60 20 20)" />
                <ellipse cx="20" cy="20" rx="14" ry="6" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.6" transform="rotate(120 20 20)" />
                <circle cx="20" cy="20" r="2.5" fill="#7dd3fc" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-[0.3em] text-white text-glow">ELYRA</h1>
          <p className="text-xs text-sky-400/50 tracking-[0.25em] uppercase mt-2">
            {bootPhase < 2 ? 'Inicializando...' : bootPhase < 3 ? 'Cargando sistemas...' : 'Sincronizando...'}
          </p>
          <div className="mt-6 w-48 h-0.5 mx-auto bg-sky-900/50 rounded overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-600 to-sky-300 transition-all duration-500 rounded"
              style={{ width: `${bootPhase * 25}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#02060e] text-sky-100 flex overflow-hidden select-none relative animate-boot">
      <ParticleField active={speaking || listening || thinking} />

      <Sidebar active={page} onNavigate={setPage} />

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="h-10 flex items-center justify-between px-3 border-b border-sky-500/10 drag-region bg-[#030a14]/60 backdrop-blur-sm">
          <div className="flex items-center gap-2.5 text-[11px] text-sky-400/40 pl-1">
            <span className="font-semibold text-sky-300/80 tracking-[0.2em]">ELYRA</span>
            {isDesktop && <span className="text-sky-500/40">· Escritorio</span>}
            {naturalTts && <span className="text-emerald-400/50">· Voz neural</span>}
            {hasApiKey && <span className="text-violet-400/55">· IA activa</span>}
            {!hasApiKey && isDesktop && (
              <span className="text-amber-400/70 flex items-center gap-1">
                <Key className="w-3 h-3" /> Sin API key
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 no-drag">
            {isDesktop && (
              <>
                <button onClick={() => window.elyra?.minimize()} className="w-8 h-7 flex items-center justify-center rounded-md hover:bg-sky-500/10 text-sky-400/50 transition-colors">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => window.elyra?.maximize()} className="w-8 h-7 flex items-center justify-center rounded-md hover:bg-sky-500/10 text-sky-400/50 transition-colors">
                  <Square className="w-3 h-3" />
                </button>
                <button onClick={() => window.elyra?.close()} className="w-8 h-7 flex items-center justify-center rounded-md hover:bg-red-500/20 text-sky-400/50 hover:text-red-400 transition-colors">
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
                <div className="text-center space-y-1.5 mb-1 animate-fade-in">
                  <h2 className="text-2xl font-semibold text-white tracking-wide">
                    Hola, Fabricio
                  </h2>
                  <p className="text-sm text-sky-300/50">
                    {listening
                      ? 'Hable ahora… luego pulse el micrófono otra vez'
                      : transcribing
                      ? 'Convirtiendo su voz en texto…'
                      : 'Pulse mic → hable → pulse mic otra vez'}
                  </p>
                  <div className="inline-flex items-center gap-2 mt-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20">
                    {thinking || transcribing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                    ) : (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          speaking || listening
                            ? 'bg-sky-400 animate-pulse shadow-[0_0_8px_#38bdf8]'
                            : 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                        }`}
                      />
                    )}
                    <span className="text-xs text-sky-300/85 tracking-wide">{statusLabel}</span>
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-center min-h-0">
                  <NetworkGlobe
                    speaking={speaking || thinking}
                    listening={listening || transcribing}
                    size={360}
                    amplitude={amplitude}
                  />
                </div>

                {/* Quick actions */}
                <div className="flex justify-center gap-2 mb-3 flex-wrap max-w-lg mx-auto">
                  {QUICK_ACTIONS.map((qa) => (
                    <button
                      key={qa.label}
                      onClick={() => processInput(qa.cmd)}
                      disabled={thinking || processingRef.current}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] text-sky-300/70 bg-sky-500/8 border border-sky-500/15 hover:bg-sky-500/15 hover:text-sky-200 hover:border-sky-400/30 transition-all disabled:opacity-40"
                    >
                      <qa.icon className="w-3 h-3" />
                      {qa.label}
                    </button>
                  ))}
                </div>

                <div className="max-w-xl mx-auto w-full mb-2 max-h-24 overflow-hidden">
                  <ConversationLog messages={messages.slice(-3)} compact />
                </div>
              </>
            )}

            {page === 'asistente' && (
              <div className="flex-1 flex flex-col min-h-0 max-w-2xl mx-auto w-full animate-fade-in">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  <h2 className="text-lg font-medium text-white tracking-wide">Conversación</h2>
                </div>
                <ConversationLog messages={messages} />
              </div>
            )}

            {page === 'config' && (
              <div className="max-w-md mx-auto w-full space-y-4 pt-4 animate-fade-in">
                <h2 className="text-lg font-medium text-white tracking-wide">Configuración</h2>

                <div className="hud-glass rounded-2xl p-4 space-y-4 text-[12px]">
                  <div>
                    <label className="block text-sky-300/70 mb-1.5 tracking-wide">API Key (Groq / OpenAI / xAI)</label>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder={hasApiKey ? '••••••••  (ya configurada — pegue para cambiar)' : 'Pegue su API key aquí'}
                      className="w-full bg-sky-950/40 border border-sky-500/20 rounded-xl px-3 py-2.5 text-sky-100 outline-none focus:border-sky-400/40 placeholder:text-sky-600/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sky-300/70 mb-1.5 tracking-wide">Base URL</label>
                    <input
                      value={configBase}
                      onChange={(e) => setConfigBase(e.target.value)}
                      className="w-full bg-sky-950/40 border border-sky-500/20 rounded-xl px-3 py-2.5 text-sky-100 outline-none focus:border-sky-400/40"
                    />
                  </div>
                  <div>
                    <label className="block text-sky-300/70 mb-1.5 tracking-wide">Modelo</label>
                    <select
                      value={configModel}
                      onChange={(e) => setConfigModel(e.target.value)}
                      className="w-full bg-sky-950/40 border border-sky-500/20 rounded-xl px-3 py-2.5 text-sky-100 outline-none focus:border-sky-400/40"
                    >
                      <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (rápido)</option>
                      <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (inteligente)</option>
                      <option value="gemma2-9b-it">gemma2-9b-it</option>
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                      <option value="grok-2-latest">grok-2-latest</option>
                    </select>
                  </div>
                  <button
                    onClick={handleSaveConfig}
                    disabled={!isDesktop}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-500/20 border border-sky-400/30 text-sky-200 hover:bg-sky-500/30 transition-all disabled:opacity-40"
                  >
                    {configSaved ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" /> Guardado
                      </>
                    ) : (
                      <>
                        <Key className="w-4 h-4" /> Guardar configuración
                      </>
                    )}
                  </button>
                  <p className="text-sky-500/40 text-[11px] leading-relaxed">
                    También puede editar manualmente:{' '}
                    <code className="text-sky-400/60">%USERPROFILE%\.elyra\config.json</code>
                  </p>
                </div>

                <div className="hud-glass rounded-2xl p-4 space-y-3 text-[12px] text-sky-400/70">
                  <p>
                    <strong className="text-sky-200">Micrófono:</strong> pulse mic → hable → pulse mic otra vez.
                  </p>
                  <p>Windows → Privacidad → Micrófono → permitir apps de escritorio.</p>
                  <div className="flex items-center justify-between pt-2 border-t border-sky-500/10">
                    <span className="text-sky-100 text-sm">Escucha continua</span>
                    <button
                      onClick={() => setContinuous((v) => !v)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${continuous ? 'bg-sky-500' : 'bg-sky-900'}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${
                          continuous ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="w-full max-w-xl mx-auto mt-auto pt-3">
              {error && (
                <p className="text-red-400/85 text-xs text-center mb-2 px-2 animate-fade-in">{error}</p>
              )}
              {!supported && null}
              <div className="flex items-center gap-2 rounded-full hud-glass border border-sky-500/25 px-3 py-2 shadow-[0_0_30px_rgba(14,165,233,0.06)]">
                <button
                  onClick={handleToggleListen}
                  disabled={thinking || transcribing}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    listening
                      ? 'bg-red-500/35 text-red-100 shadow-[0_0_20px_rgba(248,113,113,0.4)] scale-105'
                      : 'text-sky-400/70 hover:bg-sky-500/15 hover:text-sky-300'
                  } disabled:opacity-40`}
                  title={listening ? 'Pulse para enviar' : 'Pulse para hablar'}
                >
                  {transcribing ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Mic className="w-4.5 h-4.5" />}
                </button>
                <button
                  onClick={() => setContinuous((v) => !v)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    continuous ? 'text-amber-300 bg-amber-500/15 shadow-[0_0_12px_rgba(251,191,36,0.25)]' : 'text-sky-500/40 hover:text-sky-400/70'
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
                  placeholder={listening ? 'Grabando… pulse el mic rojo para enviar' : 'Hable o escriba un comando…'}
                  className="flex-1 bg-transparent outline-none text-sm text-sky-100 placeholder:text-sky-500/35"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || thinking}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sky-400/60 hover:bg-sky-500/15 hover:text-sky-300 disabled:opacity-30 transition-all"
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

        <footer className="h-8 flex items-center justify-between px-5 border-t border-sky-500/10 text-[11px] text-sky-400/40 bg-[#030a14]/40">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
              Activo
            </span>
            <span className="tracking-wide">{formatUptime(uptime)}</span>
          </span>
          <span className="tracking-wider">
            {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </footer>
      </div>
    </div>
  );
}
