import { useState } from 'react';
import { ScanFace, Trash2, Shield, Check } from 'lucide-react';
import { getFaceMeta, hasFaceRegistered, removeFace } from '@/lib/faceAuth';

interface Props {
  userId: string;
  userName: string;
}

export function BiometricSettings({ userId, userName }: Props) {
  const [tick, setTick] = useState(0);
  const meta = getFaceMeta(userId);
  void tick;
  const registered = hasFaceRegistered(userId);
  const [confirm, setConfirm] = useState(false);
  const [ok, setOk] = useState('');

  const reset = () => {
    removeFace(userId);
    setConfirm(false);
    setOk('Biometría facial eliminada. En el próximo acceso podrá registrarla de nuevo.');
    setTick((t) => t + 1);
    window.setTimeout(() => setOk(''), 3200);
  };

  return (
    <div className="hud-glass p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ScanFace className="w-4 h-4" style={{ color: 'var(--ely-accent)' }} />
        <h3 className="text-sm font-medium" style={{ color: 'var(--ely-text)' }}>
          Biometría facial
        </h3>
      </div>

      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ely-text-muted)' }}>
        El rostro de <strong style={{ color: 'var(--ely-text)' }}>{userName}</strong> se guarda solo en este
        equipo. El escaneo usa varios fotogramas y una malla facial en vivo.
      </p>

      <div
        className="rounded-xl px-3.5 py-3 flex items-center justify-between gap-3"
        style={{
          background: 'var(--ely-bg-soft)',
          border: '1px solid var(--ely-border)',
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Shield className="w-4 h-4 shrink-0" style={{ color: registered ? 'var(--ely-success)' : 'var(--ely-text-dim)' }} />
          <div className="min-w-0">
            <p className="text-[13px] font-medium" style={{ color: 'var(--ely-text)' }}>
              {registered ? 'Rostro registrado' : 'Sin biometría'}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--ely-text-muted)' }}>
              {registered && meta.registeredAt
                ? `Desde ${new Date(meta.registeredAt).toLocaleString()} · ${meta.samples || '—'} muestras`
                : 'Podrá registrar el rostro en el próximo inicio de sesión'}
            </p>
          </div>
        </div>
        {registered && (
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
            style={{ background: 'var(--ely-accent-soft)', color: 'var(--ely-accent)' }}
          >
            Activo
          </span>
        )}
      </div>

      {ok && (
        <div
          className="text-[12px] rounded-xl px-3 py-2 flex items-center gap-2"
          style={{
            background: 'rgba(63, 185, 80, 0.12)',
            color: 'var(--ely-success)',
            border: '1px solid rgba(63, 185, 80, 0.25)',
          }}
        >
          <Check className="w-3.5 h-3.5" /> {ok}
        </div>
      )}

      {registered && !confirm && (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="ely-btn-secondary text-[12px] !py-2"
        >
          <Trash2 className="w-3.5 h-3.5" /> Restablecer biometría facial
        </button>
      )}

      {confirm && (
        <div
          className="rounded-xl p-3 space-y-2"
          style={{
            background: 'rgba(248,81,73,0.08)',
            border: '1px solid rgba(248,81,73,0.2)',
          }}
        >
          <p className="text-[12px]" style={{ color: 'var(--ely-danger)' }}>
            ¿Eliminar el rostro registrado? Deberá volver a escanearlo al iniciar sesión.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="text-[12px] px-3 py-1.5 rounded-full font-medium"
              style={{ background: 'rgba(248,81,73,0.15)', color: 'var(--ely-danger)' }}
            >
              Sí, eliminar
            </button>
            <button
              type="button"
              onClick={() => setConfirm(false)}
              className="text-[12px] px-3 py-1.5"
              style={{ color: 'var(--ely-text-muted)' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
