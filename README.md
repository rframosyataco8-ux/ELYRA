# NOVA AI — Asistente Inteligente

Asistente de escritorio con interfaz futurista, voz y control del sistema.

## Características actuales

- Diseño inspirado en panel de control futurista (globo de red interactivo)
- El globo reacciona al hablar y al escuchar (velocidad, brillo, conexiones, anillos de energía)
- Reconocimiento y síntesis de voz (español)
- Comandos por voz o texto
- Panel de estado del sistema (CPU, RAM, Disco, Red)
- Panel de protección
- Historial de conversación (Supabase)

## Cómo ejecutar

```bash
npm install
npm run dev
```

Abre en Chrome o Edge para que funcione el micrófono.

## Próximos pasos (escritorio + autonomía real)

- Convertir a Electron / Tauri para control real del PC
- Integrar LLM (Grok / OpenAI) para comprensión natural
- Acciones de sistema (abrir apps, archivos, scripts, etc.)
