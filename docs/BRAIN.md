# ELYRA Brain 1.8 — IA sin API key

## Honestidad técnica

**No** es un LLM entrenado desde cero (eso requiere GPUs, terabytes de datos y semanas).

**Sí** es un cerebro híbrido propio de ELYRA:

1. Clasificación de intención
2. Hechos locales (hora, math, identidad)
3. Recuperación web (Wikipedia + DuckDuckGo)
4. Síntesis en español conversacional
5. Ollama opcional (modelo local real)

## Sin API key puedes

- Preguntar *qué es…*, *explica…*, *quién fue…*
- Cálculos
- Control del PC
- Memoria simple
- Respuestas con datos de internet

## Más potencia offline (recomendado)

```bash
# Instala Ollama desde https://ollama.com
ollama pull llama3.2
```

ELYRA lo detecta solo en `http://127.0.0.1:11434`.

## Flujo

```
Usuario → chat-router
         → tryLocal (PC/math)
         → ELYRA Brain (web + síntesis)
         → Ollama si existe
         → LLM cloud solo si hay API key
```
