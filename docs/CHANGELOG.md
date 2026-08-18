# ELYRA Changelog

## [1.12.3] — 2026-08-18 — Face unlock de escritorio (estable)

### Fixed
- Escaneo facial ya no se reinicia en cada re-render (efecto de cámara solo por `mode`/`userId`)
- Video de captura oculto pero con tamaño real (Electron decodifica frames de forma fiable)
- Dependencia circular `getConfig` en `agent-hooks` (carga diferida)
- Referencia TypeScript a tests Vitest en el workspace

### Note
ELYRA es **app de escritorio** (Electron). El desbloqueo facial es local en el PC:
cámara del equipo + descriptor + anti-spoof. No es Face ID de Apple ni app iOS/móvil.

## [1.12.2] — 2026-08-18 — Desbloqueo facial sin preview

### Changed
- El desbloqueo facial **no muestra la cámara**: captura en segundo plano
- UI abstracta de escritorio: anillo de progreso, icono ScanFace, línea de escaneo
- Colores y botones alineados al design system (`--ely-*`, `ely-btn-primary`)

### Note
La webcam del PC sigue activa de forma invisible para descriptor + anti-spoof 3D.

## [1.12.1] — 2026-08-18 — Build stable

### Fixed
- `electron-builder` ya no exige `public/icon.*` (evita fallo de empaquetado sin assets)
- SystemPanel: valores iniciales en 0; sin simulación aleatoria de red/CPU en desktop
- Versión de producto alineada (2.0.1 / platform 1.12.1)

### Note
Para iconos de instalador, añada `public/icon.ico` (Windows), `public/icon.png` (Linux) y `public/icon.icns` (macOS) y vuelva a declarar las rutas en `package.json` → `build`.

## [1.12.0] — 2026-08-18 — FaceSecure + cleanup

### Added
- Biometría facial avanzada en escritorio (MediaPipe FaceLandmarker)
- Anti-spoofing 3D (textura, parallax, flujo regional)
- Liveness pasivo obligatorio al verificar
- UI de desbloqueo facial con feedback en vivo
- Desbloqueo facial al elegir usuario con rostro registrado

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
