import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { processCommand } from '@/lib/commands';
import { supabase } from '@/lib/supabase';
import { NetworkGlobe } from '@/components/NetworkGlobe';
import { Sidebar } from '@/components/Sidebar';
import { SystemPanel } from '@/components/SystemPanel';
import { Mic, Send } from 'lucide-react';

export interface Message {
  id: string;
  role: 'user' | 'nova';
  text: string;
  timestamp: number;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [booted, setBooted] = useState(false);
  const [page, setPage] = useState<'inicio' | 'asistente' | 'config'>('inicio');
  const [inputValue, setInputValue] = useState('');
  const [uptime, setUptime] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  const speakRef = useRef<(text: string) => void>(() => {});
  const startTimeRef = useRef(Date.now());

  const addMessage = useCallback((role: 'user' | 'nova', text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, role, text, timestamp: Date.now() },
    ]);
    supabase.from('conversation_history').insert({ role: role === 'nova' ? 'jarvis' : role, text }).then(({ error }) => {
      if (error) console.error('Error guardando mensaje:', error);
    });
  }, []);

  const handleCommand = useCallback(
    (transcript: string) => {
      addMessage('user', transcript);
      const result = processCommand(transcript);
      addMessage('nova', result.response);
      speakRef.current(result.response);
    },
    [addMessage],
  );

  const { speak, stopSpeaking, startListening, stopListening, speaking, listening, supported, error } =
    useVoice({ onCommand: handleCommand });

  speakRef.current = speak;

  // Clock + uptime
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      setUptime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load history
  useEffect(() => {
    if (!booted) return;
    supabase
      .from('conversation_history')
      .select('id, role, text, created_at')
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data, error }) => {
        if (error) return;
        if (data && data.length > 0) {
          setMessages(
            data.map((row) => ({
              id: row.id,
              role: (row.role === 'jarvis' ? 'nova' : row.role) as 'user' | 'nova',
              text: row.text,
              timestamp: new Date(row.created_at).getTime(),
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
        const bootMsg = 'Sistema iniciado. Todos los módulos operativos. Hola, estoy lista para ayudarte.';
        addMessage('nova', bootMsg);
        setTimeout(() => speak(bootMsg), 400);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [booted, addMessage, speak]);

  const handleToggleListen = () => {
    if (listening) stopListening();
    else startListening();
  };

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text) return;
    setInputValue('');
    addMessage('user', text);
    const result = processCommand(text);
    addMessage('nova', result.response);
    speak(result.response);
  };

  const formatUptime = (s: number) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    return `${h}h ${m}m ${s % 60}s`;
  };

  const statusLabel = speaking ? 'Hablando...' : listening ? 'Conversando...' : 'En espera';

  return (
    <div className="h-screen w-screen bg-[#030810] text-sky-100 flex overflow-hidden select-none">
      {/* Left Sidebar */}
      <Sidebar active={page} onNavigate={setPage} />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Top bar */}
        <header className="h-10 flex items-center justify-end px-4 gap-2 border-b border-sky-500/10">
          <button className="w-3 h-3 rounded-sm bg-sky-500/20 hover:bg-sky-500/40 transition-colors" />
          <button className="w-3 h-3 rounded-sm bg-sky-500/20 hover:bg-sky-500/40 transition-colors" />
          <button className="w-3 h-3 rounded-sm bg-red-500/40 hover:bg-red-500/60 transition-colors" />
        </header>

        {/* Content */}
        <div className="flex-1 flex min-h-0">
          {/* Center */}
          <main className="flex-1 flex flex-col items-center justify-between py-6 px-8 relative min-w-0">
            {/* Greeting */}
            <div className="w-full text-center space-y-2 z-10">
              <h2 className="text-2xl font-semibold text-white tracking-wide">Hola, Fabricio</h2>
              <p className="text-sm text-sky-300/60">Estoy monitoreando tu PC y lista para ayudarte.</p>
              <div className="inline-flex items-center gap-2 mt-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20">
                <span className={`w-1.5 h-1.5 rounded-full ${speaking || listening ? 'bg-sky-400 animate-pulse' : 'bg-sky-500/50'}`} />
                <span className="text-xs text-sky-300/80">{statusLabel}</span>
              </div>
            </div>

            {/* Interactive Globe */}
            <div className="flex-1 flex items-center justify-center relative">
              <NetworkGlobe speaking={speaking} listening={listening} size={400} />
            </div>

            {/* Input bar */}
            <div className="w-full max-w-xl z-10">
              {!supported && (
                <p className="text-amber-400/70 text-xs text-center mb-2">
                  Tu navegador no soporta voz. Usa Chrome o Edge. Puedes escribir comandos.
                </p>
              )}
              {error && (
                <p className="text-red-400/70 text-xs text-center mb-2">{error}</p>
              )}

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
                  <Mic className="w-4.5 h-4.5" />
                </button>

                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Puedes preguntarme o darme una orden..."
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

          {/* Right panel */}
          <div className="pr-5 py-5 flex flex-col">
            <SystemPanel />
          </div>
        </div>

        {/* Bottom status bar */}
        <footer className="h-9 flex items-center justify-between px-5 border-t border-sky-500/10 text-[11px] text-sky-400/50">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Conectado
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              Uptime: {formatUptime(uptime)}
            </span>
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
