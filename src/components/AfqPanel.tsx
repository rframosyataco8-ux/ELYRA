import { useState } from 'react';
import {
  Beaker,
  Package,
  LayoutDashboard,
  Database,
  LineChart,
  ArrowLeft,
} from 'lucide-react';

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
  const [selected, setSelected] = useState<string | null>(null);

  if (selected) {
    return (
      <div className="flex-1 flex flex-col min-h-0 px-5 py-4 animate-fade-in">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-2 text-sky-400/60 hover:text-sky-200 text-[12px] mb-4 transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver a productos
        </button>

        <div className="flex items-center gap-2 mb-6">
          <Beaker className="w-4 h-4 text-sky-400" />
          <h2 className="text-lg font-medium text-white tracking-wide">{selected}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => onSelectProduct?.(selected, v.id)}
              className="rounded-xl border border-sky-500/25 bg-sky-950/40 hover:bg-sky-500/15 hover:border-sky-400/45 transition-all flex flex-col items-center justify-center gap-3 p-8 group min-h-[140px]"
            >
              <div className="w-12 h-12 rounded-xl border border-sky-500/30 bg-sky-500/10 flex items-center justify-center group-hover:border-sky-400/50 transition-colors">
                <v.icon className="w-6 h-6 text-sky-400/80 group-hover:text-sky-300" />
              </div>
              <span className="text-sm text-sky-100/90 tracking-wide">{v.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

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
        {AFQ_PRODUCTS.map((name) => (
          <button
            key={name}
            onClick={() => setSelected(name)}
            className="rounded-xl border border-sky-500/25 bg-sky-950/40 hover:bg-sky-500/15 hover:border-sky-400/45 transition-all flex items-center gap-3 p-3.5 text-left group"
          >
            <div className="w-9 h-9 rounded-lg border border-sky-500/30 bg-sky-500/10 flex items-center justify-center shrink-0 group-hover:border-sky-400/50 transition-colors">
              <Package className="w-4 h-4 text-sky-400/80" />
            </div>
            <span className="flex-1 text-[12px] text-sky-100/90 leading-tight tracking-wide">
              {name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
