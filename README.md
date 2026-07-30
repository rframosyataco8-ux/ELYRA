# ELYRA — Asistente Inteligente de Escritorio v2.0

Asistente de voz natural + inteligencia con LLM. Controla tu PC, investiga, crea documentos y entiende lenguaje libre. Interfaz HUD estilo JARVIS.

## Novedades v2.0

- **Diseño HUD cinematográfico**: partículas, globo neuronal mejorado, glassmorphism, boot sequence
- **Configuración de API key desde la UI** (ya no solo archivo)
- **Acciones rápidas** en pantalla principal (Chrome, Descargas, Captura, Volumen…)
- **Personalidad JARVIS**: respuestas elegantes, proactivas y concisas para voz
- **Panel de sistema** con telemetría real + atajos visibles
- **Conversación premium** con animaciones y etiquetas

## Voz natural

Usa **edge-tts** (voces neuronales de Microsoft, español):

```bash
pip install edge-tts
```

Voz por defecto: `es-ES-ElviraNeural`.

**Siempre responde con voz** (tanto si escribes como si hablas).

## Inteligencia real (LLM)

### Opción A — Desde la app

1. Abre **Configuración** en el menú lateral
2. Pega tu API key de Groq / OpenAI / xAI / OpenRouter
3. Elige modelo y guarda

### Opción B — Archivo

```bash
mkdir %USERPROFILE%\.elyra
```

Crea `config.json`:

```json
{
  "apiKey": "tu-api-key",
  "baseUrl": "https://api.groq.com/openai/v1",
  "model": "llama-3.1-8b-instant"
}
```

### APIs compatibles

| Proveedor | baseUrl | Ejemplo modelo |
|-----------|---------|----------------|
| Groq (gratis/rápido) | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` |
| xAI Grok | `https://api.x.ai/v1` | `grok-2-latest` |
| Ollama local | `http://localhost:11434/v1` | `llama3.2` |

## Instalación

```bash
npm install
pip install edge-tts
```

## Ejecutar (escritorio)

```bash
npm run dev:electron
```

## Atajos

- `Ctrl+Shift+E` — mostrar / ocultar
- `Ctrl+Espacio` — interrumpir voz (barge-in)
- Cerrar ventana → queda en bandeja del sistema

## Arquitectura

- **Electron** — acceso real al sistema operativo
- **edge-tts** — voz neuronal natural en español
- **Agente LLM** — entiende lenguaje libre + herramientas (buscar, crear archivos, abrir apps, leer archivos, memoria, control PC)
- **React + Tailwind** — interfaz futurista HUD con globo interactivo y partículas
