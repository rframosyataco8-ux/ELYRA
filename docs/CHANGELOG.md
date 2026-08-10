# ELYRA Changelog

## [0.6.0] — 2026-08-10 — Voice Pro

### Added
- `tts-cache.cjs` — caché de frases cortas (menor latencia en «Listo», «Hecho», etc.)
- Barge-in → arranque automático de escucha
- VAD más sensible (umbrales y silencio afinados)
- Ventanas anti-eco más cortas tras hablar / interrumpir

### Changed
- `useVoice.ts` pipeline 0.6
- `tts.cjs` usa caché antes de sintetizar
- Logs de latencia etiquetados ELYRA (no Luna)

---

## [0.5.0] — Local RAG
## [0.4.0] — Structured Memory
## [0.3.0] — Resilient LLM
## [0.2.0] — Safe Tools
## [0.1.0] — Foundation
