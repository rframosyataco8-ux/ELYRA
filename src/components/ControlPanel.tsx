import { Mic, MicOff, Volume2, VolumeX, Power } from 'lucide-react';

interface ControlPanelProps {
  listening: boolean;
  speaking: boolean;
  onToggleListen: () => void;
  onStopSpeak: () => void;
  onShutdown: () => void;
}

export function ControlPanel({ listening, speaking, onToggleListen, onStopSpeak, onShutdown }: ControlPanelProps) {
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={onToggleListen}
        className={`group relative w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
          listening
            ? 'border-jarvis-glow bg-jarvis-glow/20 animate-glow-pulse'
            : 'border-jarvis-500/40 bg-dark-700/50 hover:border-jarvis-glow hover:bg-jarvis-glow/10'
        }`}
        title={listening ? 'Detener escucha' : 'Hablar a Jarvis'}
      >
        {listening ? <MicOff className="w-6 h-6 text-jarvis-glow" /> : <Mic className="w-6 h-6 text-jarvis-300 group-hover:text-jarvis-glow" />}
      </button>

      <button
        onClick={onStopSpeak}
        disabled={!speaking}
        className={`group relative w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
          speaking
            ? 'border-jarvis-glow bg-jarvis-glow/20'
            : 'border-jarvis-500/20 bg-dark-700/30 opacity-40 cursor-not-allowed'
        }`}
        title="Silenciar voz"
      >
        {speaking ? <VolumeX className="w-6 h-6 text-jarvis-glow" /> : <Volume2 className="w-6 h-6 text-jarvis-300" />}
      </button>

      <button
        onClick={onShutdown}
        className="group relative w-14 h-14 rounded-full border-2 border-red-500/30 bg-dark-700/50 hover:border-red-500 hover:bg-red-500/10 flex items-center justify-center transition-all duration-300"
        title="Apagar Jarvis"
      >
        <Power className="w-6 h-6 text-red-400 group-hover:text-red-300" />
      </button>
    </div>
  );
}
