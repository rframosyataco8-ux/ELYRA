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
      <div className="flex-1 flex items-center justify-center text-sky-500/40 text-sm">
        La conversación aparecerá aquí.
      </div>
    );
  }

  return (
    <div ref={ref} className={`flex-1 overflow-y-auto space-y-3 pr-1 ${compact ? 'max-h-32' : ''}`}>
      {messages.map((m) => (
        <div
          key={m.id}
          className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
              m.role === 'user'
                ? 'bg-sky-500/20 text-sky-100 border border-sky-500/25 rounded-br-md'
                : 'bg-white/5 text-sky-50/90 border border-white/10 rounded-bl-md'
            }`}
          >
            <p className="whitespace-pre-wrap">{m.text}</p>
            <span className="block text-[10px] text-sky-500/40 mt-1">
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
