# ELYRA Brain 1.9

## Qué mejora respecto a 1.8

- **Follow-ups**: entiende “y eso?”, “más detalles”, “por qué” usando el tema de la conversación
- **Multi-fuente**: Wikipedia + DuckDuckGo + documentos locales (RAG)
- **Fusión**: combina fragmentos y elimina duplicados
- **Comparar / cómo hacer**: intenciones nuevas
- **Ollama**: más contexto web+RAG si está instalado

## Sin API key

Funciona con internet (búsqueda) o con Ollama offline.

## Ollama (recomendado)

```bash
ollama pull llama3.2
```

## Documentos locales

Indexa Documentos/Escritorio/Descargas. Di “reindexar documentos” o pregunta por un informe.

## Límites honestos

No es GPT-4 entrenado desde cero. Es un sistema híbrido propio: recuperación + síntesis + modelo local opcional.
