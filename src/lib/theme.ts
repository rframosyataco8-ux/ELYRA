export type ThemeId = 'dark' | 'light' | 'system' | 'transparent';

export const THEME_OPTIONS: { id: ThemeId; label: string; hint: string }[] = [
  { id: 'dark', label: 'Oscuro', hint: 'Carbón profundo · azul suave · baja fatiga' },
  { id: 'light', label: 'Claro', hint: 'Google Material · limpio y luminoso' },
  { id: 'system', label: 'Sistema', hint: 'Sigue el tema de Windows automáticamente' },
  { id: 'transparent', label: 'Cristal', hint: 'Vidrio esmerilado · blur premium' },
];

const STORAGE_KEY = 'elyra-theme';

export function getStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (v && THEME_OPTIONS.some((o) => o.id === v)) return v;
  } catch { /* ignore */ }
  return 'dark';
}

export function resolveTheme(id: ThemeId): 'dark' | 'light' | 'transparent' {
  if (id === 'transparent') return 'transparent';
  if (id === 'light') return 'light';
  if (id === 'dark') return 'dark';
  try {
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
  } catch { /* ignore */ }
  return 'dark';
}

function syncElectronGlass(resolved: 'dark' | 'light' | 'transparent') {
  try {
    const glass = resolved === 'transparent';
    window.elyra?.setGlassMode?.(glass);
  } catch { /* ignore */ }
}

export function applyTheme(id: ThemeId) {
  const resolved = resolveTheme(id);
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.classList.toggle('theme-crystal', resolved === 'transparent');
  document.documentElement.style.colorScheme = resolved === 'light' ? 'light' : 'dark';
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch { /* ignore */ }
  syncElectronGlass(resolved);
}

export function initTheme(): ThemeId {
  const id = getStoredTheme();
  applyTheme(id);
  return id;
}
