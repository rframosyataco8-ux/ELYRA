import { CreditCard, Lock } from 'lucide-react';

interface LoginMethodsProps {
  onPin: () => void;
  onNfc?: () => void;
}

export function LoginMethods({ onPin, onNfc }: LoginMethodsProps) {
  return (
    <div className="pt-1">
      <p className="text-[10px] tracking-[0.18em] uppercase text-center text-sky-100/35 mb-2.5">
        Otras opciones
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onPin}
          className="rounded-[12px] px-3.5 py-3.5 text-left transition-colors"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(56,180,255,0.18)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(56,180,255,0.45)';
            e.currentTarget.style.background = 'rgba(56,180,255,0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(56,180,255,0.18)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
          }}
        >
          <Lock className="w-4 h-4 text-sky-400 mb-1.5" />
          <p className="text-[12.5px] font-medium text-white leading-tight">Acceso con PIN</p>
          <p className="text-[10.5px] text-sky-100/40 mt-0.5">Ingresar código</p>
        </button>

        <button
          type="button"
          onClick={onNfc}
          disabled={!onNfc}
          className="rounded-[12px] px-3.5 py-3.5 text-left"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            opacity: onNfc ? 1 : 0.45,
            cursor: onNfc ? 'pointer' : 'not-allowed',
          }}
          title={onNfc ? 'Tarjeta NFC' : 'Próximamente'}
        >
          <CreditCard className="w-4 h-4 text-sky-400/70 mb-1.5" />
          <p className="text-[12.5px] font-medium text-white/90 leading-tight">Tarjeta de acceso</p>
          <p className="text-[10.5px] text-sky-100/30 mt-0.5">Lector NFC</p>
        </button>
      </div>
    </div>
  );
}
