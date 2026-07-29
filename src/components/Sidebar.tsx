import { Home, MessageSquare, Settings } from 'lucide-react';

interface SidebarProps {
  active: 'inicio' | 'asistente' | 'config';
  onNavigate: (page: 'inicio' | 'asistente' | 'config') => void;
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  const items = [
    { id: 'inicio' as const, label: 'Inicio', icon: Home },
    { id: 'asistente' as const, label: 'Asistente', icon: MessageSquare },
    { id: 'config' as const, label: 'Configuración', icon: Settings },
  ];

  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col bg-[#060d18]/90 border-r border-sky-500/10 h-full">
      {/* Logo */}
      <div className="px-5 pt-6 pb-8 flex items-center gap-3">
        <div className="relative w-9 h-9 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-sky-500/20 animate-pulse" />
          <svg viewBox="0 0 40 40" className="w-8 h-8 relative z-10">
            <circle cx="20" cy="20" r="6" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
            <ellipse cx="20" cy="20" rx="14" ry="6" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.7" />
            <ellipse cx="20" cy="20" rx="14" ry="6" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.7" transform="rotate(60 20 20)" />
            <ellipse cx="20" cy="20" rx="14" ry="6" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.7" transform="rotate(120 20 20)" />
            <circle cx="20" cy="20" r="2.5" fill="#7dd3fc" />
          </svg>
        </div>
        <div>
          <h1 className="text-white font-semibold text-[15px] tracking-wide leading-tight">NOVA AI</h1>
          <p className="text-[10px] text-sky-400/60 tracking-wider">Asistente Inteligente</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/25 shadow-[0_0_20px_rgba(14,165,233,0.15)]'
                  : 'text-sky-200/50 hover:text-sky-200/80 hover:bg-sky-500/5 border border-transparent'
              }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : ''}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Bottom status */}
      <div className="px-4 pb-5 pt-3 border-t border-sky-500/10">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="relative w-8 h-8 rounded-full border border-sky-500/30 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-sky-400/60 border-t-transparent animate-spin" style={{ animationDuration: '3s' }} />
            <div className="absolute w-2 h-2 rounded-full bg-sky-400" />
          </div>
          <div>
            <p className="text-xs text-white/80 font-medium">NOVA AI</p>
            <p className="text-[10px] text-sky-400/50">Modo Autónomo</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
          <span className="text-[11px] text-emerald-400/80">Activo</span>
        </div>
      </div>
    </aside>
  );
}
