import { useState } from 'react';
import {
  Home,
  MessageSquare,
  Settings,
  Zap,
  Activity,
  Cpu,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Package,
  FlaskConical,
  ChevronDown,
  Database,
  ClipboardList,
  Beaker,
} from 'lucide-react';

export type AppPage =
  | 'inicio'
  | 'asistente'
  | 'config'
  | 'productos'
  | 'registro-prensa'
  | 'afq';

interface SidebarProps {
  active: AppPage;
  onNavigate: (page: AppPage) => void;
  hasApiKey?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  operator?: string;
  onLogout?: () => void;
}

export function Sidebar({
  active,
  onNavigate,
  hasApiKey,
  collapsed = false,
  onToggleCollapse,
  operator,
  onLogout,
}: SidebarProps) {
  const labPages: AppPage[] = ['productos', 'registro-prensa', 'afq'];
  const datosPages: AppPage[] = ['registro-prensa', 'afq'];
  const [labOpen, setLabOpen] = useState(labPages.includes(active));
  const [datosOpen, setDatosOpen] = useState(datosPages.includes(active));

  const topItems = [
    { id: 'inicio' as const, label: 'Inicio', icon: Home },
    { id: 'asistente' as const, label: 'Conversación', icon: MessageSquare },
  ];

  const labActive = labPages.includes(active);

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

      <nav className={`flex-1 space-y-1.5 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
        {topItems.map((item) => {
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
                  <span className="tracking-wide truncate">{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_10px_#38bdf8] shrink-0" />
                  )}
                </>
              )}
            </button>
          );
        })}

        {/* Laboratorio */}
        {collapsed ? (
          <button
            onClick={() => {
              setLabOpen(true);
              onNavigate('productos');
            }}
            title="Laboratorio"
            className={`w-full flex items-center justify-center px-0 py-2.5 rounded-xl text-sm transition-all duration-250 ${
              labActive
                ? 'bg-sky-500/20 text-sky-100 border border-sky-400/35 shadow-[0_0_28px_rgba(14,165,233,0.2)]'
                : 'text-sky-200/50 hover:text-sky-100/85 hover:bg-sky-500/10 border border-transparent'
            }`}
          >
            <FlaskConical className={`w-4 h-4 shrink-0 ${labActive ? 'text-sky-300' : ''}`} />
          </button>
        ) : (
          <div className="space-y-1">
            <button
              onClick={() => setLabOpen((v) => !v)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-250 ${
                labActive
                  ? 'bg-sky-500/10 text-sky-100 border border-sky-400/25'
                  : 'text-sky-200/50 hover:text-sky-100/85 hover:bg-sky-500/10 border border-transparent'
              }`}
            >
              <FlaskConical className={`w-4 h-4 shrink-0 ${labActive ? 'text-sky-300' : ''}`} />
              <span className="tracking-wide flex-1 text-left">Laboratorio</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-sky-400/50 transition-transform duration-200 ${labOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {labOpen && (
              <div className="ml-2 pl-2.5 border-l border-sky-500/20 space-y-1">
                {/* Cadmio y Plaguicidas */}
                <button
                  onClick={() => onNavigate('productos')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all ${
                    active === 'productos'
                      ? 'bg-sky-500/20 text-sky-100 border border-sky-400/35 shadow-[0_0_20px_rgba(14,165,233,0.15)]'
                      : 'text-sky-300/55 hover:text-sky-100 hover:bg-sky-500/10 border border-transparent'
                  }`}
                >
                  <Package className={`w-3.5 h-3.5 shrink-0 ${active === 'productos' ? 'text-sky-300' : ''}`} />
                  <span className="tracking-wide truncate">Cadmio y Plaguicidas</span>
                  {active === 'productos' && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_10px_#38bdf8] shrink-0" />
                  )}
                </button>

                {/* Datos (submenú) */}
                <div className="space-y-0.5">
                  <button
                    onClick={() => setDatosOpen((v) => !v)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all ${
                      datosPages.includes(active)
                        ? 'bg-sky-500/10 text-sky-100 border border-sky-400/20'
                        : 'text-sky-300/55 hover:text-sky-100 hover:bg-sky-500/10 border border-transparent'
                    }`}
                  >
                    <Database className={`w-3.5 h-3.5 shrink-0 ${datosPages.includes(active) ? 'text-sky-300' : ''}`} />
                    <span className="tracking-wide flex-1 text-left truncate">Datos</span>
                    <ChevronDown
                      className={`w-3 h-3 text-sky-400/45 transition-transform duration-200 ${datosOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {datosOpen && (
                    <div className="ml-2 pl-2 border-l border-sky-500/15 space-y-0.5">
                      <button
                        onClick={() => onNavigate('registro-prensa')}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] transition-all ${
                          active === 'registro-prensa'
                            ? 'bg-sky-500/20 text-sky-100 border border-sky-400/35'
                            : 'text-sky-400/60 hover:text-sky-100 hover:bg-sky-500/10 border border-transparent'
                        }`}
                      >
                        <ClipboardList className="w-3 h-3 shrink-0" />
                        <span className="truncate">Registro de prensa</span>
                        {active === 'registro-prensa' && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8] shrink-0" />
                        )}
                      </button>
                      <button
                        onClick={() => onNavigate('afq')}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] transition-all ${
                          active === 'afq'
                            ? 'bg-sky-500/20 text-sky-100 border border-sky-400/35'
                            : 'text-sky-400/60 hover:text-sky-100 hover:bg-sky-500/10 border border-transparent'
                        }`}
                      >
                        <Beaker className="w-3 h-3 shrink-0" />
                        <span className="truncate">AFQ</span>
                        {active === 'afq' && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8] shrink-0" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Configuración */}
        <button
          onClick={() => onNavigate('config')}
          title={collapsed ? 'Configuración' : undefined}
          className={`w-full flex items-center rounded-xl text-sm transition-all duration-250 ${
            collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3.5 py-2.5'
          } ${
            active === 'config'
              ? 'bg-sky-500/20 text-sky-100 border border-sky-400/35 shadow-[0_0_28px_rgba(14,165,233,0.2)]'
              : 'text-sky-200/50 hover:text-sky-100/85 hover:bg-sky-500/10 border border-transparent'
          }`}
        >
          <Settings className={`w-4 h-4 shrink-0 ${active === 'config' ? 'text-sky-300' : ''}`} />
          {!collapsed && (
            <>
              <span className="tracking-wide truncate">Configuración</span>
              {active === 'config' && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_10px_#38bdf8] shrink-0" />
              )}
            </>
          )}
        </button>
      </nav>

      <div className={`border-t border-sky-500/12 ${collapsed ? 'px-2 py-4' : 'px-4 pb-5 pt-4 space-y-3'}`}>
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2.5 px-1">
              <div className="relative w-8 h-8 rounded-full border border-sky-500/30 flex items-center justify-center bg-sky-500/8">
                <Activity className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-white/90 font-medium tracking-wide truncate">
                  {operator || 'ELYRA Online'}
                </p>
                <p className="text-[10px] text-sky-400/55 flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5" /> Operador activo
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
                <span className="text-[10px] text-sky-500/50">v4.2 · Elite</span>
              </div>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-[12px] text-sky-400/60 hover:text-red-300/90 hover:bg-red-500/10 border border-transparent hover:border-red-400/20 transition-all mt-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                Cerrar sesión
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" title="Sistemas OK" />
            <span
              className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-violet-400 shadow-[0_0_8px_#a78bfa]' : 'bg-amber-400/70'}`}
              title={hasApiKey ? 'IA conectada' : 'Sin API key'}
            />
            {onLogout && (
              <button
                onClick={onLogout}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sky-500/50 hover:text-red-300 hover:bg-red-500/10 transition-all"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
