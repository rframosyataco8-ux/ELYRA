import { useEffect, useRef } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'elyra';
  text: string;
  timestamp: number;
}

interface Props {
  messages: Message[];
  compact?: boolean;
}

export function ConversationLog({ messages, compact }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages]);

  if (!messages.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-sky-500/35 text-sm tracking-wide">
        La conversación aparecerá aquí.
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`flex-1 overflow-y-auto space-y-3 pr-1 ${compact ? 'max-h-28' : ''}`}
    >
      {messages.map((m, idx) => (
        <div
          key={m.id}
          className={`flex animate-fade-in ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          style={{ animationDelay: `${Math.min(idx * 30, 120)}ms` }}
        >
          <div
            className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
              m.role === 'user'
                ? 'bg-sky-500/18 text-sky-50 border border-sky-400/25 rounded-br-md shadow-[0_0_16px_rgba(14,165,233,0.08)]'
                : 'hud-glass text-sky-50/95 border border-sky-500/15 rounded-bl-md'
            }`}
          >
            {m.role === 'elyra' && (
              <span className="block text-[9px] tracking-[0.2em] uppercase text-sky-400/50 mb-1">
                ELYRA
              </span>
            )}
            <p className="whitespace-pre-wrap">{m.text}</p>
            <span className="block text-[10px] text-sky-500/35 mt-1.5">
              {new Date(m.timestamp).toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
