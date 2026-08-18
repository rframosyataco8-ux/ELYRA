# ELYRA Changelog

## [1.12.1] — 2026-08-18 — Build stable

### Fixed
- `electron-builder` ya no exige `public/icon.*` (evita fallo de empaquetado sin assets)
- SystemPanel: valores iniciales en 0; sin simulación aleatoria de red/CPU en desktop
- Versión de producto alineada (2.0.1 / platform 1.12.1)

### Note
Para iconos de instalador, añada `public/icon.ico` (Windows), `public/icon.png` (Linux) y `public/icon.icns` (macOS) y vuelva a declarar las rutas en `package.json` → `build`.

## [1.12.0] — 2026-08-18 — FaceSecure + cleanup

### Added
- Biometría facial avanzada (MediaPipe FaceLandmarker)
- Anti-spoofing 3D (textura, parallax, flujo regional)
- Liveness pasivo obligatorio al verificar
- UI Face ID premium con feedback de calidad en vivo
- Desbloqueo facial continuo al elegir usuario con rostro

### Changed
- Panel de configuración de IA extraído a componente propio (`AiConfigPanel`)
- Stats de red ya no usan valor aleatorio (0 si no hay fuente real)
- Versión y capabilities alineadas con el código real
- Modelo por defecto UI alineado con presets (llama-3.3-70b-versatile)

### Removed
- `electron/main-patches.md` (notas obsoletas / rutas jarvis)

### Fixed
- Inconsistencia de modelo default entre App y providers

## [1.11.0] — 2026-08-10 — ContextAware

- Contexto conversacional + conocimiento ampliado
- Brain local multi-fuente

## [1.7.1] — 2026-08-10 — Stable hybrid voice

### Fixed
- Regresión 1.7: bucles de reconocimiento y pérdida de Whisper
- Voz híbrida: Web Speech → Whisper (si hay key) sin mensajes de error confusos
- Relisten solo con continuous/deskMode (icono oreja)
- Sin arranque agresivo al montar que rompía el mic

### How to use continuous talk
1. Pulsa el icono **oreja** (reesucha) o minimiza en modo escritorio
2. Habla tras cada respuesta de ELYRA

## [1.7.0] — Hands-free attempt
## [1.6.0] — Product complete
