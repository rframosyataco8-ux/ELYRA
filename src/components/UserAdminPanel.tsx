import { useMemo, useState } from 'react';
import {
  Users,
  UserPlus,
  Pencil,
  Trash2,
  KeyRound,
  ScanFace,
  Shield,
  Check,
  X,
  RefreshCw,
  UserX,
  UserCheck,
} from 'lucide-react';
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  getPasswordMeta,
  ROLE_PRESETS,
  LAB_PAGE_OPTIONS,
  DEFAULT_PIN,
  type LabUser,
  type RoleId,
  type AppPage,
} from '@/lib/users';
import { hasFaceRegistered, removeFace } from '@/lib/faceAuth';

interface Props {
  currentUserId: string;
}

type FormState = {
  displayName: string;
  role: RoleId;
  roleLabel: string;
  pages: AppPage[];
  isAdmin: boolean;
  active: boolean;
};

const emptyForm = (): FormState => ({
  displayName: '',
  role: 'custom',
  roleLabel: '',
  pages: [],
  isAdmin: false,
  active: true,
});

export function UserAdminPanel({ currentUserId }: Props) {
  const [tick, setTick] = useState(0);
  const users = useMemo(() => listUsers(), [tick]);
  const refresh = () => setTick((t) => t + 1);

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const flash = (msg: string) => {
    setOkMsg(msg);
    setTimeout(() => setOkMsg(''), 2800);
  };

  const openCreate = () => {
    setForm(emptyForm());
    setError('');
    setMode('create');
    setEditingId(null);
  };

  const openEdit = (u: LabUser) => {
    setForm({
      displayName: u.displayName,
      role: u.role,
      roleLabel: u.roleLabel,
      pages: [...u.pages],
      isAdmin: u.isAdmin,
      active: u.active !== false,
    });
    setEditingId(u.id);
    setError('');
    setMode('edit');
  };

  const applyPreset = (role: RoleId) => {
    const preset = ROLE_PRESETS.find((r) => r.id === role);
    setForm((f) => ({
      ...f,
      role,
      roleLabel: role === 'custom' ? f.roleLabel || '' : preset?.label || f.roleLabel,
      pages: preset && role !== 'custom' ? [...preset.pages] : f.pages,
      isAdmin: role === 'admin' ? true : role === 'custom' ? f.isAdmin : (preset?.isAdmin ?? false),
    }));
  };

  const togglePage = (page: AppPage) => {
    setForm((f) => ({
      ...f,
      role: 'custom',
      pages: f.pages.includes(page) ? f.pages.filter((p) => p !== page) : [...f.pages, page],
    }));
  };

  const resolvedLabel = () => {
    if (form.isAdmin) return 'Administrador';
    if (form.role === 'custom') {
      const custom = form.roleLabel.trim();
      if (custom) return custom;
      if (form.pages.length === 0) return 'Personalizado';
      return form.pages
        .map((p) => LAB_PAGE_OPTIONS.find((o) => o.id === p)?.label || p)
        .join(' · ');
    }
    return ROLE_PRESETS.find((r) => r.id === form.role)?.label || form.roleLabel || 'Usuario';
  };

  const save = () => {
    setError('');
    try {
      const roleLabel = resolvedLabel();
      if (mode === 'create') {
        createUser({
          displayName: form.displayName,
          role: form.isAdmin ? 'admin' : form.role,
          pages: form.isAdmin ? undefined : form.pages,
          isAdmin: form.isAdmin,
          active: form.active,
          roleLabel,
        });
        flash('Usuario creado · contraseña temporal 123456');
      } else if (mode === 'edit' && editingId) {
        updateUser(editingId, {
          displayName: form.displayName,
          role: form.isAdmin ? 'admin' : form.role,
          pages: form.pages,
          isAdmin: form.isAdmin,
          active: form.active,
          roleLabel,
        });
        flash('Usuario actualizado');
      }
      setMode('list');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    }
  };

  const doDelete = (id: string) => {
    setError('');
    try {
      deleteUser(id, currentUserId);
      setConfirmDelete(null);
      flash('Usuario eliminado');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar');
      setConfirmDelete(null);
    }
  };

  const doReset = (id: string) => {
    resetPassword(id);
    flash(`Contraseña restablecida a ${DEFAULT_PIN}`);
    refresh();
  };

  const doResetFace = (id: string) => {
    removeFace(id);
    flash('Biometría facial eliminada');
    refresh();
  };

  const toggleActive = (u: LabUser) => {
    setError('');
    try {
      updateUser(u.id, { active: !u.active });
      flash(u.active ? 'Usuario desactivado' : 'Usuario activado');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  return (
    <div className="hud-glass-strong p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" style={{ color: 'var(--ely-accent)' }} />
          <h3 className="text-sm font-medium" style={{ color: 'var(--ely-text)' }}>
            Control de usuarios
          </h3>
        </div>
        {mode === 'list' ? (
          <button type="button" onClick={openCreate} className="ely-btn-primary text-[12px] !py-2 !px-3">
            <UserPlus className="w-3.5 h-3.5" /> Nuevo usuario
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setMode('list'); setError(''); }}
            className="text-[12px] flex items-center gap-1"
            style={{ color: 'var(--ely-text-muted)' }}
          >
            <X className="w-3.5 h-3.5" /> Cancelar
          </button>
        )}
      </div>

      <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ely-text-muted)' }}>
        Roles predefinidos o <strong style={{ color: 'var(--ely-text)' }}>personalizados</strong> con
        módulos a medida. Contraseña temporal:{' '}
        <strong style={{ color: 'var(--ely-text)' }}>{DEFAULT_PIN}</strong>.
      </p>

      {okMsg && (
        <div
          className="text-[12px] rounded-xl px-3 py-2 flex items-center gap-2"
          style={{
            background: 'rgba(63, 185, 80, 0.12)',
            color: 'var(--ely-success)',
            border: '1px solid rgba(63, 185, 80, 0.25)',
          }}
        >
          <Check className="w-3.5 h-3.5" /> {okMsg}
        </div>
      )}
      {error && (
        <div
          className="text-[12px] rounded-xl px-3 py-2"
          style={{
            background: 'rgba(248, 81, 73, 0.1)',
            color: 'var(--ely-danger)',
            border: '1px solid rgba(248, 81, 73, 0.25)',
          }}
        >
          {error}
        </div>
      )}

      {(mode === 'create' || mode === 'edit') && (
        <div
          className="space-y-3 rounded-xl p-4"
          style={{ background: 'var(--ely-bg-soft)', border: '1px solid var(--ely-border)' }}
        >
          <p className="text-[13px] font-medium" style={{ color: 'var(--ely-text)' }}>
            {mode === 'create' ? 'Nuevo usuario' : 'Editar usuario'}
          </p>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium" style={{ color: 'var(--ely-text-muted)' }}>
              Nombre completo
            </label>
            <input
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{
                background: 'var(--ely-input-bg)',
                border: '1px solid var(--ely-border)',
                color: 'var(--ely-text)',
              }}
              placeholder="Ej. Ing. María López"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium" style={{ color: 'var(--ely-text-muted)' }}>
              Tipo de rol
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ROLE_PRESETS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => applyPreset(r.id)}
                  className="text-[11px] px-2.5 py-1.5 rounded-full border"
                  style={{
                    background: form.role === r.id ? 'var(--ely-accent-soft)' : 'transparent',
                    borderColor: form.role === r.id ? 'var(--ely-accent)' : 'var(--ely-border)',
                    color: form.role === r.id ? 'var(--ely-accent)' : 'var(--ely-text-muted)',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {form.role === 'custom' && !form.isAdmin && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium" style={{ color: 'var(--ely-text-muted)' }}>
                Nombre del rol personalizado
              </label>
              <input
                value={form.roleLabel}
                onChange={(e) => setForm((f) => ({ ...f, roleLabel: e.target.value }))}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{
                  background: 'var(--ely-input-bg)',
                  border: '1px solid var(--ely-border)',
                  color: 'var(--ely-text)',
                }}
                placeholder="Ej. Supervisión calidad, Turno noche…"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium" style={{ color: 'var(--ely-text-muted)' }}>
              Módulos de laboratorio
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {LAB_PAGE_OPTIONS.map((p) => {
                const on = form.isAdmin || form.pages.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={form.isAdmin}
                    onClick={() => togglePage(p.id)}
                    className="text-left text-[12px] px-3 py-2 rounded-lg border flex items-center gap-2"
                    style={{
                      background: on ? 'var(--ely-accent-soft)' : 'transparent',
                      borderColor: on ? 'var(--ely-accent)' : 'var(--ely-border)',
                      color: on ? 'var(--ely-text)' : 'var(--ely-text-muted)',
                      opacity: form.isAdmin ? 0.7 : 1,
                    }}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0"
                      style={{
                        borderColor: on ? 'var(--ely-accent)' : 'var(--ely-border)',
                        background: on ? 'var(--ely-accent)' : 'transparent',
                      }}
                    >
                      {on && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="rounded-lg px-3 py-2 text-[12px]"
            style={{ background: 'var(--ely-accent-soft)', color: 'var(--ely-accent)' }}
          >
            Vista previa del rol: <strong>{resolvedLabel()}</strong>
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-[12px] cursor-pointer" style={{ color: 'var(--ely-text)' }}>
              <input
                type="checkbox"
                checked={form.isAdmin}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    isAdmin: e.target.checked,
                    role: e.target.checked ? 'admin' : f.role === 'admin' ? 'custom' : f.role,
                  }))
                }
              />
              <Shield className="w-3.5 h-3.5" style={{ color: 'var(--ely-accent)' }} />
              Es administrador
            </label>
            <label className="flex items-center gap-2 text-[12px] cursor-pointer" style={{ color: 'var(--ely-text)' }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Cuenta activa
            </label>
          </div>

          <button type="button" onClick={save} className="ely-btn-primary w-full !mt-2">
            {mode === 'create' ? 'Crear usuario' : 'Guardar cambios'}
          </button>
        </div>
      )}

      {mode === 'list' && (
        <div className="space-y-2">
          {users.map((u) => {
            const meta = getPasswordMeta(u.id);
            const isSelf = u.id === currentUserId;
            return (
              <div
                key={u.id}
                className="rounded-xl px-3 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                style={{
                  background: 'var(--ely-bg-soft)',
                  border: '1px solid var(--ely-border)',
                  opacity: u.active === false ? 0.55 : 1,
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                    style={{ background: 'var(--ely-accent-soft)', color: 'var(--ely-accent)' }}
                  >
                    {u.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--ely-text)' }}>
                        {u.displayName}
                      </p>
                      {u.isAdmin && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ background: 'var(--ely-accent-soft)', color: 'var(--ely-accent)' }}
                        >
                          Admin
                        </span>
                      )}
                      {isSelf && (
                        <span className="text-[10px]" style={{ color: 'var(--ely-text-dim)' }}>
                          (usted)
                        </span>
                      )}
                      {u.active === false && (
                        <span className="text-[10px]" style={{ color: 'var(--ely-warning)' }}>
                          Inactivo
                        </span>
                      )}
                      {hasFaceRegistered(u.id) && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ background: 'var(--ely-accent-soft)', color: 'var(--ely-accent)' }}
                        >
                          Rostro
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] truncate" style={{ color: 'var(--ely-text-muted)' }}>
                      {u.roleLabel}
                      {meta.mustChange || meta.isDefault ? ' · debe cambiar contraseña' : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-wrap justify-end">
                  <button type="button" title="Editar" onClick={() => openEdit(u)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ color: 'var(--ely-text-muted)' }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" title={`Restablecer a ${DEFAULT_PIN}`} onClick={() => doReset(u.id)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ color: 'var(--ely-text-muted)' }}>
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                  {hasFaceRegistered(u.id) && (
                    <button type="button" title="Restablecer biometría facial" onClick={() => doResetFace(u.id)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ color: 'var(--ely-text-muted)' }}>
                      <ScanFace className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button type="button" title={u.active === false ? 'Activar' : 'Desactivar'} onClick={() => toggleActive(u)} disabled={isSelf} className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30" style={{ color: 'var(--ely-text-muted)' }}>
                    {u.active === false ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                  </button>
                  {confirmDelete === u.id ? (
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => doDelete(u.id)} className="text-[11px] px-2 py-1 rounded-full" style={{ background: 'rgba(248,81,73,0.15)', color: 'var(--ely-danger)' }}>
                        Confirmar
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(null)} className="text-[11px] px-2 py-1" style={{ color: 'var(--ely-text-muted)' }}>
                        No
                      </button>
                    </div>
                  ) : (
                    <button type="button" title="Eliminar" onClick={() => setConfirmDelete(u.id)} disabled={isSelf} className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30" style={{ color: 'var(--ely-danger)' }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <button type="button" onClick={refresh} className="text-[11px] flex items-center gap-1.5 mx-auto pt-1" style={{ color: 'var(--ely-text-dim)' }}>
            <RefreshCw className="w-3 h-3" /> Actualizar lista
          </button>
        </div>
      )}
    </div>
  );
}
