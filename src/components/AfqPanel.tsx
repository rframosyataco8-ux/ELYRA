import { Beaker, FlaskConical } from 'lucide-react';

export type AfqView = 'dashboard' | 'datos' | 'analisis';

const AFQ_ITEMS = [
  { name: 'pH y acidez', hint: 'Análisis físico-químico' },
  { name: 'Humedad', hint: 'Control de calidad' },
  { name: 'Cenizas', hint: 'Residuo mineral' },
  { name: 'Grasa', hint: 'Extracto etéreo' },
] as const;

interface AfqPanelProps {
  onSelectProduct: (name: string, view?: AfqView) => void;
}

export function AfqPanel({ onSelectProduct }: AfqPanelProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full max-w-3xl mx-auto px-2">
      <div className="flex items-center gap-2 mb-6">
        <Beaker className="w-4 h-4" style={{ color: 'var(--ely-accent)' }} />
        <h2 className="text-lg font-medium" style={{ color: 'var(--ely-text)' }}>
          AFQ · Análisis físico-químico
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger-children">
        {AFQ_ITEMS.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => onSelectProduct(item.name, 'dashboard')}
            className="ely-product-card group text-left !items-start !px-5 !py-4"
          >
            <div className="flex items-center gap-3 w-full">
              <div className="ely-product-icon shrink-0">
                <FlaskConical className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-medium" style={{ color: 'var(--ely-text)' }}>
                  {item.name}
                </span>
                <span className="block text-[12px] mt-0.5" style={{ color: 'var(--ely-text-muted)' }}>
                  {item.hint}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <p className="text-[12px] mt-6 text-center" style={{ color: 'var(--ely-text-dim)' }}>
        Selecciona un ensayo para abrir el panel de datos en ventana dedicada.
      </p>
    </div>
  );
}
