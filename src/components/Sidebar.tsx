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
  CalendarDays,
} from 'lucide-react';

export type AppPage =
  | 'inicio'
  | 'asistente'
  | 'config'
  | 'productos'
  | 'registro-prensa'
  | 'afq'
  | 'cronograma';

interface SidebarProps {
  active: AppPage;
  onNavigate: (page: AppPage) => void;
  hasApiKey?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  operator?: string;
  onLogout?: () => void;
}

function navClass(active: boolean, collapsed: boolean) {
  return `ely-nav-item ${active ? 'active' : ''} ${
    collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3.5 py-2.5'
  }`;
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
  const labPages: AppPage[] = ['productos', 'registro-prensa', 'afq', 'cronograma'];
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
      className={`flex-shrink-0 flex flex-col hud-glass h-full relative overflow-hidden transition-all duration-300 ease-out ${
        collapsed ? 'w-[72px]' : 'w-[232px]'
      }`}
      style={{ borderRight: '1px solid var(--ely-border)' }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(to right, transparent, var(--ely-accent), transparent)',
          opacity: 0.45,
        }}
      />

      <div className={`pt-5 pb-5 flex items-center ${collapsed ? 'flex-col gap-3 px-2' : 'gap-3 px-4'}`}>
        <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
          <div className="absolute inset-0 rounded-full animate-pulse-glow" style={{ background: 'var(--ely-accent-soft)' }} />
          <div className="absolute inset-1 rounded-full" style={{ border: '1px solid var(--ely-border-strong)' }} />
          <svg viewBox="0 0 40 40" className="w-8 h-8 relative z-10">
            <circle cx="20" cy="20" r="7" fill="none" stroke="var(--ely-accent)" strokeWidth="1.5" opacity="0.95" />
            <ellipse cx="20" cy="20" rx="15" ry="6.5" fill="none" stroke="var(--ely-accent)" strokeWidth="1" opacity="0.5" />
            <ellipse cx="20" cy="20" rx="15" ry="6.5" fill="none" stroke="var(--ely-accent)" strokeWidth="1" opacity="0.5" transform="rotate(60 20 20)" />
            <ellipse cx="20" cy="20" rx="15" ry="6.5" fill="none" stroke="var(--ely-accent)" strokeWidth="1" opacity="0.5" transform="rotate(120 20 20)" />
            <circle cx="20" cy="20" r="2.8" fill="var(--ely-accent)" />
            <circle cx="20" cy="20" r="1.2" fill="var(--ely-text)" />
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-[15px] tracking-[0.15em] leading-tight text-glow" style={{ color: 'var(--ely-text)' }}>
              ELYRA
            </h1>
            <p className="text-[10px] tracking-[0.2em] uppercase mt-0.5" style={{ color: 'var(--ely-text-muted)' }}>
              Sistema Inteligente
            </p>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="no-drag shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all"
          style={{ color: 'var(--ely-text-muted)' }}
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
              className={navClass(isActive, collapsed)}
            >
              <item.icon className="w-4 h-4 shrink-0" style={{ color: isActive ? 'var(--ely-accent)' : undefined }} />
              {!collapsed && (
                <>
                  <span className="tracking-wide truncate">{item.label}</span>
                  {isActive && <span className="ely-nav-dot ml-auto w-1.5 h-1.5 rounded-full shrink-0" />}
                </>
              )}
            </button>
          );
        })}

        {collapsed ? (
          <button
            onClick={() => {
              setLabOpen(true);
              onNavigate('productos');
            }}
            title="Laboratorio"
            className={navClass(labActive, true)}
          >
            <FlaskConical className="w-4 h-4 shrink-0" style={{ color: labActive ? 'var(--ely-accent)' : undefined }} />
          </button>
        ) : (
          <div className="space-y-1">
            <button onClick={() => setLabOpen((v) => !v)} className={navClass(labActive, false)}>
              <FlaskConical className="w-4 h-4 shrink-0" style={{ color: labActive ? 'var(--ely-accent)' : undefined }} />
              <span className="tracking-wide flex-1 text-left">Laboratorio</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${labOpen ? 'rotate-180' : ''}`}
                style={{ color: 'var(--ely-text-dim)' }}
              />
            </button>

            {labOpen && (
              <div className="ml-2 pl-2.5 space-y-1" style={{ borderLeft: '1px solid var(--ely-border)' }}>
                <button onClick={() => onNavigate('productos')} className={navClass(active === 'productos', false) + ' !py-2 !px-2.5 text-[13px]'}>
                  <Package className="w-3.5 h-3.5 shrink-0" style={{ color: active === 'productos' ? 'var(--ely-accent)' : undefined }} />
                  <span className="tracking-wide truncate">Cadmio y Plaguicidas</span>
                  {active === 'productos' && <span className="ely-nav-dot ml-auto w-1.5 h-1.5 rounded-full shrink-0" />}
                </button>

                <div className="space-y-0.5">
                  <button onClick={() => setDatosOpen((v) => !v)} className={navClass(datosPages.includes(active), false) + ' !py-2 !px-2.5 text-[13px]'}>
                    <Database className="w-3.5 h-3.5 shrink-0" style={{ color: datosPages.includes(active) ? 'var(--ely-accent)' : undefined }} />
                    <span className="tracking-wide flex-1 text-left truncate">Datos</span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-200 ${datosOpen ? 'rotate-180' : ''}`}
                      style={{ color: 'var(--ely-text-dim)' }}
                    />
                  </button>

                  {datosOpen && (
                    <div className="ml-2 pl-2 space-y-0.5" style={{ borderLeft: '1px solid var(--ely-border)' }}>
                      <button
                        onClick={() => onNavigate('registro-prensa')}
                        className={navClass(active === 'registro-prensa', false) + ' !py-1.5 !px-2.5 text-[12px]'}
                      >
                        <ClipboardList className="w-3 h-3 shrink-0" />
                        <span className="truncate">Registro de prensa</span>
                        {active === 'registro-prensa' && <span className="ely-nav-dot ml-auto w-1.5 h-1.5 rounded-full shrink-0" />}
                      </button>
                      <button onClick={() => onNavigate('afq')} className={navClass(active === 'afq', false) + ' !py-1.5 !px-2.5 text-[12px]'}>
                        <Beaker className="w-3 h-3 shrink-0" />
                        <span className="truncate">AFQ</span>
                        {active === 'afq' && <span className="ely-nav-dot ml-auto w-1.5 h-1.5 rounded-full shrink-0" />}
                      </button>
                    </div>
                  )}
                </div>

                <button onClick={() => onNavigate('cronograma')} className={navClass(active === 'cronograma', false) + ' !py-2 !px-2.5 text-[13px]'}>
                  <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: active === 'cronograma' ? 'var(--ely-accent)' : undefined }} />
                  <span className="tracking-wide truncate">Cronograma</span>
                  {active === 'cronograma' && <span className="ely-nav-dot ml-auto w-1.5 h-1.5 rounded-full shrink-0" />}
                </button>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => onNavigate('config')}
          title={collapsed ? 'Configuración' : undefined}
          className={navClass(active === 'config', collapsed)}
        >
          <Settings className="w-4 h-4 shrink-0" style={{ color: active === 'config' ? 'var(--ely-accent)' : undefined }} />
          {!collapsed && (
            <>
              <span className="tracking-wide truncate">Configuración</span>
              {active === 'config' && <span className="ely-nav-dot ml-auto w-1.5 h-1.5 rounded-full shrink-0" />}
            </>
          )}
        </button>
      </nav>

      <div
        className={`${collapsed ? 'px-2 py-4' : 'px-4 pb-5 pt-4 space-y-3'}`}
        style={{ borderTop: '1px solid var(--ely-border)' }}
      >
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2.5 px-1">
              <div
                className="relative w-8 h-8 rounded-full flex items-center justify-center"
                style={{ border: '1px solid var(--ely-border)', background: 'var(--ely-accent-soft)' }}
              >
                <Activity className="w-3.5 h-3.5" style={{ color: 'var(--ely-accent)' }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium tracking-wide truncate" style={{ color: 'var(--ely-text)' }}>
                  {operator || 'ELYRA Online'}
                </p>
                <p className="text-[10px] flex items-center gap-1" style={{ color: 'var(--ely-text-muted)' }}>
                  <Zap className="w-2.5 h-2.5" /> Operador activo
                </p>
              </div>
            </div>
            <div className="space-y-1.5 px-1">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--ely-success)', boxShadow: '0 0 8px var(--ely-success)' }} />
                <span className="text-[11px] tracking-wide" style={{ color: 'var(--ely-success)' }}>
                  Sistemas operativos
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: hasApiKey ? '#a78bfa' : 'var(--ely-warning)',
                    boxShadow: hasApiKey ? '0 0 8px #a78bfa' : undefined,
                  }}
                />
                <span className="text-[11px] tracking-wide" style={{ color: hasApiKey ? '#c4b5fd' : 'var(--ely-warning)' }}>
                  {hasApiKey ? 'IA conectada' : 'Sin API key'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3 h-3" style={{ color: 'var(--ely-text-dim)' }} />
                <span className="text-[10px]" style={{ color: 'var(--ely-text-dim)' }}>
                  v4.3 · Elite
                </span>
              </div>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-[12px] transition-all mt-1"
                style={{ color: 'var(--ely-text-muted)' }}
              >
                <LogOut className="w-3.5 h-3.5" />
                Cerrar sesión
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--ely-success)' }} title="Sistemas OK" />
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: hasApiKey ? '#a78bfa' : 'var(--ely-warning)' }}
              title={hasApiKey ? 'IA conectada' : 'Sin API key'}
            />
            {onLogout && (
              <button onClick={onLogout} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: 'var(--ely-text-dim)' }} title="Cerrar sesión">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
