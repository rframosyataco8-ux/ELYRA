# ELYRA — Architecture

**Platform version:** 0.1.0 (Foundation)  
**Product version:** 2.0.0  
**Last audit:** 2026-08-08

## What ELYRA is

ELYRA is a **desktop voice assistant** built with Electron. It combines:

- Local PC control
- Optional cloud LLM (Groq, Gemini, OpenAI, Claude, xAI, NVIDIA, OpenRouter)
- Optional local LLM (Ollama)
- Web knowledge (Wikipedia + DuckDuckGo) without paid search APIs
- Basic memory and file/Python tools

It is **not** yet a full multimodal AI platform (no vision, no formal RAG, no multi-agent orchestration, no training pipeline).

## Runtime topology

```text
┌─────────────────────────────────────────────────────────┐
│  Renderer (React + Vite)                                │
│  App.tsx · useVoice · useWakeWord · providers           │
└───────────────────────┬─────────────────────────────────┘
                        │ IPC
┌───────────────────────▼─────────────────────────────────┐
│  Electron main                                          │
│  main.cjs → chat-router → agent | local-intelligence    │
│           → tools → pc-control | web | python_tools     │
│           → stt / tts                                   │
└─────────────────────────────────────────────────────────┘
                        │
              ~/.elyra/config.json
              ~/.elyra/search-cache.json
```

## Conversation pipeline

```text
User (voice|text)
  → STT (if voice)
  → normalize intent
  → chat-router
       ├─ presence / local PC commands
       ├─ knowledge → web search (+ cache)
       ├─ local-intelligence (no API key / fallback)
       ├─ OpenClaw (optional)
       └─ agent (LLM + tools)
  → speakify
  → TTS
  → audio (+ barge-in)
```

## Core modules (`electron/`)

| Module | Role |
|--------|------|
| `main.cjs` | Windows, tray, IPC |
| `chat-router.cjs` | Intent routing |
| `agent.cjs` | LLM loop + tool calls |
| `agent-prompt.cjs` | System personality |
| `tool-executor.cjs` | Tool dispatch |
| `tools-schema.cjs` | Tool definitions |
| `pc-control.cjs` | OS control |
| `tts.cjs` / `stt.cjs` | Speech |
| `web-search-boost.cjs` | Internet knowledge |
| `smart-knowledge.cjs` | Wikipedia/DDG summaries |
| `search-cache.cjs` | Search TTL cache |
| `local-intelligence.cjs` | Offline / no-key path |
| `memory-cognitive.cjs` | Simple facts memory |
| `elyra-version.cjs` | Platform version |
| `smoke-integrity.cjs` | Module load checks |

## Models strategy (0.1)

| Need | Approach |
|------|----------|
| Strong reasoning | External API LLM |
| Fast / free | Groq or Gemini Flash |
| Private | Ollama local |
| Facts | Web search (not model weights) |
| Voice | edge-tts (not custom trained TTS) |

**Do not train from scratch** unless a metric proves prompts/tools/RAG insufficient.

## Security notes (current)

- API keys stored in `~/.elyra/config.json`
- Shell / power tools exist — treat as privileged
- Formal permission prompts for destructive actions: **planned 0.2+**

## Roadmap (from audit)

| Version | Focus |
|---------|--------|
| 0.1 | Foundation (this doc, version, smoke) |
| 0.2 | Permissions + safer tools |
| 0.3 | LLM resilience |
| 0.4 | Memory+ |
| 0.5 | RAG files |
| 0.6 | Voice pro |
| 0.7 | Data/files reliability |
| 0.8 | Vision (API) |
| 0.9 | Eval + security |
| 1.0 | Production polish |
