# ELYRA — Asistente Inteligente de Escritorio

Asistente de voz natural + inteligencia con LLM. Controla tu PC, investiga, crea documentos y entiende lenguaje libre.

## Voz natural

Usa **edge-tts** (voces neuronales de Microsoft, español):

```bash
pip install edge-tts
```

Voz por defecto: `es-ES-ElviraNeural` (muy natural).

Si no está instalado, usa la mejor voz del sistema como respaldo.

**Siempre responde con voz** (tanto si escribes como si hablas).

## Inteligencia real (LLM)

Para que entienda cualquier cosa (no solo comandos fijos):

1. Crea la carpeta y archivo de config:

```bash
mkdir %USERPROFILE%\.elyra
```

2. Crea `config.json` dentro:

```json
{
  "apiKey": "tu-api-key",
  "baseUrl": "https://api.openai.com/v1",
  "model": "gpt-4o-mini"
}
```

### APIs compatibles

| Proveedor | baseUrl | Ejemplo modelo |
|-----------|---------|----------------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Groq (gratis/rápido) | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` |
| xAI Grok | `https://api.x.ai/v1` | `grok-2-latest` |
| Ollama local | `http://localhost:11434/v1` | `llama3.2` |

Con la API key configurada puedes pedir cosas como:

- "¿Quién inventó el WiFi?"
- "Busca información sobre la Segunda Guerra Mundial y crea un artículo HTML en la carpeta Informes"
- "Analiza el archivo datos.csv y hazme un reporte gerencial en HTML"
- "Abre Chrome" / "Abre la carpeta Descargas"
- "Recuerda que la reunión es el viernes"

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
- Cerrar ventana → queda en bandeja del sistema

## Arquitectura

- **Electron** — acceso real al sistema operativo
- **edge-tts** — voz neuronal natural en español
- **Agente LLM** — entiende lenguaje libre + herramientas (buscar, crear archivos, abrir apps, leer archivos, memoria)
- **React + Tailwind** — interfaz futurista con globo interactivo
