import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { useWakeWord } from '@/hooks/useWakeWord';
import { NetworkGlobe } from '@/components/NetworkGlobe';
import { Sidebar, type AppPage } from '@/components/Sidebar';
import { SystemPanel } from '@/components/SystemPanel';
import { ConversationLog, type Message } from '@/components/ConversationLog';
import { LoginGate, clearSession } from '@/components/LoginGate';
import { ProductsPanel, type ProductView } from '@/components/ProductsPanel';
import { RegistroPrensaPanel } from '@/components/RegistroPrensaPanel';
import { AfqPanel, type AfqView } from '@/components/AfqPanel';
import { CronogramaPanel } from '@/components/CronogramaPanel';
import { ThemeSettings } from '@/components/ThemeSettings';
import { UserAdminPanel } from '@/components/UserAdminPanel';
import { ChatImageButton } from '@/components/ChatImageButton';
import { PageTransition } from '@/components/PageTransition';
import type { LabUser } from '@/lib/users';
import { canAccessPage } from '@/lib/users';
import { validateAiConfig } from '@/lib/validateConfig';
import {
  detectFromKey,
  PROVIDER_PRESETS,
  GEMINI_MODELS,
  NVIDIA_MODELS,
  isGeminiUrl,
  isNvidiaUrl,
} from '@/lib/providers';
import { Mic, Send, Minus, Square, X, Loader2, Ear, Key, Check, Save, Trash2, Sparkles, Wifi, AlertCircle, Radio, ExternalLink } from 'lucide-react';

const isDesktop = typeof window !== 'undefined' && !!window.elyra?.isDesktop;

