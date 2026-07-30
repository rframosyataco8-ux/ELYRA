# ELYRA v2.0 — Asistente Inteligente de Escritorio

Asistente de voz natural + inteligencia con LLM. Controla tu PC, investiga, crea documentos y entiende lenguaje libre.

Interfaz holographic tipo JARVIS · voz neural · control total del sistema.

## Novedades v2.0

- **Diseño maximizado**: HUD holographic, globo de red más denso y reactivo, paneles con brackets, ambient glow
- **Configuración en la app**: pestaña Configuración con API key, proveedor (Groq / OpenAI / xAI / OpenRouter / Ollama) y modelo
- **Agente v4**: personalidad más precisa, corrección de STT ampliada, mensajes más claros
- **Indicadores de estado**: IA conectada, voz neural, telemetría en vivo
- **Memoria**: borrar notas/hechos desde la UI

## Voz natural

Usa **edge-tts** (voces neuronales de Microsoft, español):

```bash
pip install edge-tts
```

Voz por defecto: `es-ES-ElviraNeural` (muy natural).

Si no está instalado, usa la mejor voz del sistema como respaldo.

**Siempre responde con voz** (tanto si escribes como si hablas).

## Inteligencia real (LLM)

### Opción A — Desde la app (recomendado)

1. Ejecuta ELYRA
2. Ve a **Configuración**
3. Elige proveedor, pega tu API key y guarda

### Opción B — Archivo manual

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
| Groq (gratis/rápido) | `https://api.groq.com/openai/v1` | `llama-3.1-8b-instant` / `llama-3.3-70b-versatile` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| xAI Grok | `https://api.x.ai/v1` | `grok-2-latest` |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` |
| Ollama local | `http://localhost:11434/v1` | `llama3.2` |

Con la API key puedes pedir:

- "¿Quién inventó el WiFi?"
- "Busca información sobre la Segunda Guerra Mundial y crea un artículo HTML en Informes"
- "Analiza el archivo datos.csv y hazme un reporte gerencial en HTML"
- "Abre Chrome" / "Abre la carpeta Descargas"
- "Recuerda que la reunión es el viernes"
- "Sube el volumen" / "Haz una captura de pantalla"

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
- **React + Tailwind** — interfaz holographic con globo interactivo y paneles de telemetría

## Autor

Fabricio Ramos
