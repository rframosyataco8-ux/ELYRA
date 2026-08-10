# ELYRA — Asistente inteligente de escritorio

**Plataforma IA 1.0 (Horizon)** · Producto Electron 2.0  
Voz natural · control del PC · web · documentos · visión · memoria

## Qué es

ELYRA es un asistente de **escritorio** (no solo un chatbot web):

- Habla y escucha (edge-tts + STT)
- Controla apps, volumen, ventanas, archivos
- Busca en internet y en **tus** documentos (RAG local)
- Analiza Excel/PDF/Word (Python)
- Describe imágenes si usas un modelo multimodal
- Funciona con API key (Groq, Gemini, OpenAI, Claude, NVIDIA, Ollama…) o en modo reducido sin key (web + reglas + Ollama local)

## Instalación

```bash
git pull origin main
npm install
pip install edge-tts
pip install -r electron/python_tools/requirements.txt
npm run dev:electron
```

## Configuración

En la app: **Configuración** → API key + proveedor + modelo.

O manualmente `~/.elyra/config.json` (Windows: `%USERPROFILE%\.elyra\config.json`).

## Atajos

| Atajo | Acción |
|-------|--------|
| `Ctrl+Shift+E` | Mostrar / ocultar |
| `Ctrl+Espacio` | Interrumpir voz (barge-in) e iniciar escucha |

## Evaluación offline

```bash
node -e "console.log(JSON.stringify(require('./electron/elyra-eval.cjs').runEval(),null,2))"
```

## Documentación

- [ARCHITECTURE](docs/ARCHITECTURE.md)
- [SEQUENCE](docs/SEQUENCE.md) — roadmap 0.0 → 1.0
- [VOICE](docs/VOICE.md) · [RAG](docs/RAG.md) · [FILES](docs/FILES.md) · [VISION](docs/VISION.md)
- [EVAL](docs/EVAL.md) · [SECURITY](docs/SECURITY.md)
- [CHANGELOG](docs/CHANGELOG.md)

## Post-1.0

Base de datos de sistema completa, multi-agent y entrenamiento — **cuando tú lo decidas**.

## Autor

Fabricio Ramos
