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
            <Beaker className="w-5 h-5 text-sky-400" />
            <h2 className="text-xl font-medium text-white tracking-wide">AFQ</h2>
          </div>
          <p className="text-center text-[12px] text-sky-400/50 tracking-wide mb-8">
            Análisis físico químico
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            {AFQ_PRODUCTS.map((name) => (
              <button
                key={name}
                onClick={() => onSelectProduct?.(name)}
                className="aspect-[5/4] rounded-2xl border border-sky-500/20 bg-sky-950/35 hover:bg-sky-500/12 hover:border-sky-400/40 hover:shadow-[0_0_28px_rgba(14,165,233,0.12)] transition-all duration-200 flex flex-col items-center justify-center gap-3 p-4 group"
              >
                <div className="w-11 h-11 rounded-xl border border-sky-500/25 bg-sky-500/10 flex items-center justify-center group-hover:border-sky-400/50 group-hover:scale-105 transition-all">
                  <Package className="w-5 h-5 text-sky-400/75 group-hover:text-sky-300" />
                </div>
                <span className="text-[12.5px] text-sky-200/80 text-center leading-snug tracking-wide group-hover:text-sky-50 px-1">
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
