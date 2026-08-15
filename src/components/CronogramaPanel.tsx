import { CalendarDays } from 'lucide-react';

export function CronogramaPanel() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 px-6 animate-fade-in">
      <CalendarDays className="w-10 h-10" style={{ color: 'var(--ely-text-dim)' }} />
      <h2 className="text-lg font-medium tracking-wide" style={{ color: 'var(--ely-text)' }}>
        Cronograma
      </h2>
      <p className="text-sm max-w-xs" style={{ color: 'var(--ely-text-muted)' }}>
        Cronograma de laboratorio. Sección en preparación.
      </p>
    </div>
  );
}
