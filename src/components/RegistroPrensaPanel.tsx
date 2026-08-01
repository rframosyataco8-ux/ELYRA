import { LayoutDashboard, Database, ClipboardList } from 'lucide-react';

interface RegistroPrensaPanelProps {
  onSelectView: (view: 'dashboard' | 'datos') => void;
}

export function RegistroPrensaPanel({ onSelectView }: RegistroPrensaPanelProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 px-5 py-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-6">
        <ClipboardList className="w-4 h-4 text-sky-400" />
        <h2 className="text-lg font-medium text-white tracking-wide">Registro de prensa</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
        <button
          onClick={() => onSelectView('dashboard')}
          className="rounded-xl border border-sky-500/25 bg-sky-950/40 hover:bg-sky-500/15 hover:border-sky-400/45 transition-all flex flex-col items-center justify-center gap-3 p-8 group"
        >
          <div className="w-12 h-12 rounded-xl border border-sky-500/30 bg-sky-500/10 flex items-center justify-center group-hover:border-sky-400/50 transition-colors">
            <LayoutDashboard className="w-6 h-6 text-sky-400/80 group-hover:text-sky-300" />
          </div>
          <span className="text-sm text-sky-100/90 tracking-wide">Dashboard</span>
        </button>

        <button
          onClick={() => onSelectView('datos')}
          className="rounded-xl border border-sky-500/25 bg-sky-950/40 hover:bg-sky-500/15 hover:border-sky-400/45 transition-all flex flex-col items-center justify-center gap-3 p-8 group"
        >
          <div className="w-12 h-12 rounded-xl border border-sky-500/30 bg-sky-500/10 flex items-center justify-center group-hover:border-sky-400/50 transition-colors">
            <Database className="w-6 h-6 text-sky-400/80 group-hover:text-sky-300" />
          </div>
          <span className="text-sm text-sky-100/90 tracking-wide">Datos</span>
        </button>
      </div>
    </div>
  );
}
