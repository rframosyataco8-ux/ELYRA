import { useState } from 'react';
import { Image, Loader2 } from 'lucide-react';

interface Props {
  disabled?: boolean;
  onResult: (userLabel: string, reply: string) => void;
}

/**
 * Botón de la barra de chat: abre diálogo nativo y analiza imagen (visión/OCR).
 */
export function ChatImageButton({ disabled, onResult }: Props) {
  const [busy, setBusy] = useState(false);
  const isDesktop = typeof window !== 'undefined' && !!window.elyra?.isDesktop;

  const handleClick = async () => {
    if (!isDesktop || !window.elyra?.pickAndAnalyzeImage || disabled || busy) return;
    setBusy(true);
    try {
      const r = await window.elyra.pickAndAnalyzeImage(
        'Describe la imagen y transcribe cualquier texto visible en español. Sé clara y breve.',
      );
      const reply = String(r?.result || 'No pude analizar la imagen.').trim();
      onResult('[Imagen seleccionada]', reply);
    } catch {
      onResult('[Imagen]', 'No pude analizar la imagen.');
    } finally {
      setBusy(false);
    }
  };

  if (!isDesktop) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || busy}
      className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-40"
      style={{ color: 'var(--ely-text-muted)' }}
      title="Analizar imagen"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Image className="w-3.5 h-3.5" />}
    </button>
  );
}
