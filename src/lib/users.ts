/** Usuarios y roles del laboratorio ELYRA — almacén local editable por admin */

export type AppPage =
  | 'inicio'
  | 'asistente'
  | 'config'
  | 'productos'
  | 'registro-prensa'
  | 'afq'
  | 'cronograma';

export type RoleId = 'admin' | 'lab_plaguicidas' | 'lab_datos' | 'pendiente' | 'custom';

export type UserId = string;

export interface LabUser {
  id: UserId;
  name: string;
  displayName: string;
  role: RoleId;
  roleLabel: string;
  /** Páginas de laboratorio (además de inicio, asistente, config) */
  pages: AppPage[];
  isAdmin: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_PIN = '123456';

export const LAB_PAGE_OPTIONS: { id: AppPage; label: string }[] = [
  { id: 'productos', label: 'Cadmio y Plaguicidas' },
  { id: 'cronograma', label: 'Cronograma' },
  { id: 'registro-prensa', label: 'Registro de prensa' },
  { id: 'afq', label: 'AFQ' },
];

export const ROLE_PRESETS: {
  id: RoleId;
  label: string;
  pages: AppPage[];
  isAdmin: boolean;
}[] = [
  {
    id: 'admin',
    label: 'Administrador',
    pages: ['productos', 'registro-prensa', 'afq', 'cronograma'],
    isAdmin: true,
  },
  {
    id: 'lab_plaguicidas',
    label: 'Laboratorio · Plaguicidas',
    pages: ['productos', 'cronograma'],
    isAdmin: false,
  },
  {
    id: 'lab_datos',
    label: 'Laboratorio · Datos',
    pages: ['registro-prensa', 'afq'],
    isAdmin: false,
  },
  {
    id: 'pendiente',
    label: 'Pendiente de asignación',
    pages: [],
    isAdmin: false,
  },
  {
    id: 'custom',
    label: 'Personalizado',
    pages: [],
    isAdmin: false,
  },
];

const SEED_USERS: Omit<LabUser, 'createdAt' | 'updatedAt' | 'active'>[] = [
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

/** @deprecated use listUsers() — mantenido por compatibilidad de imports */
export const LAB_USERS: LabUser[] = SEED_USERS.map((u) => ({
  ...u,
  active: true,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
}));

export const COMMON_PAGES: AppPage[] = ['inicio', 'asistente', 'config'];

const USERS_KEY = 'elyra_users_v2';
const PASSWORDS_KEY = 'elyra_user_passwords_v1';
const SESSION_KEY = 'elyra_session_v2';

function now() {
  return new Date().toISOString();
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || `user-${Date.now().toString(36)}`;
}

function uniqueId(base: string, existing: LabUser[]) {
  let id = base;
  let n = 2;
  while (existing.some((u) => u.id === id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

function seedList(): LabUser[] {
  const t = now();
  return SEED_USERS.map((u) => ({
    ...u,
    active: true,
    createdAt: t,
    updatedAt: t,
  }));
}

export function listUsers(): LabUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      const seeded = seedList();
      localStorage.setItem(USERS_KEY, JSON.stringify(seeded));
      ensureDefaultPasswords(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as LabUser[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = seedList();
      localStorage.setItem(USERS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return parsed.map((u) => ({
      ...u,
      active: u.active !== false,
      pages: Array.isArray(u.pages) ? u.pages : [],
    }));
  } catch {
    return seedList();
  }
}

function saveUsers(users: LabUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getUserById(id: string): LabUser | undefined {
  return listUsers().find((u) => u.id === id);
}

export function listActiveUsers(): LabUser[] {
  return listUsers().filter((u) => u.active !== false);
}

export function pagesForUser(user: LabUser): AppPage[] {
  if (user.isAdmin) {
    return [...COMMON_PAGES, 'productos', 'registro-prensa', 'afq', 'cronograma'];
  }
  return [...COMMON_PAGES, ...user.pages];
}

export function canAccessPage(user: LabUser | null, page: AppPage): boolean {
  if (!user || user.active === false) return false;
  return pagesForUser(user).includes(page);
}

function simpleHash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return 'h' + Math.abs(h).toString(16) + s.length.toString(16);
}

export const DEFAULT_PIN_HASH = simpleHash(DEFAULT_PIN);

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

export function ensureDefaultPasswords(users?: LabUser[]) {
  const store = loadPasswords();
  let changed = false;
  for (const u of users || listUsers()) {
    if (!store[u.id]) {
      store[u.id] = {
        pinHash: DEFAULT_PIN_HASH,
        mustChange: true,
        updatedAt: now(),
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
    updatedAt: now(),
  };
  savePasswords(store);
}

export function deferPasswordChange(userId: UserId) {
  const store = ensureDefaultPasswords();
  if (!store[userId]) {
    store[userId] = {
      pinHash: DEFAULT_PIN_HASH,
      mustChange: true,
      updatedAt: now(),
    };
  } else {
    store[userId].mustChange = true;
  }
  savePasswords(store);
}

/** Restablece a 123456 y obliga a cambiar en el próximo login */
export function resetPassword(userId: UserId) {
  setPassword(userId, DEFAULT_PIN, false);
  deferPasswordChange(userId);
}

export type UserInput = {
  displayName: string;
  role: RoleId;
  roleLabel?: string;
  pages?: AppPage[];
  isAdmin?: boolean;
  active?: boolean;
};

export function createUser(input: UserInput): LabUser {
  const users = listUsers();
  const preset = ROLE_PRESETS.find((r) => r.id === input.role);
  const isAdmin = input.isAdmin ?? preset?.isAdmin ?? false;
  const pages =
    input.pages ??
    (isAdmin
      ? (['productos', 'registro-prensa', 'afq', 'cronograma'] as AppPage[])
      : preset?.pages ?? []);
  const roleLabel = input.roleLabel || preset?.label || 'Usuario';
  const displayName = input.displayName.trim();
  if (!displayName) throw new Error('El nombre es obligatorio');
  if (users.some((u) => u.displayName.toLowerCase() === displayName.toLowerCase())) {
    throw new Error('Ya existe un usuario con ese nombre');
  }
  const id = uniqueId(slugify(displayName), users);
  const t = now();
  const user: LabUser = {
    id,
    name: displayName,
    displayName,
    role: input.role,
    roleLabel,
    pages,
    isAdmin,
    active: input.active !== false,
    createdAt: t,
    updatedAt: t,
  };
  users.push(user);
  saveUsers(users);
  resetPassword(user.id);
  return user;
}

export function updateUser(id: UserId, patch: Partial<UserInput>): LabUser {
  const users = listUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) throw new Error('Usuario no encontrado');
  const current = users[idx];

  if (patch.displayName) {
    const name = patch.displayName.trim();
    if (!name) throw new Error('El nombre es obligatorio');
    if (users.some((u) => u.id !== id && u.displayName.toLowerCase() === name.toLowerCase())) {
      throw new Error('Ya existe un usuario con ese nombre');
    }
    current.displayName = name;
    current.name = name;
  }

  if (patch.role) {
    current.role = patch.role;
    const preset = ROLE_PRESETS.find((r) => r.id === patch.role);
    if (preset && patch.role !== 'custom') {
      current.roleLabel = patch.roleLabel || preset.label;
      if (patch.pages === undefined) current.pages = [...preset.pages];
      if (patch.isAdmin === undefined) current.isAdmin = preset.isAdmin;
    }
  }
  if (patch.roleLabel) current.roleLabel = patch.roleLabel;
  if (patch.pages) current.pages = patch.pages;
  if (typeof patch.isAdmin === 'boolean') current.isAdmin = patch.isAdmin;
  if (typeof patch.active === 'boolean') {
    if (patch.active === false && current.isAdmin) {
      const otherAdmins = users.filter((u) => u.id !== id && u.isAdmin && u.active !== false);
      if (otherAdmins.length === 0) throw new Error('Debe quedar al menos un administrador activo');
    }
    current.active = patch.active;
  }

  current.updatedAt = now();
  users[idx] = current;
  saveUsers(users);
  return current;
}

export function deleteUser(id: UserId, currentSessionId?: UserId) {
  if (currentSessionId && id === currentSessionId) {
    throw new Error('No puede eliminarse a sí mismo');
  }
  const users = listUsers();
  const target = users.find((u) => u.id === id);
  if (!target) throw new Error('Usuario no encontrado');
  if (target.isAdmin) {
    const otherAdmins = users.filter((u) => u.id !== id && u.isAdmin && u.active !== false);
    if (otherAdmins.length === 0) throw new Error('No se puede eliminar el único administrador');
  }
  const next = users.filter((u) => u.id !== id);
  saveUsers(next);
  const store = loadPasswords();
  delete store[id];
  savePasswords(store);
}

export function getPasswordMeta(userId: UserId) {
  const store = ensureDefaultPasswords();
  const e = store[userId];
  return {
    mustChange: !!e?.mustChange,
    updatedAt: e?.updatedAt || null,
    isDefault: e?.pinHash === DEFAULT_PIN_HASH,
  };
}

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
    const user = getUserById(parsed.userId);
    if (!user || user.active === false) return null;
    return parsed;
  } catch {
    return null;
  }
}

export { simpleHash };
