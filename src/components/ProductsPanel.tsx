import { useState } from 'react';
import { Package, LayoutDashboard, Database, LineChart, FileText, ChevronRight } from 'lucide-react';

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

const VIEWS: { id: ProductView; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'datos', label: 'Datos', icon: Database },
  { id: 'analisis', label: 'Análisis', icon: LineChart },
];

export function ProductsPanel({ onSelectProduct, onSelectReportes }: ProductsPanelProps) {
  const [category, setCategory] = useState<'cadmio' | 'reportes'>('cadmio');
  const [expanded, setExpanded] = useState<string | null>(null);

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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl">
              {CADMIO_PRODUCTS.map((name) => {
                const isOpen = expanded === name;
                return (
                  <div
                    key={name}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      isOpen
                        ? 'border-sky-400/40 bg-sky-500/10 shadow-[0_0_24px_rgba(14,165,233,0.12)]'
                        : 'border-sky-500/25 bg-sky-950/40 hover:border-sky-400/35'
                    }`}
                  >
                    <button
                      onClick={() => setExpanded(isOpen ? null : name)}
                      className="w-full flex items-center gap-3 p-3.5 text-left"
                    >
                      <div className="w-9 h-9 rounded-lg border border-sky-500/30 bg-sky-500/10 flex items-center justify-center shrink-0">
                        <Package className="w-4.5 h-4.5 text-sky-400/80" />
                      </div>
                      <span className="flex-1 text-[12px] text-sky-100/90 leading-tight tracking-wide">
                        {name}
                      </span>
                      <ChevronRight
                        className={`w-4 h-4 text-sky-400/50 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      />
                    </button>

                    {isOpen && (
                      <div className="px-3 pb-3 flex flex-col gap-1.5 border-t border-sky-500/15 pt-2">
                        {VIEWS.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => onSelectProduct(name, v.id)}
                            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] text-sky-200/80 hover:bg-sky-500/15 hover:text-sky-100 border border-transparent hover:border-sky-500/25 transition-all"
                          >
                            <v.icon className="w-3.5 h-3.5 text-sky-400/70" />
                            {v.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
