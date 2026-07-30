import { Home, MessageSquare, Settings, Zap, Activity, Cpu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface SidebarProps {
  active: 'inicio' | 'asistente' | 'config';
  onNavigate: (page: 'inicio' | 'asistente' | 'config') => void;
  hasApiKey?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ active, onNavigate, hasApiKey, collapsed = false, onToggleCollapse }: SidebarProps) {
  const items = [
    { id: 'inicio' as const, label: 'Inicio', icon: Home },
    { id: 'asistente' as const, label: 'Conversación', icon: MessageSquare },
    { id: 'config' as const, label: 'Configuración', icon: Settings },
  ];

  return (
    <aside
      className={`flex-shrink-0 flex flex-col hud-glass border-r border-sky-500/12 h-full relative overflow-hidden transition-all duration-300 ease-out ${
        collapsed ? 'w-[72px]' : 'w-[232px]'
      }`}
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />
      <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-sky-500/20 via-sky-500/5 to-transparent" />

      <div className={`pt-5 pb-5 flex items-center ${collapsed ? 'flex-col gap-3 px-2' : 'gap-3 px-4'}`}>
        <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
          <div className="absolute inset-0 rounded-full bg-sky-500/20 animate-pulse-glow" />
          <div className="absolute inset-1 rounded-full border border-sky-400/30" />
          <svg viewBox="0 0 40 40" className="w-8 h-8 relative z-10">
            <circle cx="20" cy="20" r="7" fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.95" />
            <ellipse cx="20" cy="20" rx="15" ry="6.5" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.5" />
            <ellipse cx="20" cy="20" rx="15" ry="6.5" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.5" transform="rotate(60 20 20)" />
            <ellipse cx="20" cy="20" rx="15" ry="6.5" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.5" transform="rotate(120 20 20)" />
            <circle cx="20" cy="20" r="2.8" fill="#7dd3fc" />
            <circle cx="20" cy="20" r="1.2" fill="#e0f2fe" />
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <h1 className="text-white font-semibold text-[15px] tracking-[0.15em] leading-tight text-glow">ELYRA</h1>
            <p className="text-[10px] text-sky-400/60 tracking-[0.2em] uppercase mt-0.5">Sistema Inteligente</p>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="no-drag shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sky-400/55 hover:text-sky-200 hover:bg-sky-500/15 border border-transparent hover:border-sky-500/20 transition-all"
          title={collapsed ? 'Expandir menú' : 'Retraer menú'}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      <nav className={`flex-1 space-y-1.5 ${collapsed ? 'px-2' : 'px-3'}`}>
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center rounded-xl text-sm transition-all duration-250 ${
                collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3.5 py-2.5'
              } ${
                isActive
                  ? 'bg-sky-500/20 text-sky-100 border border-sky-400/35 shadow-[0_0_28px_rgba(14,165,233,0.2)]'
                  : 'text-sky-200/50 hover:text-sky-100/85 hover:bg-sky-500/10 border border-transparent'
              }`}
            >
              <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-300' : ''}`} />
              {!collapsed && (
                <>
                  <span className="tracking-wide">{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_10px_#38bdf8]" />
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      <div className={`border-t border-sky-500/12 ${collapsed ? 'px-2 py-4' : 'px-4 pb-5 pt-4 space-y-3'}`}>
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2.5 px-1">
              <div className="relative w-8 h-8 rounded-full border border-sky-500/30 flex items-center justify-center bg-sky-500/8">
                <Activity className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div>
                <p className="text-xs text-white/90 font-medium tracking-wide">ELYRA Online</p>
                <p className="text-[10px] text-sky-400/55 flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5" /> Modo autónomo
                </p>
              </div>
            </div>
            <div className="space-y-1.5 px-1">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
                <span className="text-[11px] text-emerald-400/90 tracking-wide">Sistemas operativos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    hasApiKey ? 'bg-violet-400 shadow-[0_0_8px_#a78bfa]' : 'bg-amber-400/70'
                  }`}
                />
                <span className={`text-[11px] tracking-wide ${hasApiKey ? 'text-violet-300/85' : 'text-amber-400/80'}`}>
                  {hasApiKey ? 'IA conectada' : 'Sin API key'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3 h-3 text-sky-500/50" />
                <span className="text-[10px] text-sky-500/50">v3.0 · Holographic</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" title="Sistemas OK" />
            <span
              className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-violet-400 shadow-[0_0_8px_#a78bfa]' : 'bg-amber-400/70'}`}
              title={hasApiKey ? 'IA conectada' : 'Sin API key'}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
