import { CreditCard, Lock } from 'lucide-react';

interface LoginMethodsProps {
  onPin: () => void;
  onNfc?: () => void;
}

export function LoginMethods({ onPin, onNfc }: LoginMethodsProps) {
  return (
    <div className="pt-1">
      <p className="text-[10px] tracking-[0.16em] uppercase text-center text-sky-100/32 mb-2">
        Otras opciones
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onPin}
          className="rounded-xl px-3 py-3 text-left transition-[background-color,border-color] duration-200"
          style={{
            background: 'rgba(255,255,255,0.028)',
            border: '1px solid rgba(56,180,255,0.14)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(56,180,255,0.32)';
            e.currentTarget.style.background = 'rgba(56,180,255,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(56,180,255,0.14)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.028)';
          }}
        >
          <Lock className="w-3.5 h-3.5 text-sky-400 mb-1.5" strokeWidth={1.75} />
          <p className="text-[12px] font-medium text-white leading-tight">Acceso con PIN</p>
          <p className="text-[10px] text-sky-100/38 mt-0.5">Ingresar código</p>
        </button>

        <button
          type="button"
          onClick={onNfc}
          disabled={!onNfc}
          className="rounded-xl px-3 py-3 text-left"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            opacity: onNfc ? 1 : 0.42,
            cursor: onNfc ? 'pointer' : 'not-allowed',
          }}
          title={onNfc ? 'Tarjeta NFC' : 'Próximamente'}
        >
          <CreditCard className="w-3.5 h-3.5 text-sky-400/65 mb-1.5" strokeWidth={1.75} />
          <p className="text-[12px] font-medium text-white/85 leading-tight">Tarjeta de acceso</p>
          <p className="text-[10px] text-sky-100/28 mt-0.5">Lector NFC</p>
        </button>
      </div>
    </div>
  );
}
