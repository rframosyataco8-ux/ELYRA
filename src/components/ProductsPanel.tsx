import { useMemo, useState } from 'react';
import { Package, FileText, Search } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

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
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...CADMIO_PRODUCTS];
    return CADMIO_PRODUCTS.filter((name) => name.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="flex-1 flex min-h-0 ely-page-enter">
      <div
        className="w-48 shrink-0 flex flex-col animate-slide-right"
        style={{ borderRight: '1px solid var(--ely-border)' }}
      >
        <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--ely-header-border)' }}>
          <p className="text-[10px] tracking-[0.15em] uppercase" style={{ color: 'var(--ely-text-dim)' }}>
            Categoría
          </p>
        </div>
        <div className="flex-1 p-3 space-y-2">
          <button
            type="button"
            onClick={() => setCategory('cadmio')}
            className={`ely-nav-item gap-2 px-3.5 py-3 text-sm tracking-wide text-left ${
              category === 'cadmio' ? 'active' : ''
            }`}
          >
            Cadmio y Plaguicidas
          </button>
          <button
            type="button"
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
          <div className="flex-1 flex flex-col items-center px-6 py-8">
            <div className="w-full max-w-3xl">
              <div className="flex items-center justify-center gap-2 mb-5 animate-fade-in">
                <Package className="w-5 h-5" style={{ color: 'var(--ely-accent)' }} />
                <h2 className="text-xl font-medium tracking-wide" style={{ color: 'var(--ely-text)' }}>
                  Productos
                </h2>
              </div>

              <div className="relative mb-6 max-w-md mx-auto w-full">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                  style={{ color: 'var(--ely-text-dim)' }}
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar producto…"
                  className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none ely-focus-ring"
                  style={{
                    background: 'var(--ely-input-bg)',
                    border: '1px solid var(--ely-border)',
                    color: 'var(--ely-text)',
                  }}
                  aria-label="Buscar producto"
                />
              </div>

              {filtered.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="Sin coincidencias"
                  description={`No hay productos que coincidan con “${query.trim()}”.`}
                />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 stagger-children">
                  {filtered.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => onSelectProduct(name)}
                      className="ely-product-card group"
                    >
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
              )}
            </div>
          </div>
        )}

        {category === 'reportes' && (
          <EmptyState
            icon={FileText}
            title="Reportes"
            description="Sección de reportes de Cadmio y Plaguicidas. Próximamente podrás generar y exportar informes."
          />
        )}
      </div>
    </div>
  );
}
