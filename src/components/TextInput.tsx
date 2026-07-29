import { useState, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface TextInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function TextInput({ onSend, disabled }: TextInputProps) {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="flex items-center gap-3 hud-panel hud-corner rounded-lg px-4 py-3">
      <span className="text-jarvis-glow font-display text-xs tracking-widest">&gt;</span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        disabled={disabled}
        placeholder="Escriba un comando..."
        className="flex-1 bg-transparent outline-none text-jarvis-100 placeholder:text-jarvis-500/40 text-sm font-mono"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="text-jarvis-glow hover:text-jarvis-100 disabled:opacity-30 transition-colors"
      >
        <Send className="w-5 h-5" />
      </button>
    </div>
  );
}
