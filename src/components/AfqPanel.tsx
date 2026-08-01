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
    <div className="flex-1 flex flex-col min-h-0 px-5 py-4 animate-fade-in overflow-y-auto">
      <div className="flex items-center gap-2 mb-5">
        <Beaker className="w-4 h-4 text-sky-400" />
        <div>
          <h2 className="text-lg font-medium text-white tracking-wide">AFQ</h2>
          <p className="text-[11px] text-sky-400/50 tracking-wide">Análisis físico químico</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl">
        {AFQ_PRODUCTS.map((name) => (
          <button
            key={name}
            onClick={() => onSelectProduct?.(name)}
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
    </div>
  );
}
