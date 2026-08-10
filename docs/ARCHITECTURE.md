# ELYRA — Architecture (1.0)

**Platform:** 1.0.0 Horizon  
**Product shell:** 2.0.0 (Electron/React)

## Topology

```text
Renderer (React) ──IPC──► Electron main
                            ├── chat-router
                            ├── agent (LLM + tools)
                            ├── local-intelligence (no key)
                            ├── web-search + cache
                            ├── rag-local
                            ├── memory-cognitive
                            ├── vision-engine
                            ├── files-reliability + python_tools
                            ├── pc-control
                            ├── stt / tts (+ cache)
                            ├── tool-permissions + security-harden
                            └── elyra-eval / smoke-integrity
```

## Data on disk (user profile)

| Path | Use |
|------|-----|
| `~/.elyra/config.json` | API keys, modelos, TTS |
| `~/.elyra/memory/` | Memoria cognitiva |
| `~/.elyra/rag/index.json` | Índice RAG |
| `~/.elyra/search-cache.json` | Caché web |
| `~/.elyra/audit.log` | Auditoría de seguridad |

## Design rules

1. No romper control PC / voz existentes sin análisis.
2. Preferir API + tools + RAG antes de entrenar.
3. Acciones destructivas requieren confirmación.
4. `main` debe permanecer usable tras cada push.

## Next (post-1.0)

System-wide database, multi-agent, optional training — **only when you authorize**.
