# ELYRA Changelog

## [0.2.0] — 2026-08-08 — Safe Tools

### Added
- `electron/tool-permissions.cjs` — autorización de acciones destructivas
- Confirmación verbal para apagar/reiniciar, matar procesos, vaciar papelera y shell agresivo
- Bloqueo de comandos shell peligrosos (`rm -rf /`, format, diskpart, etc.)
- Protección de procesos críticos del sistema

### Changed
- `tool-executor.cjs` aplica `authorizeTool` antes de ejecutar
- Plataforma marcada como **0.2.0** (SafeTools)

### Security
- El usuario debe decir «confirma» (o equivalente) para acciones irreversibles

---

## [0.1.0] — 2026-08-08 — Foundation

### Added
- `electron/elyra-version.cjs`
- `electron/smoke-integrity.cjs`
- `docs/ARCHITECTURE.md`, `CHANGELOG.md`, `DEVELOPMENT.md`, `SEQUENCE.md`

### Context (pre-0.1 on main)
- Identidad ELYRA, web autónoma, caché, local-intelligence, retry sin tools, voz mejorada

---

## [2.0.0] — Product shell

Electron + React UI, voz, PC control, multi-provider LLM.
