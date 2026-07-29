# ELYRA — Asistente Inteligente de Escritorio

Asistente de voz y texto con control real del PC, memoria local y interfaz futurista.

## Nombre

**ELYRA** — nombre original, no utilizado en otros asistentes conocidos.

## Características

- **Aplicación de escritorio** (Electron)
- Globo de red **interactivo** (reacciona al hablar / escuchar)
- Control del PC: abrir apps, carpetas, URLs
- Memoria local persistente (notas y hechos)
- Estadísticas reales de CPU / RAM / Disco
- Voz (escuchar + hablar) en español
- Bandeja del sistema (sigue en segundo plano)
- Atajo global: `Ctrl+Shift+E` para mostrar/ocultar
- Ventana sin marco (frameless) con controles propios

## Instalación

```bash
npm install
```

## Desarrollo

```bash
# Solo interfaz (navegador)
npm run dev

# App de escritorio completa
npm run dev:electron
```

## Build / instalador

```bash
npm run build:electron
```

El instalador se genera en la carpeta `release/`.

## Ejemplos de comandos

- "Abre Chrome"
- "Abre Visual Studio Code"
- "Abre la carpeta Descargas"
- "Busca el clima de hoy"
- "Recuerda que mi reunión es el viernes"
- "Qué recuerdas"
- "Estado del sistema"
- "Calcula 25 * 4"
- "Qué hora es"

## Arquitectura

- **Renderer**: React + TypeScript + Tailwind (interfaz)
- **Main process**: Electron (acceso real al SO)
- **Preload**: bridge seguro vía `contextBridge`
- **Memoria**: archivo JSON en `userData` del sistema

## Próximas mejoras posibles

- Integración con LLM (comprensión total de lenguaje natural)
- Más acciones de sistema (volumen, brillo, capturas)
- Plugins / extensiones
- Wake-word ("Hey ELYRA")
