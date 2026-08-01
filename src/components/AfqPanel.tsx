import { Beaker, Package } from 'lucide-react';

export const AFQ_PRODUCTS = [
  'Torta alcalina',
  'Cocoa',
  '% Grasa licor línea para NIRS',
  'Análisis % grasa PT 2026',
  'Licor',
  'Manteca',
  'Torta trozada',
] as const;

export type AfqView = 'dashboard' | 'datos' | 'analisis';

interface AfqPanelProps {
  onSelectProduct?: (name: string, view?: AfqView) => void;
}

export function AfqPanel({ onSelectProduct }: AfqPanelProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 animate-fade-in overflow-y-auto">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-3xl">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Beaker className="w-5 h-5" style={{ color: 'var(--ely-accent)' }} />
            <h2 className="text-xl font-medium tracking-wide" style={{ color: 'var(--ely-text)' }}>
              AFQ
            </h2>
          </div>
          <p className="text-center text-[12px] tracking-wide mb-8" style={{ color: 'var(--ely-text-muted)' }}>
            Análisis físico químico
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            {AFQ_PRODUCTS.map((name) => (
              <button key={name} type="button" onClick={() => onSelectProduct?.(name)} className="ely-product-card group">
                <div className="ely-product-icon">
                  <Package className="w-5 h-5" />
                </div>
                <span
                  className="text-[12.5px] text-center leading-snug tracking-wide px-1"
                  style={{ color: 'var(--ely-text-muted)' }}
                >
                  {name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
