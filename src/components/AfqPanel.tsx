import { useState } from 'react';
import { Beaker, Package, ChevronRight, LayoutDashboard, Database, LineChart } from 'lucide-react';

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

const VIEWS: { id: AfqView; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'datos', label: 'Datos', icon: Database },
  { id: 'analisis', label: 'Análisis', icon: LineChart },
];

export function AfqPanel({ onSelectProduct }: AfqPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="flex-1 flex flex-col min-h-0 px-5 py-4 animate-fade-in overflow-y-auto">
      <div className="flex items-center gap-2 mb-5">
        <Beaker className="w-4 h-4 text-sky-400" />
        <div>
          <h2 className="text-lg font-medium text-white tracking-wide">AFQ</h2>
          <p className="text-[11px] text-sky-400/50 tracking-wide">Análisis físico químico</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl">
        {AFQ_PRODUCTS.map((name) => {
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
                  <Package className="w-4 h-4 text-sky-400/80" />
                </div>
                <span className="flex-1 text-[12px] text-sky-100/90 leading-tight tracking-wide">
                  {name}
                </span>
                <ChevronRight
                  className={`w-4 h-4 text-sky-400/50 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="px-3 pb-3 flex flex-col gap-1.5 border-t border-sky-500/15 pt-2">
                  {VIEWS.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => onSelectProduct?.(name, v.id)}
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
    </div>
  );
}
