import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Estado vacío coherente con el diseño ELYRA */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex-1 flex flex-col items-center justify-center text-center space-y-3 px-6 py-10 animate-fade-in ${className}`.trim()}
      role="status"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{
          background: 'var(--ely-accent-soft)',
          border: '1px solid var(--ely-border)',
        }}
      >
        <Icon className="w-7 h-7" style={{ color: 'var(--ely-accent)' }} />
      </div>
      <h2 className="text-lg font-medium tracking-wide" style={{ color: 'var(--ely-text)' }}>
        {title}
      </h2>
      {description && (
        <p className="text-sm max-w-sm leading-relaxed" style={{ color: 'var(--ely-text-muted)' }}>
          {description}
        </p>
      )}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
