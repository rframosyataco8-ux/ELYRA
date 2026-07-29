import { useEffect, useRef } from 'react';
import { User, Cpu } from 'lucide-react';

export interface Message {
  id: string;
  role: 'user' | 'jarvis';
  text: string;
  timestamp: number;
}

interface ConversationLogProps {
  messages: Message[];
}

export function ConversationLog({ messages }: ConversationLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-2 min-h-0">
      {messages.length === 0 && (
        <div className="text-center text-jarvis-500/50 text-sm py-8">
          <p className="font-display tracking-widest text-xs uppercase mb-2">Sistema Inactivo</p>
          <p>Pulse el micrófono o escriba para iniciar la comunicación.</p>
        </div>
      )}
      {messages.map((msg) => (
        <div key={msg.id} className={`flex gap-3 animate-fade-in ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center ${
              msg.role === 'user'
                ? 'border-jarvis-500/40 bg-dark-700'
                : 'border-jarvis-glow/60 bg-jarvis-glow/10'
            }`}
          >
            {msg.role === 'user' ? (
              <User className="w-4 h-4 text-jarvis-300" />
            ) : (
              <Cpu className="w-4 h-4 text-jarvis-glow" />
            )}
          </div>
          <div
            className={`max-w-[75%] rounded-lg px-4 py-2 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-jarvis-500/10 border border-jarvis-500/20 text-jarvis-100'
                : 'bg-jarvis-glow/5 border border-jarvis-glow/20 text-jarvis-100'
            }`}
          >
            <p className={msg.role === 'jarvis' ? 'text-glow' : ''}>{msg.text}</p>
            <span className="block text-[10px] text-jarvis-500/40 mt-1">
              {new Date(msg.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
