# ELYRA Vision (0.8)

## Qué hace

Analiza imágenes locales (PNG, JPG, WEBP, GIF) o capturas con un **modelo multimodal** vía API compatible con OpenAI Chat Completions.

## Requisitos

- API key en Configuración
- Proveedor/modelo con visión, por ejemplo:
  - OpenAI: `gpt-4o-mini` / `gpt-4o`
  - Gemini: `gemini-2.0-flash`
  - OpenRouter: `openai/gpt-4o-mini`
  - NVIDIA: modelos vision Llama 3.2

Groq u otros sin visión devolverán error claro pidiendo cambiar de modelo.

## Tools

| Tool | Uso |
|------|-----|
| `analyze_image` | `path` + `prompt` opcional |
| `analyze_screenshot` | Captura PC + descripción |

## Ejemplos de voz/texto

- «Describe la imagen foto_lab.jpg en Descargas»
- «Analiza esta captura» (tras screenshot)
- «Qué texto aparece en el diagrama.png»

## Límites

- ~4 MB por imagen
- No es entrenamiento local de visión
- No OCR offline sin API
