import { LayoutDashboard, Database, ClipboardList } from 'lucide-react';

interface RegistroPrensaPanelProps {
  onSelectView: (view: 'dashboard' | 'datos') => void;
}

export function RegistroPrensaPanel({ onSelectView }: RegistroPrensaPanelProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 px-6 py-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-6">
        <ClipboardList className="w-4 h-4" style={{ color: 'var(--ely-accent)' }} />
        <h2 className="text-lg font-medium tracking-wide" style={{ color: 'var(--ely-text)' }}>
          Registro de prensa
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
        <button
          type="button"
          onClick={() => onSelectView('dashboard')}
          className="ely-product-card group"
          style={{ aspectRatio: 'auto', minHeight: 140 }}
        >
          <div className="ely-product-icon">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <span className="text-sm tracking-wide" style={{ color: 'var(--ely-text-muted)' }}>
            Dashboard
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectView('datos')}
          className="ely-product-card group"
          style={{ aspectRatio: 'auto', minHeight: 140 }}
        >
          <div className="ely-product-icon">
            <Database className="w-5 h-5" />
          </div>
          <span className="text-sm tracking-wide" style={{ color: 'var(--ely-text-muted)' }}>
            Datos
          </span>
        </button>
      </div>
    </div>
  );
}
