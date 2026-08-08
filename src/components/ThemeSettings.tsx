import { useEffect, useState } from 'react';
import {
  applyTheme,
  getStoredTheme,
  THEME_OPTIONS,
  type ThemeId,
} from '@/lib/theme';
import { Palette, Moon, Sun, Monitor, Sparkles, Check } from 'lucide-react';

const ICONS: Record<ThemeId, typeof Moon> = {
  dark: Moon,
  light: Sun,
  system: Monitor,
  transparent: Sparkles,
};

const PREVIEWS: Record<ThemeId, string[]> = {
  dark: ['#0d1117', '#151b23', '#58a6ff', '#e6edf3'],
  light: ['#f6f8fc', '#ffffff', '#0b57d0', '#1f1f1f'],
  system: ['#0d1117', '#f6f8fc', '#58a6ff', '#0b57d0'],
  transparent: ['#1a2030', '#2a3548', '#8ab4f8', '#f1f3f4'],
};

export function ThemeSettings() {
  const [theme, setTheme] = useState<ThemeId>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => applyTheme('system');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [theme]);

  const select = (id: ThemeId) => {
    setTheme(id);
    applyTheme(id);
  };

  return (
    <div className="hud-glass p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Palette className="w-4 h-4" style={{ color: 'var(--ely-accent)' }} />
        <h3 className="text-sm font-medium" style={{ color: 'var(--ely-text)' }}>
          Apariencia
        </h3>
      </div>
      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ely-text-muted)' }}>
        Temas pensados para uso prolongado. Claro imita Google Workspace; oscuro es
        neutro y cómodo de noche.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {THEME_OPTIONS.map((opt) => {
          const Icon = ICONS[opt.id];
          const active = theme === opt.id;
          const colors = PREVIEWS[opt.id];
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => select(opt.id)}
              className={`theme-card ${active ? 'active' : ''}`}
            >
              <div className="theme-preview">
                {colors.map((c, i) => (
                  <span key={i} style={{ background: c }} />
                ))}
              </div>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Icon
                  className="w-4 h-4"
                  style={{ color: active ? 'var(--ely-accent)' : 'var(--ely-text-muted)' }}
                />
                <span className="text-[13px] font-medium" style={{ color: 'var(--ely-text)' }}>
                  {opt.label}
                </span>
                {active && (
                  <Check className="w-3.5 h-3.5" style={{ color: 'var(--ely-accent)' }} />
                )}
              </div>
              <div className="text-[11px] leading-snug" style={{ color: 'var(--ely-text-muted)' }}>
                {opt.hint}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
