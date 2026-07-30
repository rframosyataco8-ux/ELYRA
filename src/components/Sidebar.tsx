import { Home, MessageSquare, Settings, Zap, Activity } from 'lucide-react';

interface SidebarProps {
  active: 'inicio' | 'asistente' | 'config';
  onNavigate: (page: 'inicio' | 'asistente' | 'config') => void;
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  const items = [
    { id: 'inicio' as const, label: 'Inicio', icon: Home },
    { id: 'asistente' as const, label: 'Conversación', icon: MessageSquare },
    { id: 'config' as const, label: 'Configuración', icon: Settings },
  ];

  return (
    <aside className="w-[228px] flex-shrink-0 flex flex-col hud-glass border-r border-sky-500/10 h-full relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />

      <div className="px-5 pt-6 pb-7 flex items-center gap-3">
        <div className="relative w-10 h-10 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-sky-500/25 animate-pulse-glow" />
          <svg viewBox="0 0 40 40" className="w-9 h-9 relative z-10">
            <circle cx="20" cy="20" r="7" fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.9" />
            <ellipse cx="20" cy="20" rx="15" ry="6.5" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.55" />
            <ellipse cx="20" cy="20" rx="15" ry="6.5" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.55" transform="rotate(60 20 20)" />
            <ellipse cx="20" cy="20" rx="15" ry="6.5" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.55" transform="rotate(120 20 20)" />
            <circle cx="20" cy="20" r="2.8" fill="#7dd3fc" />
            <circle cx="20" cy="20" r="1.2" fill="#e0f2fe" />
          </svg>
        </div>
        <div>
          <h1 className="text-white font-semibold text-[15px] tracking-[0.12em] leading-tight text-glow">ELYRA</h1>
          <p className="text-[10px] text-sky-400/55 tracking-[0.18em] uppercase">Sistema Inteligente</p>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1.5">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-sky-500/18 text-sky-200 border border-sky-400/30 shadow-[0_0_24px_rgba(14,165,233,0.18)]'
                  : 'text-sky-200/45 hover:text-sky-100/80 hover:bg-sky-500/8 border border-transparent'
              }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? 'text-sky-300' : ''}`} />
              <span className="tracking-wide">{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-4 pb-5 pt-4 border-t border-sky-500/10 space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <div className="relative w-8 h-8 rounded-full border border-sky-500/25 flex items-center justify-center bg-sky-500/5">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div>
            <p className="text-xs text-white/85 font-medium tracking-wide">ELYRA Online</p>
            <p className="text-[10px] text-sky-400/50 flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" /> Modo autónomo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
          <span className="text-[11px] text-emerald-400/85 tracking-wide">Sistemas operativos</span>
        </div>
      </div>
    </aside>
  );
}
