# ELYRA Changelog

## [0.3.0] — 2026-08-08 — Resilient LLM

### Added
- `electron/llm-resilience.cjs` — detección unificada de errores (tools, auth, rate limit, red)
- Defaults de modelos alineados voz+tools (Groq 70B, Gemini Flash, Claude Sonnet 4, etc.)
- Lista `GROQ_MODELS` en UI providers

### Changed
- `src/lib/providers.ts` — presets y `detectFromKey` con modelos más capaces por defecto
- Plataforma **0.3.0** ResilientLLM

### Notes
- El agente ya reintentaba sin tools ante 404; 0.3 centraliza criterios y defaults
- Sin API key sigue activo local-intelligence + web

---

## [0.2.0] — 2026-08-08 — Safe Tools

- Permisos para power/kill/shell/papelera
- Bloqueo de comandos destructivos

---

## [0.1.0] — 2026-08-08 — Foundation

- Versionado, smoke, ARCHITECTURE, CHANGELOG, SEQUENCE

---

## [2.0.0] — Product shell

Electron + React, voz, PC, multi-provider.
