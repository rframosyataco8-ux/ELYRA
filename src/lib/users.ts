/** Usuarios y roles del laboratorio ELYRA */

export type AppPage =
  | 'inicio'
  | 'asistente'
  | 'config'
  | 'productos'
  | 'registro-prensa'
  | 'afq'
  | 'cronograma';

export type UserId = 'fabricio' | 'nereyda' | 'solange' | 'zorka';

export type RoleId = 'admin' | 'lab_plaguicidas' | 'lab_datos' | 'pendiente';

export interface LabUser {
  id: UserId;
  name: string;
  displayName: string;
  role: RoleId;
  roleLabel: string;
  /** Páginas de laboratorio visibles (además de inicio, asistente, config) */
  pages: AppPage[];
  isAdmin: boolean;
}

const DEFAULT_PIN = '123456';

export const LAB_USERS: LabUser[] = [
  {
    id: 'fabricio',
    name: 'Fabricio',
    displayName: 'Fabricio',
    role: 'admin',
    roleLabel: 'Administrador',
    pages: ['productos', 'registro-prensa', 'afq', 'cronograma'],
    isAdmin: true,
  },
  {
    id: 'nereyda',
    name: 'Ing. Nereyda',
    displayName: 'Ing. Nereyda',
    role: 'lab_plaguicidas',
    roleLabel: 'Laboratorio · Plaguicidas',
    pages: ['productos', 'cronograma'],
    isAdmin: false,
  },
  {
    id: 'solange',
    name: 'Solange',
    displayName: 'Solange',
    role: 'lab_datos',
    roleLabel: 'Laboratorio · Datos',
    pages: ['registro-prensa', 'afq'],
    isAdmin: false,
  },
  {
    id: 'zorka',
    name: 'Zorka',
    displayName: 'Zorka',
    role: 'pendiente',
    roleLabel: 'Pendiente de asignación',
    pages: [],
    isAdmin: false,
  },
];

/** Páginas siempre visibles para todos */
export const COMMON_PAGES: AppPage[] = ['inicio', 'asistente', 'config'];

export function pagesForUser(user: LabUser): AppPage[] {
  if (user.isAdmin) {
    return [...COMMON_PAGES, 'productos', 'registro-prensa', 'afq', 'cronograma'];
  }
  return [...COMMON_PAGES, ...user.pages];
}

export function canAccessPage(user: LabUser | null, page: AppPage): boolean {
  if (!user) return false;
  return pagesForUser(user).includes(page);
}

export function getUserById(id: string): LabUser | undefined {
  return LAB_USERS.find((u) => u.id === id);
}

function simpleHash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return 'h' + Math.abs(h).toString(16) + s.length.toString(16);
}

export const DEFAULT_PIN_HASH = simpleHash(DEFAULT_PIN);

const PASSWORDS_KEY = 'elyra_user_passwords_v1';

type PasswordStore = Record<
  string,
  { pinHash: string; mustChange: boolean; updatedAt: string }
>;

function loadPasswords(): PasswordStore {
  try {
    const raw = localStorage.getItem(PASSWORDS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PasswordStore;
  } catch {
    return {};
  }
}

function savePasswords(store: PasswordStore) {
  localStorage.setItem(PASSWORDS_KEY, JSON.stringify(store));
}

/** Asegura entradas por defecto (123456 + debe cambiar) */
export function ensureDefaultPasswords() {
  const store = loadPasswords();
  let changed = false;
  for (const u of LAB_USERS) {
    if (!store[u.id]) {
      store[u.id] = {
        pinHash: DEFAULT_PIN_HASH,
        mustChange: true,
        updatedAt: new Date().toISOString(),
      };
      changed = true;
    }
  }
  if (changed) savePasswords(store);
  return store;
}

export function verifyPassword(userId: UserId, pin: string): boolean {
  const store = ensureDefaultPasswords();
  const entry = store[userId];
  if (!entry) return pin === DEFAULT_PIN;
  return entry.pinHash === simpleHash(pin);
}

export function mustChangePassword(userId: UserId): boolean {
  const store = ensureDefaultPasswords();
  return !!store[userId]?.mustChange;
}

export function setPassword(userId: UserId, newPin: string, clearMustChange = true) {
  const store = ensureDefaultPasswords();
  store[userId] = {
    pinHash: simpleHash(newPin),
    mustChange: clearMustChange ? false : true,
    updatedAt: new Date().toISOString(),
  };
  savePasswords(store);
}

export function deferPasswordChange(userId: UserId) {
  const store = ensureDefaultPasswords();
  if (!store[userId]) {
    store[userId] = {
      pinHash: DEFAULT_PIN_HASH,
      mustChange: true,
      updatedAt: new Date().toISOString(),
    };
  } else {
    store[userId].mustChange = true;
  }
  savePasswords(store);
}

const SESSION_KEY = 'elyra_session_v2';

export type SessionData = {
  ok: boolean;
  userId: UserId;
  operator: string;
  at: number;
};

export function openSession(user: LabUser) {
  const data: SessionData = {
    ok: true,
    userId: user.id,
    operator: user.displayName,
    at: Date.now(),
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function getSession(): SessionData | null {
  try {
    const s = sessionStorage.getItem(SESSION_KEY);
    if (!s) return null;
    const parsed = JSON.parse(s) as SessionData;
    if (!parsed?.ok || Date.now() - (parsed.at || 0) > 12 * 60 * 60 * 1000) return null;
    if (!getUserById(parsed.userId)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export { simpleHash, DEFAULT_PIN };
