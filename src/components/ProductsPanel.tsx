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
      {/* Columna izquierda: categorías */}
      <div className="w-52 shrink-0 border-r border-sky-500/15 flex flex-col">
        <div className="px-4 py-4 border-b border-sky-500/10">
          <p className="text-[10px] text-sky-400/50 tracking-[0.15em] uppercase">Categoría</p>
        </div>
        <div className="flex-1 p-3 space-y-2">
          <button
            onClick={() => setCategory('cadmio')}
            className={`w-full rounded-xl px-3.5 py-3 text-sm tracking-wide text-left transition-all ${
              category === 'cadmio'
                ? 'bg-sky-500/15 border border-sky-400/30 text-sky-100 shadow-[0_0_20px_rgba(14,165,233,0.12)]'
                : 'border border-transparent text-sky-300/60 hover:bg-sky-500/10 hover:text-sky-100'
            }`}
          >
            Cadmio y Plaguicidas
          </button>
          <button
            onClick={() => {
              setCategory('reportes');
              onSelectReportes?.();
            }}
            className={`w-full rounded-xl px-3.5 py-3 text-sm tracking-wide text-left transition-all flex items-center gap-2 ${
              category === 'reportes'
                ? 'bg-sky-500/15 border border-sky-400/30 text-sky-100 shadow-[0_0_20px_rgba(14,165,233,0.12)]'
                : 'border border-transparent text-sky-300/60 hover:bg-sky-500/10 hover:text-sky-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0 opacity-70" />
            Reportes
          </button>
        </div>
      </div>

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0 px-5 py-4 overflow-y-auto">
        {category === 'cadmio' && (
          <>
            <div className="flex items-center gap-2 mb-5">
              <Package className="w-4 h-4 text-sky-400" />
              <h2 className="text-lg font-medium text-white tracking-wide">Productos</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl">
              {CADMIO_PRODUCTS.map((name) => (
                <button
                  key={name}
                  onClick={() => onSelectProduct(name)}
                  className="aspect-[4/3] rounded-xl border border-sky-500/25 bg-sky-950/40 hover:bg-sky-500/15 hover:border-sky-400/45 transition-all flex flex-col items-center justify-center gap-2 p-3 group"
                >
                  <div className="w-10 h-10 rounded-lg border border-sky-500/30 bg-sky-500/10 flex items-center justify-center group-hover:border-sky-400/50 transition-colors">
                    <Package className="w-5 h-5 text-sky-400/70 group-hover:text-sky-300" />
                  </div>
                  <span className="text-[12px] text-sky-200/80 text-center leading-tight tracking-wide group-hover:text-sky-100">
                    {name}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {category === 'reportes' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
            <FileText className="w-10 h-10 text-sky-400/40" />
            <h2 className="text-lg font-medium text-white tracking-wide">Reportes</h2>
            <p className="text-sm text-sky-400/50 max-w-xs">
              Sección de reportes de Cadmio y Plaguicidas. Próximamente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
