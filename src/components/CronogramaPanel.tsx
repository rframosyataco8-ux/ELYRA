import { CalendarDays } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

/** Genera 7 celdas de la semana actual (solo UI; sin backend aún) */
function weekLabels(): { day: string; date: number; isToday: boolean }[] {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // lunes = 0
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);

  return DAYS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      day: label,
      date: d.getDate(),
      isToday: d.toDateString() === now.toDateString(),
    };
  });
}

export function CronogramaPanel() {
  const week = weekLabels();

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-5 px-1">
        <CalendarDays className="w-4 h-4" style={{ color: 'var(--ely-accent)' }} />
        <h2 className="text-lg font-medium" style={{ color: 'var(--ely-text)' }}>
          Cronograma
        </h2>
      </div>

      <div
        className="hud-glass p-4 mb-4"
        style={{ border: '1px solid var(--ely-border)' }}
      >
        <p className="text-[11px] tracking-wide uppercase mb-3" style={{ color: 'var(--ely-text-dim)' }}>
          Esta semana
        </p>
        <div className="grid grid-cols-7 gap-2">
          {week.map((d) => (
            <div
              key={d.day}
              className="flex flex-col items-center gap-1.5 rounded-xl py-2.5 transition-colors"
              style={{
                background: d.isToday ? 'var(--ely-accent-soft)' : 'var(--ely-bg-soft)',
                border: `1px solid ${d.isToday ? 'var(--ely-accent)' : 'var(--ely-border)'}`,
              }}
            >
              <span className="text-[10px] font-medium" style={{ color: 'var(--ely-text-muted)' }}>
                {d.day}
              </span>
              <span
                className="text-sm font-medium tabular-nums"
                style={{ color: d.isToday ? 'var(--ely-accent)' : 'var(--ely-text)' }}
              >
                {d.date}
              </span>
            </div>
          ))}
        </div>
      </div>

      <EmptyState
        icon={CalendarDays}
        title="Sin eventos programados"
        description="El cronograma de laboratorio se conectará a datos reales. Por ahora puedes planificar desde aquí cuando esté disponible."
      />
    </div>
  );
}
