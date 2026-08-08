import { useEffect, useState } from 'react';
import {
  applyTheme,
  getStoredTheme,
  THEME_OPTIONS,
  type ThemeId,
} from '@/lib/theme';
import { Palette, Moon, Sun, Monitor, Sparkles } from 'lucide-react';

const ICONS: Record<ThemeId, typeof Moon> = {
  dark: Moon,
  light: Sun,
  system: Monitor,
  transparent: Sparkles,
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
        Elige un tema cómodo. Oscuro y claro están pensados para no cansar la vista.
        Cristal añade un toque de transparencia suave.
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {THEME_OPTIONS.map((opt) => {
          const Icon = ICONS[opt.id];
          const active = theme === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => select(opt.id)}
              className={`theme-card ${active ? 'active' : ''}`}
            >
              <Icon
                className="w-5 h-5 mx-auto mb-2"
                style={{ color: active ? 'var(--ely-accent)' : 'var(--ely-text-muted)' }}
              />
              <div className="text-[13px] font-medium" style={{ color: 'var(--ely-text)' }}>
                {opt.label}
              </div>
              <div className="text-[11px] mt-1 leading-snug" style={{ color: 'var(--ely-text-muted)' }}>
                {opt.hint}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
