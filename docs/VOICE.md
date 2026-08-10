# ELYRA Voice 1.7 — Hands-free

## Sin API key

La escucha usa **Web Speech API** del sistema (Chromium/Electron).
No requiere Groq ni Whisper para conversar.

- Necesita **internet** para el motor de reconocimiento del sistema.
- Micrófono permitido en Windows → Privacidad → Micrófono.

## Conversación continua

Por defecto `continuous = true`:

1. ELYRA escucha
2. Tú hablas
3. Responde (edge-tts / voz del sistema)
4. Vuelve a escuchar sola

Activa el icono **oreja** (reesucha) o modo escritorio al minimizar.

## Interrumpir

`Ctrl+Space` (barge-in) corta la voz y abre el mic.

## TTS natural

```bash
pip install edge-tts
```

Voz por defecto: `es-MX-DaliaNeural`.

## Inteligencia sin API key

Chat router → local-intelligence (math, web, Ollama si existe).

```bash
# Opcional razonamiento local fuerte
ollama pull llama3.2
```
