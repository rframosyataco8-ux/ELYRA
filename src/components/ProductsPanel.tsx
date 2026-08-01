import { useState } from 'react';
import { Package, FileText } from 'lucide-react';

export const CADMIO_PRODUCTS = [
  'Torta Trozada estandar',
  'Torta de cacao',
  'Torta de cacao alcalino',
  'grano de cacao',
  'cacao alcalino',
  'cacao en polvo',
] as const;

export type ProductView = 'dashboard' | 'datos' | 'analisis';

interface ProductsPanelProps {
  onSelectProduct: (name: string, view?: ProductView) => void;
  onSelectReportes?: () => void;
}

export function ProductsPanel({ onSelectProduct, onSelectReportes }: ProductsPanelProps) {
  const [category, setCategory] = useState<'cadmio' | 'reportes'>('cadmio');

  return (
    <div className="flex-1 flex min-h-0 animate-fade-in">
      <div
        className="w-48 shrink-0 flex flex-col"
        style={{ borderRight: '1px solid var(--ely-border)' }}
      >
        <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--ely-header-border)' }}>
          <p className="text-[10px] tracking-[0.15em] uppercase" style={{ color: 'var(--ely-text-dim)' }}>
            Categoría
          </p>
        </div>
        <div className="flex-1 p-3 space-y-2">
          <button
            onClick={() => setCategory('cadmio')}
            className={`ely-nav-item gap-2 px-3.5 py-3 text-sm tracking-wide text-left ${
              category === 'cadmio' ? 'active' : ''
            }`}
          >
            Cadmio y Plaguicidas
          </button>
          <button
            onClick={() => {
              setCategory('reportes');
              onSelectReportes?.();
            }}
            className={`ely-nav-item gap-2 px-3.5 py-3 text-sm tracking-wide text-left ${
              category === 'reportes' ? 'active' : ''
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0 opacity-70" />
            Reportes
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {category === 'cadmio' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
            <div className="w-full max-w-3xl">
              <div className="flex items-center justify-center gap-2 mb-8">
                <Package className="w-5 h-5" style={{ color: 'var(--ely-accent)' }} />
                <h2 className="text-xl font-medium tracking-wide" style={{ color: 'var(--ely-text)' }}>
                  Productos
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                {CADMIO_PRODUCTS.map((name) => (
                  <button key={name} type="button" onClick={() => onSelectProduct(name)} className="ely-product-card group">
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
        )}

        {category === 'reportes' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 px-6">
            <FileText className="w-10 h-10" style={{ color: 'var(--ely-text-dim)' }} />
            <h2 className="text-lg font-medium tracking-wide" style={{ color: 'var(--ely-text)' }}>
              Reportes
            </h2>
            <p className="text-sm max-w-xs" style={{ color: 'var(--ely-text-muted)' }}>
              Sección de reportes de Cadmio y Plaguicidas. Próximamente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
