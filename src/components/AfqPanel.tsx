import { Beaker } from 'lucide-react';

export function AfqPanel() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 px-5 animate-fade-in">
      <Beaker className="w-10 h-10 text-sky-400/40" />
      <h2 className="text-lg font-medium text-white tracking-wide">AFQ</h2>
      <p className="text-sm text-sky-400/50 max-w-xs">
        Análisis físico químico. Sección en preparación.
      </p>
    </div>
  );
}
