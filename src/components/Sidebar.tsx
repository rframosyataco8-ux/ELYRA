import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import {
  collapseVariants,
  elyTransition,
  iconButtonMotion,
  staggerContainer,
  staggerItem,
} from '@/lib/motion';

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

function NavItem({
  active,
  collapsed,
  nested,
  onClick,
  title,
  icon: Icon,
  label,
}: {
  active: boolean;
  collapsed: boolean;
  nested?: boolean;
  onClick: () => void;
  title?: string;
  icon: typeof Home;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      title={collapsed ? label : title}
      variants={staggerItem}
      whileHover={{ x: collapsed ? 0 : 2 }}
      whileTap={{ scale: 0.98 }}
      transition={elyTransition.fast}
      className={`ely-nav-item group ${
        active ? 'active' : ''
      } ${collapsed ? 'justify-center px-0 py-2.5' : nested ? 'gap-2.5 px-3 py-2 text-[13px]' : 'gap-3 px-3.5 py-2.5'}`}
    >
      <span className="ely-nav-indicator" aria-hidden />
      <span className={`ely-nav-icon ${active ? 'is-active' : ''}`}>
        <Icon className={nested ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      </span>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            key="label"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={elyTransition.fast}
            className="truncate flex-1 text-left overflow-hidden"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
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

  const [labOpen, setLabOpen] = useState(labActive);

  useEffect(() => {
    if (labActive) setLabOpen(true);
  }, [labActive]);

  const topItems = [
    { id: 'inicio' as const, label: 'Inicio', icon: Home },
    { id: 'asistente' as const, label: 'Conversación', icon: MessageSquare },
  ].filter((item) => allow(item.id));

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
    <motion.aside
      className={`ely-sidebar flex-shrink-0 flex flex-col h-full relative overflow-hidden ${
        collapsed ? 'is-collapsed' : ''
      }`}
      initial={false}
      animate={{ width: collapsed ? 72 : 256 }}
      transition={elyTransition.emphasized}
      style={{
        background: 'var(--ely-bg-elevated)',
        borderRight: '1px solid var(--ely-border)',
      }}
    >
      {/* Brand */}
      <div
        className={`pt-5 pb-2 flex items-center ${
          collapsed ? 'flex-col gap-3 px-2' : 'gap-3 px-4'
        }`}
      >
        <motion.div
          className="ely-brand-mark shrink-0"
          aria-hidden
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          transition={elyTransition.spring}
        >
          <svg viewBox="0 0 40 40" className="w-5 h-5">
            <circle cx="20" cy="20" r="7" fill="none" stroke="var(--ely-accent)" strokeWidth="2" />
            <circle cx="20" cy="20" r="2.5" fill="var(--ely-accent)" />
          </svg>
        </motion.div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="brand-text"
              className="min-w-0 flex-1"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={elyTransition.fast}
            >
              <h1
                className="font-medium text-[15px] tracking-tight leading-tight"
                style={{ color: 'var(--ely-text)' }}
              >
                ELYRA
              </h1>
              <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--ely-text-muted)' }}>
                {user?.roleLabel || 'Asistente inteligente'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          type="button"
          onClick={onToggleCollapse}
          className="ely-icon-btn no-drag shrink-0"
          style={{ color: 'var(--ely-text-muted)' }}
          title={collapsed ? 'Expandir menú' : 'Retraer menú'}
          {...iconButtonMotion}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </motion.button>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto overflow-x-hidden ${collapsed ? 'px-2' : 'px-3'} pb-3 pt-1`}>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.p
              key="sec-principal"
              className="ely-nav-section-label"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Principal
            </motion.p>
          )}
        </AnimatePresence>

        <motion.div
          className="space-y-0.5"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {topItems.map((item) => (
            <NavItem
              key={item.id}
              active={active === item.id}
              collapsed={collapsed}
              onClick={() => onNavigate(item.id)}
              icon={item.icon}
              label={item.label}
            />
          ))}
        </motion.div>

        {showLab && (
          <div className={collapsed ? 'mt-3' : 'mt-4'}>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.p
                  key="sec-lab"
                  className="ely-nav-section-label"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  Laboratorio
                </motion.p>
              )}
            </AnimatePresence>

            {collapsed ? (
              <NavItem
                active={labActive}
                collapsed
                onClick={goToFirstLab}
                icon={FlaskConical}
                label="Laboratorio"
              />
            ) : (
              <div className="space-y-0.5">
                {labItems.length > 1 && (
                  <motion.button
                    type="button"
                    onClick={() => setLabOpen((v) => !v)}
                    className={`ely-nav-item gap-3 px-3.5 py-2.5 ${labActive ? 'has-active-child' : ''}`}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="ely-nav-icon">
                      <FlaskConical className="w-4 h-4" />
                    </span>
                    <span className="flex-1 text-left truncate">Secciones</span>
                    <motion.span
                      animate={{ rotate: labOpen ? 180 : 0 }}
                      transition={elyTransition.standard}
                      className="inline-flex"
                    >
                      <ChevronDown
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: 'var(--ely-text-dim)' }}
                      />
                    </motion.span>
                  </motion.button>
                )}

                <motion.div
                  className="ely-nav-collapse-fm overflow-hidden"
                  initial={false}
                  animate={labOpen || labItems.length === 1 ? 'open' : 'closed'}
                  variants={collapseVariants}
                >
                  <div
                    className={
                      labItems.length > 1
                        ? 'ml-1 pl-2 border-l border-[var(--ely-border)] space-y-0.5'
                        : 'space-y-0.5'
                    }
                  >
                    {labItems.map((item) => (
                      <NavItem
                        key={item.id}
                        active={active === item.id}
                        collapsed={false}
                        nested
                        onClick={() => onNavigate(item.id)}
                        icon={item.icon}
                        label={item.label}
                      />
                    ))}
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        )}

        {allow('config') && (
          <div className={collapsed ? 'mt-3' : 'mt-4'}>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.p
                  key="sec-sys"
                  className="ely-nav-section-label"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  Sistema
                </motion.p>
              )}
            </AnimatePresence>
            <NavItem
              active={active === 'config'}
              collapsed={collapsed}
              onClick={() => onNavigate('config')}
              icon={Settings}
              label="Configuración"
            />
          </div>
        )}
      </nav>

      {/* User footer */}
      <div
        className={`${collapsed ? 'px-2 py-4' : 'px-4 pb-5 pt-3 space-y-2'}`}
        style={{ borderTop: '1px solid var(--ely-border)' }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {!collapsed ? (
            <motion.div
              key="user-expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={elyTransition.fast}
              className="space-y-2"
            >
              <div className="flex items-center gap-3 px-1.5 py-1 rounded-2xl">
                <div className="ely-avatar shrink-0">
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
                <motion.button
                  type="button"
                  onClick={onLogout}
                  className="ely-logout-btn"
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Cerrar sesión
                </motion.button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="user-collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2.5"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: hasApiKey ? 'var(--ely-success)' : 'var(--ely-warning)' }}
                title={hasApiKey ? 'IA conectada' : 'Sin API key'}
              />
              {onLogout && (
                <motion.button
                  type="button"
                  onClick={onLogout}
                  className="ely-icon-btn"
                  style={{ color: 'var(--ely-text-dim)' }}
                  title="Cerrar sesión"
                  {...iconButtonMotion}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
