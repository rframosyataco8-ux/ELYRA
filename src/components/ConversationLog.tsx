import { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

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
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  if (!messages.length) {
    if (compact) {
      return (
        <div
          className="flex items-center justify-center text-[12px] py-4"
          style={{ color: 'var(--ely-text-dim)' }}
        >
          La conversación aparecerá aquí
        </div>
      );
    }
    return (
      <EmptyState
        icon={MessageSquare}
        title="Sin mensajes aún"
        description="Escribe o habla con ELYRA. La conversación se mostrará aquí."
      />
    );
  }

  return (
    <div
      ref={ref}
      className={`flex-1 overflow-y-auto space-y-3 pr-1 ${compact ? 'max-h-28' : ''}`}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.map((m) => (
        <div
          key={m.id}
          className={`flex ely-msg-enter ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
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
            data-role={m.role}
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
            <span className="block text-[10px] mt-1.5" style={{ color: 'var(--ely-text-dim)' }}>
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
