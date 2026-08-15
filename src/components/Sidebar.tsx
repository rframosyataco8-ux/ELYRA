import { useState, useEffect } from 'react';
import {
  Home,
  MessageSquare,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Package,
  FlaskConical,
  ChevronDown,
  ClipboardList,
  Beaker,
  CalendarDays,
} from 'lucide-react';
import type { LabUser } from '@/lib/users';
import { canAccessPage, type AppPage } from '@/lib/users';

export type { AppPage };

interface SidebarProps {
  active: AppPage;
  onNavigate: (page: AppPage) => void;
  hasApiKey?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  operator?: string;
  user?: LabUser | null;
  onLogout?: () => void;
}

function navClass(active: boolean, collapsed: boolean, nested = false) {
  const base = `ely-nav-item ${active ? 'active' : ''}`;
  if (collapsed) return `${base} justify-center px-0 py-2.5`;
  if (nested) return `${base} gap-2.5 px-3 py-2 text-[13px]`;
  return `${base} gap-3 px-3.5 py-2.5`;
}

export function Sidebar({
  active,
  onNavigate,
  hasApiKey,
  collapsed = false,
  onToggleCollapse,
  operator,
  user,
  onLogout,
}: SidebarProps) {
  const allow = (page: AppPage) => canAccessPage(user ?? null, page);

  const showProductos = allow('productos');
  const showRegistro = allow('registro-prensa');
  const showAfq = allow('afq');
  const showCronograma = allow('cronograma');
  const showLab = showProductos || showRegistro || showAfq || showCronograma;

  const labPages: AppPage[] = ['productos', 'registro-prensa', 'afq', 'cronograma'];
  const labActive = labPages.includes(active);

  // Abrir automáticamente el grupo Laboratorio si la página activa pertenece a él
  const [labOpen, setLabOpen] = useState(labActive);

  useEffect(() => {
    if (labActive) setLabOpen(true);
  }, [labActive]);

  const topItems = [
    { id: 'inicio' as const, label: 'Inicio', icon: Home },
    { id: 'asistente' as const, label: 'Conversación', icon: MessageSquare },
  ].filter((item) => allow(item.id));

  // Items de laboratorio en orden lógico de uso (sin subgrupo "Datos")
  const labItems = [
    showProductos && {
      id: 'productos' as const,
      label: 'Cadmio y Plaguicidas',
      icon: Package,
    },
    showRegistro && {
      id: 'registro-prensa' as const,
      label: 'Registro de prensa',
      icon: ClipboardList,
    },
    showAfq && {
      id: 'afq' as const,
      label: 'AFQ · Físico-químico',
      icon: Beaker,
    },
    showCronograma && {
      id: 'cronograma' as const,
      label: 'Cronograma',
      icon: CalendarDays,
    },
  ].filter(Boolean) as {
    id: AppPage;
    label: string;
    icon: typeof Home;
  }[];

  const goToFirstLab = () => {
    if (labItems.length > 0) onNavigate(labItems[0].id);
  };

  return (
    <aside
      className={`flex-shrink-0 flex flex-col h-full relative overflow-hidden transition-all duration-250 ease-out ${
        collapsed ? 'w-[72px]' : 'w-[248px]'
      }`}
      style={{
        background: 'var(--ely-bg-elevated)',
        borderRight: '1px solid var(--ely-border)',
      }}
    >
      {/* ── Brand ── */}
      <div
        className={`pt-5 pb-3 flex items-center ${
          collapsed ? 'flex-col gap-3 px-2' : 'gap-3 px-4'
        }`}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'var(--ely-accent-soft)' }}
        >
          <svg viewBox="0 0 40 40" className="w-5 h-5" aria-hidden>
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
            <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--ely-text-muted)' }}>
              {user?.roleLabel || 'Asistente inteligente'}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="no-drag shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
          style={{ color: 'var(--ely-text-muted)' }}
          title={collapsed ? 'Expandir menú' : 'Retraer menú'}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className={`flex-1 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'} pb-2`}>
        {/* Sección: Principal */}
        {!collapsed && (
          <p
            className="px-3.5 pt-2 pb-1.5 text-[10px] font-medium tracking-[0.12em] uppercase"
            style={{ color: 'var(--ely-text-dim)' }}
          >
            Principal
          </p>
        )}

        <div className="space-y-1">
          {topItems.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                title={collapsed ? item.label : undefined}
                className={navClass(isActive, collapsed)}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </div>

        {/* Sección: Laboratorio (lista plana, sin sub-grupo "Datos") */}
        {showLab && (
          <div className={collapsed ? 'mt-2' : 'mt-3'}>
            {!collapsed && (
              <p
                className="px-3.5 pt-1 pb-1.5 text-[10px] font-medium tracking-[0.12em] uppercase"
                style={{ color: 'var(--ely-text-dim)' }}
              >
                Laboratorio
              </p>
            )}

            {collapsed ? (
              <button
                type="button"
                onClick={goToFirstLab}
                title="Laboratorio"
                className={navClass(labActive, true)}
              >
                <FlaskConical className="w-4 h-4 shrink-0" />
              </button>
            ) : (
              <div className="space-y-1">
                {labItems.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setLabOpen((v) => !v)}
                    className={navClass(false, false)}
                    style={labActive ? { color: 'var(--ely-accent)' } : undefined}
                  >
                    <FlaskConical className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left truncate">Secciones</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                        labOpen ? 'rotate-180' : ''
                      }`}
                      style={{ color: 'var(--ely-text-dim)' }}
                    />
                  </button>
                ) : null}

                {(labOpen || labItems.length === 1) && (
                  <div className={labItems.length > 1 ? 'ml-1 pl-2 space-y-0.5' : 'space-y-0.5'}>
                    {labItems.map((item) => {
                      const isActive = active === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onNavigate(item.id)}
                          className={navClass(isActive, false, true)}
                          title={item.label}
                        >
                          <item.icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Sección: Sistema */}
        {allow('config') && (
          <div className={collapsed ? 'mt-2' : 'mt-3'}>
            {!collapsed && (
              <p
                className="px-3.5 pt-1 pb-1.5 text-[10px] font-medium tracking-[0.12em] uppercase"
                style={{ color: 'var(--ely-text-dim)' }}
              >
                Sistema
              </p>
            )}
            <button
              type="button"
              onClick={() => onNavigate('config')}
              title={collapsed ? 'Configuración' : undefined}
              className={navClass(active === 'config', collapsed)}
            >
              <Settings className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Configuración</span>}
            </button>
          </div>
        )}
      </nav>

      {/* ── User footer ── */}
      <div
        className={`${collapsed ? 'px-2 py-4' : 'px-4 pb-5 pt-3 space-y-2.5'}`}
        style={{ borderTop: '1px solid var(--ely-border)' }}
      >
        {!collapsed ? (
          <>
            <div className="flex items-center gap-3 px-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0"
                style={{ background: 'var(--ely-accent-soft)', color: 'var(--ely-accent)' }}
              >
                {(operator || 'O').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--ely-text)' }}>
                  {operator || 'Operador'}
                </p>
                <p className="text-[11px] truncate" style={{ color: 'var(--ely-text-muted)' }}>
                  {user?.roleLabel || (hasApiKey ? 'IA conectada' : 'Sin API key')}
                </p>
              </div>
            </div>
            {onLogout && (
              <button
                type="button"
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
                type="button"
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