function greetingFor(operator: string) {
  const h = new Date().getHours();
  const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  return `${saludo}, ${operator}. Lista.`;
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<LabUser | null>(null);
  const [operator, setOperator] = useState('Operador');
  const [messages, setMessages] = useState<Message[]>([]);
  const [booted, setBooted] = useState(false);
  const [page, setPage] = useState<AppPage>('inicio');
  const [inputValue, setInputValue] = useState('');
  const [uptime, setUptime] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [thinking, setThinking] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [deskMode, setDeskMode] = useState(false);
  const [wakeEnabled, setWakeEnabled] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [cfgApiKey, setCfgApiKey] = useState('');
  const [cfgBaseUrl, setCfgBaseUrl] = useState('https://api.groq.com/openai/v1');
  const [cfgModel, setCfgModel] = useState('llama-3.1-8b-instant');
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgSaved, setCfgSaved] = useState(false);
  const [cfgLoaded, setCfgLoaded] = useState(false);
  const [cfgTesting, setCfgTesting] = useState(false);
  const [cfgTestMsg, setCfgTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [detectedProvider, setDetectedProvider] = useState<string | null>(null);

  const speakRef = useRef<(text: string) => void | Promise<void>>(() => {});
  const startTimeRef = useRef(Date.now());
  const messagesRef = useRef<Message[]>([]);
  const bootOnceRef = useRef(false);
  const processingRef = useRef(false);
  const continuousRef = useRef(false);
  const deskModeRef = useRef(false);
  const floatingActiveRef = useRef(false);
  continuousRef.current = continuous;
  deskModeRef.current = deskMode;
  messagesRef.current = messages;

  const isAdmin = !!currentUser?.isAdmin;
  const isGemini = detectedProvider === 'gemini' || isGeminiUrl(cfgBaseUrl);
  const isNvidia = detectedProvider === 'nvidia' || isNvidiaUrl(cfgBaseUrl);

  const navigate = useCallback((p: AppPage) => {
    if (canAccessPage(currentUser, p)) setPage(p);
  }, [currentUser]);

  const addMessage = useCallback((role: 'user' | 'elyra', text: string) => {
    const entry = { id: `${Date.now()}-${Math.random()}`, role, text, timestamp: Date.now() };
    setMessages((prev) => [...prev, entry]);
    if (isDesktop) window.elyra?.memorySaveHistory({ role, text, at: new Date().toISOString() });
  }, []);

  const processInput = useCallback(async (text: string) => {
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
        if (/rate limit|429|org_[a-z0-9]+/i.test(reply)) {
          reply = 'El servicio está saturado un momento. Inténtelo de nuevo en unos segundos.';
        }
        if (reply) {
          addMessage('elyra', reply);
          await speakRef.current(reply);
        }
      } else {
        const msg = 'Use la versión de escritorio para el control total del sistema.';
        addMessage('elyra', msg);
        await speakRef.current(msg);
      }
    } catch {
      const msg = 'No pude completar la solicitud. Reintente en unos segundos.';
      addMessage('elyra', msg);
      await speakRef.current(msg);
    } finally {
      setThinking(false);
      processingRef.current = false;
      if (continuousRef.current || deskModeRef.current) {
        setTimeout(() => window.dispatchEvent(new CustomEvent('elyra-relisten')), 1200);
      }
    }
  }, [addMessage]);

  const { speak, stopSpeaking, startListening, stopListening, speaking, listening, transcribing, error, naturalTts, amplitude } = useVoice({ onCommand: processInput });
  speakRef.current = speak;
  const busy = speaking || thinking || listening || transcribing;

  useEffect(() => {
    if (!isDesktop || !window.elyra) return;
    const shouldFloat = deskMode || speaking || listening || transcribing || thinking;
    if (shouldFloat && !floatingActiveRef.current) {
      floatingActiveRef.current = true;
      window.elyra.showFloatingCore?.();
    } else if (!shouldFloat && floatingActiveRef.current) {
      floatingActiveRef.current = false;
      window.elyra.hideFloatingCore?.();
    }
    if (floatingActiveRef.current) {
      window.elyra.floatingCoreState?.({ speaking, listening: listening || transcribing || deskMode });
    }
  }, [speaking, listening, transcribing, thinking, deskMode]);

  const onWake = useCallback((cmd: string, isPresence: boolean) => {
    if (processingRef.current || busy) return;
    if (isPresence || !cmd) {
      if (continuousRef.current || deskModeRef.current) return;
      processInput('estás ahí');
    } else processInput(cmd);
  }, [processInput, busy]);

  const { active: wakeListening } = useWakeWord({ enabled: authenticated && wakeEnabled && booted, busy, onWake });

  useEffect(() => {
    const onRelisten = () => {
      if ((continuousRef.current || deskModeRef.current) && !processingRef.current && !speaking) startListening();
    };
    window.addEventListener('elyra-relisten', onRelisten);
    return () => window.removeEventListener('elyra-relisten', onRelisten);
  }, [startListening, speaking]);

  useEffect(() => {
    if (!deskMode || !booted || !authenticated) return;
    if (processingRef.current || speaking || listening || transcribing || thinking) return;
    const id = setTimeout(() => {
      if (deskModeRef.current && !processingRef.current && !speaking) startListening();
    }, 700);
    return () => clearTimeout(id);
  }, [deskMode, booted, authenticated, speaking, listening, transcribing, thinking, startListening]);

  useEffect(() => {
    if (!isDesktop || !window.elyra?.onDeskMode) return;
    return window.elyra.onDeskMode((on: boolean) => {
      setDeskMode(on);
      if (on) { setContinuous(true); setWakeEnabled(true); }
      else { setContinuous(false); window.elyra?.hideFloatingCore?.(); floatingActiveRef.current = false; }
    });
  }, []);

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
    }).catch(() => {
      setCfgLoaded(true);
    });
  }, [booted]);

  useEffect(() => {
    if (!authenticated || bootOnceRef.current) return;
    bootOnceRef.current = true;
    const t = setTimeout(async () => {
      setBooted(true);
      let bootMsg = isDesktop ? greetingFor(operator) : 'ELYRA lista. Use la versión de escritorio para el control total.';
      if (isDesktop && isAdmin) {
        try {
          const c = await window.elyra?.agentConfigGet();
          if (c && !c.hasKey) {
            bootMsg = greetingFor(operator) + ' Configure la API key cuando desee razonamiento avanzado; el control del PC ya está activo.';
          }
        } catch { /* ignore */ }
      }
      addMessage('elyra', bootMsg);
      await speak(bootMsg);
    }, 450);
    return () => clearTimeout(t);
  }, [authenticated, operator, addMessage, speak, isAdmin]);

  const handleLogout = () => {
    clearSession();
    bootOnceRef.current = false;
    setBooted(false);
    setMessages([]);
    setAuthenticated(false);
    setCurrentUser(null);
    setPage('inicio');
  };

  const handleToggleListen = () => {
    if (transcribing) return;
    if (listening) { stopListening(); return; }
    if (speaking || thinking) { stopSpeaking(); setTimeout(() => startListening(), 350); return; }
    startListening();
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || thinking || processingRef.current) return;
    setInputValue('');
    await processInput(text);
  };

  const handleImageResult = useCallback(
    async (userLabel: string, reply: string) => {
      addMessage('user', userLabel);
      addMessage('elyra', reply);
      await speakRef.current(reply);
    },
    [addMessage],
  );

  const handleSelectProduct = async (name: string, view?: ProductView | AfqView) => {
    if (isDesktop && window.elyra?.openProductWindow) {
      const isAfq = page === 'afq';
      await window.elyra.openProductWindow({
        name,
        category: isAfq ? 'AFQ · Análisis físico químico' : 'Cadmio y Plaguicidas',
        views: 'dashboard,datos,analisis',
        view: view || 'dashboard',
      });
    }
  };

  const handleRegistroView = async (view: 'dashboard' | 'datos') => {
    if (isDesktop && window.elyra?.openProductWindow) {
      await window.elyra.openProductWindow({
        name: 'Registro de prensa',
        category: 'Datos de laboratorio',
        views: 'dashboard,datos',
        view,
      });
    }
  };

  const onApiKeyChange = (value: string) => {
    setCfgApiKey(value);
    setCfgTestMsg(null);
    const det = detectFromKey(value);
    if (det) {
      setCfgBaseUrl(det.baseUrl);
      setCfgModel(det.model);
      setDetectedProvider(det.provider);
    } else {
      setDetectedProvider(null);
    }
  };

  const runConfigValidation = () =>
    validateAiConfig({
      baseUrl: cfgBaseUrl,
      model: cfgModel,
      apiKey: cfgApiKey,
      hasStoredKey: hasApiKey,
    });

  const handleSaveConfig = async () => {
    if (!isDesktop || !window.elyra || !isAdmin || !cfgLoaded) return;
    const v = runConfigValidation();
    if (!v.ok) {
      setCfgTestMsg({ ok: false, text: v.firstError || 'Revise el formulario.' });
      return;
    }
    setCfgSaving(true); setCfgSaved(false); setCfgTestMsg(null);
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
    if (!isDesktop || !window.elyra || !isAdmin || !cfgLoaded) return;
    const v = runConfigValidation();
    if (!v.ok) {
      setCfgTestMsg({ ok: false, text: v.firstError || 'Revise el formulario.' });
      return;
    }
    setCfgTesting(true); setCfgTestMsg(null);
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
          ? 'Escuchando…'
          : wakeListening
            ? 'En espera'
            : 'Lista';

  const showChatBar = page === 'inicio' || page === 'asistente';

  const keyPlaceholder = hasApiKey
    ? '••••••••  (pegue una nueva para reemplazar)'
    : isNvidia
      ? 'nvapi-…'
      : isGemini
        ? 'AIza… o AQ.…'
        : 'pegue su API key';

  if (!authenticated) {
    return (
      <LoginGate
        onAuthenticated={({ user, operator: name }) => {
          setCurrentUser(user);
          setOperator(name);
          setAuthenticated(true);
          setPage('inicio');
        }}
      />
    );
  }

  return (
    <div className="ely-app h-screen w-screen flex overflow-hidden select-none relative">
      <Sidebar
        active={page}
        onNavigate={navigate}
        hasApiKey={hasApiKey}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        operator={operator}
        user={currentUser}
        onLogout={handleLogout}
      />
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="h-11 flex items-center justify-between px-4 drag-region" style={{ borderBottom: '1px solid var(--ely-header-border)' }}>
          <div className="flex items-center gap-2 text-[12px] pl-1" style={{ color: 'var(--ely-text-muted)' }}>
            <span className="font-medium" style={{ color: 'var(--ely-text)' }}>ELYRA</span>
            {isDesktop && <span>· Escritorio</span>}
            {currentUser && <span>· {currentUser.roleLabel}</span>}
            {deskMode && <span style={{ color: 'var(--ely-warning)' }}>· Modo escritorio</span>}
            {showChatBar && ((wakeEnabled && wakeListening) || continuous) && <span>· Escucha activa</span>}
            {naturalTts && showChatBar && <span>· Voz neural</span>}
            {isAdmin && hasApiKey && <span style={{ color: 'var(--ely-accent)' }}>· IA activa</span>}
          </div>
          <div className="flex items-center gap-0.5 no-drag">
            {isDesktop && (
              <>
                <button onClick={() => { setDeskMode(true); setContinuous(true); setWakeEnabled(true); window.elyra?.showFloatingCore?.(); window.elyra?.minimize?.(); }} className="w-8 h-8 flex items-center justify-center rounded-full ely-icon-btn" style={{ color: 'var(--ely-text-muted)' }} title="Minimizar"><Minus className="w-3.5 h-3.5" /></button>
                <button onClick={() => window.elyra?.maximize()} className="w-8 h-8 flex items-center justify-center rounded-full ely-icon-btn" style={{ color: 'var(--ely-text-muted)' }}><Square className="w-3 h-3" /></button>
                <button onClick={() => window.elyra?.close()} className="w-8 h-8 flex items-center justify-center rounded-full ely-icon-btn hover:text-red-400" style={{ color: 'var(--ely-text-muted)' }}><X className="w-3.5 h-3.5" /></button>
              </>
            )}
          </div>
        </header>
        <div className="flex-1 flex min-h-0">
          <main className={`flex-1 flex flex-col min-w-0 ${page === 'productos' ? 'px-0 py-0' : 'px-6 py-5'}`}>
            <PageTransition page={page}>
              {page === 'inicio' && (
                <>
                  <div className="text-center space-y-2 mb-3">
                    <h2 className="text-2xl font-medium tracking-tight" style={{ color: 'var(--ely-text)' }}>{operator}</h2>
                    <p className="text-sm" style={{ color: 'var(--ely-text-muted)' }}>
                      {listening ? 'Le escucho…' : transcribing ? 'Procesando voz…' : thinking ? 'Analizando…' : deskMode ? 'Modo escritorio · le escucho' : wakeEnabled ? 'En espera · diga mi nombre cuando me necesite' : 'Micrófono o teclado listos'}
                    </p>
                    <div className="status-chip mt-2 mx-auto" key={statusLabel}>
                      {thinking || transcribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--ely-accent)' }} /> : (
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: speaking || listening || wakeListening || deskMode ? 'var(--ely-accent)' : 'var(--ely-success)' }} />
                      )}
                      <span>{statusLabel}</span>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center justify-center min-h-0">
                    <NetworkGlobe speaking={speaking || thinking} listening={listening || transcribing || wakeListening || deskMode} size={320} amplitude={amplitude} />
                  </div>
                  <div className="max-w-xl mx-auto w-full mb-2 max-h-24 overflow-hidden">
                    <ConversationLog messages={messages.slice(-4)} compact />
                  </div>
                </>
              )}
              {page === 'asistente' && canAccessPage(currentUser, 'asistente') && (
                <div className="flex-1 flex flex-col min-h-0 max-w-2xl mx-auto w-full">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4" style={{ color: 'var(--ely-accent)' }} />
                    <h2 className="text-lg font-medium" style={{ color: 'var(--ely-text)' }}>Conversación</h2>
                  </div>
                  <ConversationLog messages={messages} />
                </div>
              )}
              {page === 'productos' && canAccessPage(currentUser, 'productos') && <ProductsPanel onSelectProduct={handleSelectProduct} />}
              {page === 'registro-prensa' && canAccessPage(currentUser, 'registro-prensa') && <RegistroPrensaPanel onSelectView={handleRegistroView} />}
              {page === 'afq' && canAccessPage(currentUser, 'afq') && <AfqPanel onSelectProduct={handleSelectProduct} />}
              {page === 'cronograma' && canAccessPage(currentUser, 'cronograma') && <CronogramaPanel />}
              {page === 'config' && canAccessPage(currentUser, 'config') && (
                <div className="max-w-lg mx-auto w-full space-y-5 pt-2 overflow-y-auto pb-4">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4" style={{ color: 'var(--ely-accent)' }} />
                    <h2 className="text-lg font-medium" style={{ color: 'var(--ely-text)' }}>Configuración</h2>
                  </div>
                  <ThemeSettings />
                  {isAdmin && currentUser && <UserAdminPanel currentUserId={currentUser.id} />}
                  {isAdmin && (
                    <div className="hud-glass-strong p-5 space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="text-sm font-medium" style={{ color: 'var(--ely-text)' }}>Proveedor de IA</h3>
                        {!cfgLoaded ? (
                          <span className="text-[11px]" style={{ color: 'var(--ely-text-dim)' }}>Cargando…</span>
                        ) : hasApiKey ? (
                          <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--ely-success)' }}>
                            <Check className="w-3 h-3" /> Conectada
                          </span>
                        ) : (
                          <span className="text-[11px]" style={{ color: 'var(--ely-warning)' }}>Sin clave</span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium" style={{ color: 'var(--ely-text-muted)' }}>Proveedor</label>
                        <div className="flex flex-wrap gap-1.5">
                          {PROVIDER_PRESETS.map((p) => {
                            const active = cfgBaseUrl === p.url || cfgBaseUrl.startsWith(p.url);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setCfgBaseUrl(p.url);
                                  setCfgModel(p.model);
                                  setCfgTestMsg(null);
                                  setDetectedProvider(p.id);
                                }}
                                className="text-[11px] px-2.5 py-1.5 rounded-full border transition-all duration-200 ely-chip-btn"
                                style={{
                                  background: active ? 'var(--ely-accent-soft)' : 'transparent',
                                  borderColor: active ? 'var(--ely-accent)' : 'var(--ely-border)',
                                  color: active ? 'var(--ely-accent)' : 'var(--ely-text-muted)',
                                }}
                              >
                                {p.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {isNvidia && (
                        <div className="rounded-xl px-3 py-2.5 text-[12px] space-y-1.5" style={{ background: 'var(--ely-accent-soft)', border: '1px solid var(--ely-border)', color: 'var(--ely-text-muted)' }}>
                          <p style={{ color: 'var(--ely-text)' }} className="font-medium text-[12px]">NVIDIA NIM · build.nvidia.com</p>
                          <p>Pegue la clave <code className="text-[11px]">nvapi-…</code> de{' '}<a href="https://build.nvidia.com/settings/api-keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5" style={{ color: 'var(--ely-accent)' }}>NVIDIA API Keys <ExternalLink className="w-3 h-3" /></a>.</p>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {NVIDIA_MODELS.map((m) => (
                              <button key={m} type="button" onClick={() => setCfgModel(m)} className="text-[10px] px-2 py-1 rounded-full border transition-all ely-chip-btn" style={{ background: cfgModel === m ? 'var(--ely-accent)' : 'transparent', borderColor: cfgModel === m ? 'var(--ely-accent)' : 'var(--ely-border)', color: cfgModel === m ? '#fff' : 'var(--ely-text-muted)' }}>{m.split('/').pop()}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {isGemini && (
                        <div className="rounded-xl px-3 py-2.5 text-[12px] space-y-1.5" style={{ background: 'var(--ely-accent-soft)', border: '1px solid var(--ely-border)', color: 'var(--ely-text-muted)' }}>
                          <p style={{ color: 'var(--ely-text)' }} className="font-medium text-[12px]">Google AI Studio · Gemini</p>
                          <p>Pegue la clave de{' '}<a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5" style={{ color: 'var(--ely-accent)' }}>AI Studio <ExternalLink className="w-3 h-3" /></a>.</p>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {GEMINI_MODELS.map((m) => (
                              <button key={m} type="button" onClick={() => setCfgModel(m)} className="text-[10px] px-2 py-1 rounded-full border transition-all ely-chip-btn" style={{ background: cfgModel === m ? 'var(--ely-accent)' : 'transparent', borderColor: cfgModel === m ? 'var(--ely-accent)' : 'var(--ely-border)', color: cfgModel === m ? '#fff' : 'var(--ely-text-muted)' }}>{m}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium" style={{ color: 'var(--ely-text-muted)' }}>API Key</label>
                        <input type="password" value={cfgApiKey} onChange={(e) => onApiKeyChange(e.target.value)} placeholder={keyPlaceholder} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none ely-focus-ring" style={{ background: 'var(--ely-input-bg)', border: '1px solid var(--ely-border)', color: 'var(--ely-text)' }} autoComplete="off" spellCheck={false} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium" style={{ color: 'var(--ely-text-muted)' }}>Base URL</label>
                          <input value={cfgBaseUrl} onChange={(e) => setCfgBaseUrl(e.target.value)} className="w-full rounded-xl px-3 py-2 text-xs outline-none ely-focus-ring" style={{ background: 'var(--ely-input-bg)', border: '1px solid var(--ely-border)', color: 'var(--ely-text)' }} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium" style={{ color: 'var(--ely-text-muted)' }}>Modelo</label>
                          <input value={cfgModel} onChange={(e) => setCfgModel(e.target.value)} className="w-full rounded-xl px-3 py-2 text-xs outline-none ely-focus-ring" style={{ background: 'var(--ely-input-bg)', border: '1px solid var(--ely-border)', color: 'var(--ely-text)' }} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={handleSaveConfig} disabled={cfgSaving || !isDesktop || !cfgLoaded} className="ely-btn-primary flex-1 disabled:opacity-40">{cfgSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : cfgSaved ? <><Check className="w-4 h-4" /> Guardado</> : <><Save className="w-4 h-4" /> Guardar</>}</button>
                        <button type="button" onClick={handleTestConfig} disabled={cfgTesting || !isDesktop || !cfgLoaded} className="ely-btn-secondary flex-1 disabled:opacity-40">{cfgTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Wifi className="w-4 h-4" /> Probar</>}</button>
                      </div>
                      {cfgTestMsg && (
                        <div className="flex items-start gap-2 text-[12px] rounded-xl px-3 py-2.5" style={{ background: cfgTestMsg.ok ? 'rgba(63, 185, 80, 0.1)' : 'rgba(248, 81, 73, 0.1)', border: `1px solid ${cfgTestMsg.ok ? 'rgba(63, 185, 80, 0.25)' : 'rgba(248, 81, 73, 0.25)'}`, color: cfgTestMsg.ok ? 'var(--ely-success)' : 'var(--ely-danger)' }}>{cfgTestMsg.ok ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}<span>{cfgTestMsg.text}</span></div>
                      )}
                    </div>
                  )}
                  {!isAdmin && (
                    <div className="hud-glass p-4 text-[13px]" style={{ color: 'var(--ely-text-muted)' }}>La configuración de usuarios y API keys solo está disponible para el administrador.</div>
                  )}
                  <div className="hud-glass p-5 space-y-4">
                    <h3 className="text-sm font-medium" style={{ color: 'var(--ely-text)' }}>Voz</h3>
                    <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ely-text-muted)' }}>Al minimizar, ELYRA queda a un lado y sigue escuchando. Ctrl+Shift+E oculta el sistema completo.</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm flex items-center gap-2" style={{ color: 'var(--ely-text)' }}><Radio className="w-3.5 h-3.5" /> Activación por voz</span>
                      <button type="button" onClick={() => setWakeEnabled((v) => !v)} className="relative w-11 h-6 rounded-full" style={{ background: wakeEnabled ? 'var(--ely-accent)' : 'var(--ely-border)', transition: 'background 0.25s var(--ely-ease)' }}><span className={`ely-switch-thumb absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow ${wakeEnabled ? 'translate-x-5' : ''}`} /></button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: 'var(--ely-text)' }}>Reescucha tras responder</span>
                      <button type="button" onClick={() => setContinuous((v) => !v)} className="relative w-11 h-6 rounded-full" style={{ background: continuous ? 'var(--ely-accent)' : 'var(--ely-border)', transition: 'background 0.25s var(--ely-ease)' }}><span className={`ely-switch-thumb absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow ${continuous ? 'translate-x-5' : ''}`} /></button>
                    </div>
                  </div>
                  <div className="hud-glass p-5 space-y-3">
                    <h3 className="text-sm font-medium" style={{ color: 'var(--ely-text)' }}>Memoria y sesión</h3>
                    <button type="button" onClick={handleClearMemory} className="flex items-center gap-2 text-[13px] transition-opacity hover:opacity-80" style={{ color: 'var(--ely-danger)' }}><Trash2 className="w-3.5 h-3.5" /> Borrar memoria local</button>
                    <button type="button" onClick={handleLogout} className="flex items-center gap-2 text-[13px] transition-opacity hover:opacity-80" style={{ color: 'var(--ely-text-muted)' }}>Cerrar sesión</button>
                  </div>
                </div>
              )}
            </PageTransition>

            {showChatBar && (
              <div className="w-full max-w-xl mx-auto mt-auto pt-4">
                {error && <p className="text-xs text-center mb-2 px-2" style={{ color: 'var(--ely-danger)' }}>{error}</p>}
                <div className="flex items-center gap-2 input-hud px-3 py-2">
                  <button type="button" onClick={handleToggleListen} disabled={thinking || transcribing} className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-40" style={{ background: listening ? 'rgba(248, 81, 73, 0.2)' : 'transparent', color: listening ? 'var(--ely-danger)' : 'var(--ely-text-muted)' }}>
                    {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                  </button>
                  <button type="button" onClick={() => setWakeEnabled((v) => !v)} className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200" style={{ color: wakeEnabled ? 'var(--ely-accent)' : 'var(--ely-text-dim)', background: wakeEnabled ? 'var(--ely-accent-soft)' : 'transparent' }} title="Activación por voz">
                    <Radio className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => setContinuous((v) => !v)} className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200" style={{ color: continuous ? 'var(--ely-warning)' : 'var(--ely-text-dim)', background: continuous ? 'rgba(210, 153, 34, 0.15)' : 'transparent' }} title="Reescucha">
                    <Ear className="w-3.5 h-3.5" />
                  </button>
                  <ChatImageButton disabled={thinking} onResult={handleImageResult} />
                  <input value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} disabled={thinking} placeholder="Escriba o diga mi nombre…" className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'var(--ely-text)' }} />
                  <button type="button" onClick={handleSend} disabled={!inputValue.trim() || thinking} className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-30 transition-transform active:scale-95" style={{ color: 'var(--ely-accent)' }}>
                    {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </main>
          {page === 'inicio' && (
            <div className="pr-5 py-5 hidden lg:flex">
              <SystemPanel />
            </div>
          )}
        </div>
        <footer className="h-9 flex items-center justify-between px-5 text-[11px]" style={{ borderTop: '1px solid var(--ely-header-border)', color: 'var(--ely-text-dim)' }}>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ely-success)' }} />
              Activo · {operator}
            </span>
            <span>{formatUptime(uptime)}</span>
          </span>
          <span>{currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </footer>
      </div>
    </div>
  );
}
