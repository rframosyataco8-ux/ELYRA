import { useState } from 'react';
import {
  Home,
  MessageSquare,
  Settings,
  Activity,
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
    collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-4 py-2.5'
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
      className={`flex-shrink-0 flex flex-col h-full relative overflow-hidden transition-all duration-250 ease-out ${
        collapsed ? 'w-[72px]' : 'w-[240px]'
      }`}
      style={{
        background: 'var(--ely-bg-elevated)',
        borderRight: '1px solid var(--ely-border)',
      }}
    >
      {/* Brand */}
      <div className={`pt-5 pb-4 flex items-center ${collapsed ? 'flex-col gap-3 px-2' : 'gap-3 px-4'}`}>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'var(--ely-accent-soft)' }}
        >
          <svg viewBox="0 0 40 40" className="w-5 h-5">
            <circle cx="20" cy="20" r="7" fill="none" stroke="var(--ely-accent)" strokeWidth="2" />
            <circle cx="20" cy="20" r="2.5" fill="var(--ely-accent)" />
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <h1
              className="font-medium text-[15px] tracking-tight leading-tight"
              style={{ color: 'var(--ely-text)' }}
            >
              ELYRA
            </h1>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ely-text-muted)' }}>
              Asistente inteligente
            </p>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="no-drag shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
          style={{ color: 'var(--ely-text-muted)' }}
          title={collapsed ? 'Expandir menú' : 'Retraer menú'}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 space-y-0.5 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
        {topItems.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              className={navClass(isActive, collapsed)}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
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
            <FlaskConical className="w-4 h-4 shrink-0" />
          </button>
        ) : (
          <div className="space-y-0.5 pt-1">
            <button onClick={() => setLabOpen((v) => !v)} className={navClass(labActive, false)}>
              <FlaskConical className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left truncate">Laboratorio</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${labOpen ? 'rotate-180' : ''}`}
                style={{ color: 'var(--ely-text-dim)' }}
              />
            </button>

            {labOpen && (
              <div className="ml-3 pl-3 space-y-0.5" style={{ borderLeft: '1px solid var(--ely-border)' }}>
                <button
                  onClick={() => onNavigate('productos')}
                  className={navClass(active === 'productos', false) + ' !py-2 !px-3 text-[13px]'}
                >
                  <Package className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Cadmio y Plaguicidas</span>
                </button>

                <div className="space-y-0.5">
                  <button
                    onClick={() => setDatosOpen((v) => !v)}
                    className={navClass(datosPages.includes(active), false) + ' !py-2 !px-3 text-[13px]'}
                  >
                    <Database className="w-3.5 h-3.5 shrink-0" />
                    <span className="flex-1 text-left truncate">Datos</span>
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
                      </button>
                      <button
                        onClick={() => onNavigate('afq')}
                        className={navClass(active === 'afq', false) + ' !py-1.5 !px-2.5 text-[12px]'}
                      >
                        <Beaker className="w-3 h-3 shrink-0" />
                        <span className="truncate">AFQ</span>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onNavigate('cronograma')}
                  className={navClass(active === 'cronograma', false) + ' !py-2 !px-3 text-[13px]'}
                >
                  <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Cronograma</span>
                </button>
              </div>
            )}
          </div>
        )}

        <div className="pt-1">
          <button
            onClick={() => onNavigate('config')}
            title={collapsed ? 'Configuración' : undefined}
            className={navClass(active === 'config', collapsed)}
          >
            <Settings className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">Configuración</span>}
          </button>
        </div>
      </nav>

      {/* Footer status */}
      <div
        className={`${collapsed ? 'px-2 py-4' : 'px-4 pb-5 pt-3 space-y-3'}`}
        style={{ borderTop: '1px solid var(--ely-border)' }}
      >
        {!collapsed ? (
          <>
            <div className="flex items-center gap-3 px-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                style={{
                  background: 'var(--ely-accent-soft)',
                  color: 'var(--ely-accent)',
                }}
              >
                {(operator || 'O').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--ely-text)' }}>
                  {operator || 'Operador'}
                </p>
                <p className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--ely-text-muted)' }}>
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: hasApiKey ? 'var(--ely-success)' : 'var(--ely-warning)' }}
                  />
                  {hasApiKey ? 'IA conectada' : 'Sin API key'}
                </p>
              </div>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-full text-[13px] transition-colors"
                style={{ color: 'var(--ely-text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ely-nav-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <LogOut className="w-3.5 h-3.5" />
                Cerrar sesión
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: hasApiKey ? 'var(--ely-success)' : 'var(--ely-warning)' }}
              title={hasApiKey ? 'IA conectada' : 'Sin API key'}
            />
            {onLogout && (
              <button
                onClick={onLogout}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ color: 'var(--ely-text-dim)' }}
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
