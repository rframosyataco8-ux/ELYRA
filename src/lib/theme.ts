export type ThemeId = 'dark' | 'light' | 'system' | 'transparent';

export const THEME_OPTIONS: { id: ThemeId; label: string; hint: string }[] = [
  { id: 'dark', label: 'Oscuro', hint: 'Azul profundo, cómodo de noche' },
  { id: 'light', label: 'Claro', hint: 'Grises suaves, no cansa la vista' },
  { id: 'system', label: 'Sistema', hint: 'Sigue Windows claro/oscuro' },
  { id: 'transparent', label: 'Transparente', hint: 'Cristal con desenfoque' },
];

const STORAGE_KEY = 'elyra-theme';

export function getStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (v && THEME_OPTIONS.some((o) => o.id === v)) return v;
  } catch {}
  return 'dark';
}

export function resolveTheme(id: ThemeId): 'dark' | 'light' | 'transparent' {
  if (id === 'transparent') return 'transparent';
  if (id === 'light') return 'light';
  if (id === 'dark') return 'dark';
  // system
  try {
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
  } catch {}
  return 'dark';
}

export function applyTheme(id: ThemeId) {
  const resolved = resolveTheme(id);
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.colorScheme = resolved === 'light' ? 'light' : 'dark';
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {}
}

export function initTheme(): ThemeId {
  const id = getStoredTheme();
  applyTheme(id);
  return id;
}
