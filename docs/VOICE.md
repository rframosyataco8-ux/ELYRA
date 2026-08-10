# ELYRA Voice (0.6)

## Pipeline

```text
MIC → VAD (RMS) → MediaRecorder → STT → ELYRA → TTS (cache|edge-tts) → speaker
         ↑ barge-in (Ctrl+Espacio / hablar encima)
```

## Mejoras 0.6

| Tema | Comportamiento |
|------|----------------|
| VAD | Umbral de habla ~0.018, silencio ~1.15 s |
| Barge-in | Corta TTS y **empieza a escuchar** |
| Anti-eco | Ignore corto tras fin de frase (~350–500 ms) |
| Latencia TTS | Caché de confirmaciones cortas |
| Atajo | `Ctrl+Espacio` interrumpe |

## Dependencias

```bash
pip install edge-tts
```

Voz por defecto: `es-MX-DaliaNeural`.
