import { Moon, Sun } from 'lucide-react';
import type { ThemeId } from '@/lib/theme';

interface ThemeToggleProps {
  theme: ThemeId;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isLight = theme === 'light';
  return (
    <button
      type="button"
      onClick={onToggle}
      className="no-drag flex items-center gap-0.5 rounded-full p-1"
      style={{
        background: 'rgba(8, 20, 45, 0.75)',
        border: '1px solid rgba(56,180,255,0.25)',
      }}
      title={isLight ? 'Tema oscuro' : 'Tema claro'}
      aria-label="Cambiar tema"
    >
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
        style={{
          background: !isLight ? 'rgba(56,180,255,0.25)' : 'transparent',
          color: !isLight ? '#7dd3fc' : 'rgba(148,180,210,0.5)',
        }}
      >
        <Sun className="w-3.5 h-3.5" />
      </span>
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
        style={{
          background: isLight ? 'rgba(56,180,255,0.25)' : 'transparent',
          color: isLight ? '#7dd3fc' : 'rgba(148,180,210,0.5)',
        }}
      >
        <Moon className="w-3.5 h-3.5" />
      </span>
    </button>
  );
}
