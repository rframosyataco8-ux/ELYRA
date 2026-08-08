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
      <div
        className="flex-1 flex items-center justify-center text-sm"
        style={{ color: 'var(--ely-text-dim)' }}
      >
        <div className="text-center space-y-2">
          <div
            className="w-10 h-10 mx-auto rounded-full flex items-center justify-center"
            style={{ background: 'var(--ely-accent-soft)', color: 'var(--ely-accent)' }}
          >
            <span className="text-lg">◈</span>
          </div>
          <p>La conversación aparecerá aquí</p>
        </div>
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
          style={{ animationDelay: `${Math.min(idx * 20, 80)}ms` }}
        >
          <div
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
              m.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'
            }`}
            style={{
              background: m.role === 'user' ? 'var(--ely-accent-soft)' : 'var(--ely-surface)',
              color: 'var(--ely-text)',
              border: `1px solid ${m.role === 'user' ? 'transparent' : 'var(--ely-border)'}`,
            }}
          >
            {m.role === 'elyra' && (
              <span
                className="block text-[10px] tracking-wide uppercase mb-1 font-medium"
                style={{ color: 'var(--ely-accent)' }}
              >
                ELYRA
              </span>
            )}
            <p className="whitespace-pre-wrap">{m.text}</p>
            <span
              className="block text-[10px] mt-1.5"
              style={{ color: 'var(--ely-text-dim)' }}
            >
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
