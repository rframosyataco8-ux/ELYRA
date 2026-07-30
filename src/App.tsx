import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { NetworkGlobe } from '@/components/NetworkGlobe';
import { Sidebar } from '@/components/Sidebar';
import { SystemPanel } from '@/components/SystemPanel';
import { ConversationLog, type Message } from '@/components/ConversationLog';
import { LoginGate } from '@/components/LoginGate';
import { Mic, Send, Minus, Square, X, Loader2, Ear, Key, Check, Save, Trash2, Sparkles, Wifi, AlertCircle } from 'lucide-react';

const isDesktop = typeof window !== 'undefined' && !!window.elyra?.isDesktop;

function detectFromKey(key: string) {
  const k = key.trim();
  if (k.startsWith('gsk_')) return { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.1-8b-instant' };
  if (k.startsWith('sk-ant-')) return { baseUrl: 'https://api.anthropic.com', model: 'claude-3-5-sonnet-20241022' };
  if (k.startsWith('AIza')) {
    return {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      model: 'gemini-2.0-flash',
    };
  }
  if (k.startsWith('sk-or-')) return { baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' };
  if (k.startsWith('xai-')) return { baseUrl: 'https://api.x.ai/v1', model: 'grok-2-latest' };
  if (k.startsWith('sk-') && k.length > 20) return { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' };
  return null;
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [operator, setOperator] = useState('Operador');
  const [messages, setMessages] = useState<Message[]>([]);
  const [booted, setBooted] = useState(false);
  const [page, setPage] = useState<'inicio' | 'asistente' | 'config'>('inicio');
  const [inputValue, setInputValue] = useState('');
  const [uptime, setUptime] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [thinking, setThinking] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [cfgApiKey, setCfgApiKey] = useState('');
  const [cfgBaseUrl, setCfgBaseUrl] = useState('https://api.groq.com/openai/v1');
  const [cfgModel, setCfgModel] = useState('llama-3.1-8b-instant');
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgSaved, setCfgSaved] = useState(false);
  const [cfgLoaded, setCfgLoaded] = useState(false);
  const [cfgTesting, setCfgTesting] = useState(false);
  const [cfgTestMsg, setCfgTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
          setTimeout(() => window.dispatchEvent(new CustomEvent('elyra-relisten')), 1600);
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
      if (c.baseUrl) setCfgBaseUrl(c.baseUrl);
      if (c.model) setCfgModel(c.model);
      setCfgLoaded(true);
    });
  }, [booted]);

  useEffect(() => {
    if (!authenticated || bootOnceRef.current) return;
    bootOnceRef.current = true;
    const t = setTimeout(async () => {
      setBooted(true);
      let bootMsg = isDesktop
        ? `Sistemas online. Hola ${operator}. Habla con naturalidad: preguntas, órdenes o ambas.`
        : 'Soy ELYRA. Usa la versión de escritorio para el control total.';
      if (isDesktop) {
        try {
          const c = await window.elyra?.agentConfigGet();
          if (c && !c.hasKey) {
            bootMsg =
              `Hola ${operator}. Falta la API key: ve a Configuración, guarda tu clave y prueba la conexión.`;
          }
        } catch {}
      }
      addMessage('elyra', bootMsg);
      await speak(bootMsg);
    }, 500);
    return () => clearTimeout(t);
  }, [authenticated, operator, addMessage, speak]);

  const handleToggleListen = () => {
    if (transcribing) return;
    if (listening) {
      stopListening();
      return;
    }
    if (speaking || thinking) {
      stopSpeaking();
      setTimeout(() => startListening(), 350);
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

  const onApiKeyChange = (value: string) => {
    setCfgApiKey(value);
    setCfgTestMsg(null);
    const det = detectFromKey(value);
    if (det) {
      setCfgBaseUrl(det.baseUrl);
      setCfgModel(det.model);
    }
  };

  const handleSaveConfig = async () => {
    if (!isDesktop || !window.elyra) return;
    setCfgSaving(true);
    setCfgSaved(false);
    setCfgTestMsg(null);
    try {
      const result = await window.elyra.agentConfigSet({
        apiKey: cfgApiKey.trim() || undefined,
        baseUrl: cfgBaseUrl.trim(),
        model: cfgModel.trim(),
      });
      setHasApiKey(result.hasKey);
      if (result.baseUrl) setCfgBaseUrl(result.baseUrl);
      if (result.model) setCfgModel(result.model);
      setCfgSaved(true);
      setTimeout(() => setCfgSaved(false), 2500);
      if (cfgApiKey.trim()) setCfgApiKey('');
    } catch {
      setCfgTestMsg({ ok: false, text: 'No se pudo guardar.' });
    } finally {
      setCfgSaving(false);
    }
  };

  const handleTestConfig = async () => {
    if (!isDesktop || !window.elyra) return;
    setCfgTesting(true);
    setCfgTestMsg(null);
    try {
      if (cfgApiKey.trim()) {
        await window.elyra.agentConfigSet({
          apiKey: cfgApiKey.trim(),
          baseUrl: cfgBaseUrl.trim(),
          model: cfgModel.trim(),
        });
        setCfgApiKey('');
      } else {
        await window.elyra.agentConfigSet({
          baseUrl: cfgBaseUrl.trim(),
          model: cfgModel.trim(),
        });
      }
      const test = await window.elyra.agentConfigTest({
        baseUrl: cfgBaseUrl.trim(),
        model: cfgModel.trim(),
      });
      const c = await window.elyra.agentConfigGet();
      setHasApiKey(c.hasKey);
      setCfgTestMsg({ ok: test.ok, text: test.message });
    } catch {
      setCfgTestMsg({ ok: false, text: 'Error al probar la conexión.' });
    } finally {
      setCfgTesting(false);
    }
  };

  const handleClearMemory = async () => {
    if (!isDesktop || !window.elyra) return;
    await window.elyra.memoryClear();
    addMessage('elyra', 'Memoria local borrada.');
  };

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m ${s % 60}s`;
  };

  const statusLabel = thinking
    ? 'Procesando…'
    : transcribing
    ? 'Transcribiendo…'
    : speaking
    ? 'Hablando…'
    : listening
    ? 'Escuchando… pulsa el mic otra vez'
    : 'Lista';

  const providers = [
    { label: 'Groq (rápido)', url: 'https://api.groq.com/openai/v1', model: 'llama-3.1-8b-instant' },
    { label: 'Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
    { label: 'Claude', url: 'https://api.anthropic.com', model: 'claude-3-5-sonnet-20241022' },
    { label: 'OpenAI', url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    { label: 'xAI Grok', url: 'https://api.x.ai/v1', model: 'grok-2-latest' },
    { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
    { label: 'Ollama local', url: 'http://localhost:11434/v1', model: 'llama3.2' },
  ];

  if (!authenticated) {
    return (
      <LoginGate
        onAuthenticated={(name) => {
          setOperator(name);
          setAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div className="h-screen w-screen bg-[#030810] text-sky-100 flex overflow-hidden select-none relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-sky-600/5 blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/5 blur-[100px]" />
      </div>

      <Sidebar
        active={page}
        onNavigate={setPage}
        hasApiKey={hasApiKey}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
      />

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="h-10 flex items-center justify-between px-3 border-b border-sky-500/10 drag-region">
          <div className="flex items-center gap-2 text-[11px] text-sky-400/45 pl-1">
            <span className="font-medium text-sky-300/80 tracking-[0.18em]">ELYRA</span>
            {isDesktop && <span className="text-sky-500/40">· Escritorio</span>}
            {naturalTts && <span className="text-emerald-400/55">· Voz neural</span>}
            {hasApiKey && <span className="text-violet-400/55">· IA activa</span>}
            {!hasApiKey && isDesktop && <span className="text-amber-400/65">· Sin API key</span>}
          </div>
          <div className="flex items-center gap-1 no-drag">
            {isDesktop && (
              <>
                <button onClick={() => window.elyra?.minimize()} className="w-8 h-7 flex items-center justify-center rounded hover:bg-sky-500/10 text-sky-400/50 transition-colors">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => window.elyra?.maximize()} className="w-8 h-7 flex items-center justify-center rounded hover:bg-sky-500/10 text-sky-400/50 transition-colors">
                  <Square className="w-3 h-3" />
                </button>
                <button onClick={() => window.elyra?.close()} className="w-8 h-7 flex items-center justify-center rounded hover:bg-red-500/20 text-sky-400/50 hover:text-red-400 transition-colors">
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
                <div className="text-center space-y-1.5 mb-2 animate-boot">
                  <h2 className="text-2xl font-semibold text-white tracking-wide text-glow-soft">Hola, {operator}</h2>
                  <p className="text-sm text-sky-300/55">
                    {listening
                      ? 'Te escucho… al terminar de hablar se envía solo, o pulsa el mic'
                      : transcribing
                      ? 'Convirtiendo tu voz en texto…'
                      : thinking
                      ? 'Analizando y ejecutando…'
                      : 'Habla con naturalidad o escribe lo que necesites'}
                  </p>
                  <div className="status-chip mt-2 mx-auto">
                    {thinking || transcribing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                    ) : (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          speaking || listening ? 'bg-sky-400 animate-pulse shadow-[0_0_8px_#38bdf8]' : 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                        }`}
                      />
                    )}
                    <span className="text-xs text-sky-300/85">{statusLabel}</span>
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-center min-h-0">
                  <NetworkGlobe
                    speaking={speaking || thinking}
                    listening={listening || transcribing}
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
              <div className="flex-1 flex flex-col min-h-0 max-w-2xl mx-auto w-full animate-fade-in">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  <h2 className="text-lg font-medium text-white tracking-wide">Conversación</h2>
                </div>
                <ConversationLog messages={messages} />
              </div>
            )}

            {page === 'config' && (
              <div className="max-w-lg mx-auto w-full space-y-5 pt-4 animate-fade-in overflow-y-auto pb-4">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-sky-400" />
                  <h2 className="text-lg font-medium text-white tracking-wide">Configuración</h2>
                </div>

                <div className="hud-glass-strong rounded-2xl p-5 space-y-4 border border-sky-500/15">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm text-sky-100 font-medium">Proveedor de IA</h3>
                    {hasApiKey ? (
                      <span className="text-[11px] text-emerald-400/90 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Conectada
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-400/80">Sin clave</span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] text-sky-400/60 tracking-wide uppercase">Proveedor</label>
                    <div className="flex flex-wrap gap-1.5">
                      {providers.map((p) => (
                        <button
                          key={p.label}
                          onClick={() => {
                            setCfgBaseUrl(p.url);
                            setCfgModel(p.model);
                            setCfgTestMsg(null);
                          }}
                          className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                            cfgBaseUrl === p.url || cfgBaseUrl.startsWith(p.url)
                              ? 'bg-sky-500/20 border-sky-400/40 text-sky-200'
                              : 'border-sky-500/15 text-sky-400/60 hover:border-sky-500/30'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] text-sky-400/60 tracking-wide uppercase">API Key</label>
                    <input
                      type="password"
                      value={cfgApiKey}
                      onChange={(e) => onApiKeyChange(e.target.value)}
                      placeholder={hasApiKey ? '••••••••  (deja vacío para no cambiar)' : 'pega tu API key aquí'}
                      className="w-full bg-sky-950/50 border border-sky-500/20 rounded-xl px-3.5 py-2.5 text-sm text-sky-100 outline-none focus:border-sky-400/40 placeholder:text-sky-600/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-sky-400/60 tracking-wide uppercase">Base URL</label>
                      <input
                        value={cfgBaseUrl}
                        onChange={(e) => setCfgBaseUrl(e.target.value)}
                        className="w-full bg-sky-950/50 border border-sky-500/20 rounded-xl px-3 py-2 text-xs text-sky-100 outline-none focus:border-sky-400/40"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-sky-400/60 tracking-wide uppercase">Modelo</label>
                      <input
                        value={cfgModel}
                        onChange={(e) => setCfgModel(e.target.value)}
                        className="w-full bg-sky-950/50 border border-sky-500/20 rounded-xl px-3 py-2 text-xs text-sky-100 outline-none focus:border-sky-400/40"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveConfig}
                      disabled={cfgSaving || !isDesktop}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-500/20 border border-sky-400/30 text-sky-100 text-sm hover:bg-sky-500/30 transition-all disabled:opacity-40"
                    >
                      {cfgSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : cfgSaved ? <><Check className="w-4 h-4 text-emerald-400" /> Guardado</> : <><Save className="w-4 h-4" /> Guardar</>}
                    </button>
                    <button
                      onClick={handleTestConfig}
                      disabled={cfgTesting || !isDesktop}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-500/15 border border-violet-400/25 text-sky-100 text-sm hover:bg-violet-500/25 transition-all disabled:opacity-40"
                    >
                      {cfgTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Wifi className="w-4 h-4" /> Probar conexión</>}
                    </button>
                  </div>

                  {cfgTestMsg && (
                    <div className={`flex items-start gap-2 text-[12px] rounded-xl px-3 py-2.5 border ${cfgTestMsg.ok ? 'bg-emerald-500/10 border-emerald-400/25 text-emerald-300/90' : 'bg-red-500/10 border-red-400/25 text-red-300/90'}`}>
                      {cfgTestMsg.ok ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                      <span>{cfgTestMsg.text}</span>
                    </div>
                  )}
                </div>

                <div className="hud-glass rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm text-sky-100 font-medium">Voz y micrófono</h3>
                  <p className="text-[12px] text-sky-400/65 leading-relaxed">
                    Whisper + VAD: al callar ~1,4 s se envía solo. Escucha continua reabre el mic tras cada respuesta.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sky-100 text-sm">Escucha continua</span>
                    <button
                      onClick={() => setContinuous((v) => !v)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${continuous ? 'bg-sky-500' : 'bg-sky-900 border border-sky-700'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${continuous ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="hud-glass rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm text-sky-100 font-medium">Memoria</h3>
                  <button onClick={handleClearMemory} className="flex items-center gap-2 text-[12px] text-red-400/80 hover:text-red-300 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Borrar memoria local
                  </button>
                </div>

                {!cfgLoaded && isDesktop && <p className="text-center text-xs text-sky-500/40">Cargando configuración…</p>}
              </div>
            )}

            <div className="w-full max-w-xl mx-auto mt-auto pt-3">
              {error && <p className="text-red-400/80 text-xs text-center mb-2 px-2">{error}</p>}
              <div className="flex items-center gap-2 rounded-full input-hud px-3 py-2">
                <button
                  onClick={handleToggleListen}
                  disabled={thinking || transcribing}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    listening ? 'bg-red-500/35 text-red-100 shadow-[0_0_20px_rgba(248,113,113,0.4)]' : 'text-sky-400/70 hover:bg-sky-500/15'
                  } disabled:opacity-40`}
                  title={listening ? 'Pulsa para enviar' : 'Pulsa para hablar'}
                >
                  {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setContinuous((v) => !v)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    continuous ? 'text-amber-300 bg-amber-500/20 shadow-[0_0_12px_rgba(251,191,36,0.25)]' : 'text-sky-500/40 hover:text-sky-400/60'
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
                  placeholder={listening ? 'Escuchando…' : 'Habla o escribe con naturalidad…'}
                  className="flex-1 bg-transparent outline-none text-sm text-sky-100 placeholder:text-sky-500/40"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || thinking}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sky-400/60 hover:bg-sky-500/15 disabled:opacity-30 transition-all"
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
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
              Activo · {operator}
            </span>
            <span>{formatUptime(uptime)}</span>
          </span>
          <span className="tracking-wide">{currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </footer>
      </div>
    </div>
  );
}
