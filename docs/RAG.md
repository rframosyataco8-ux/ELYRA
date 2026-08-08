# ELYRA RAG local (0.5)

## Qué es

Índice **local** de fragmentos de tus archivos para que ELYRA responda con base en documentos tuyos (no solo en internet ni en notas cortas).

## Qué no es

- No es la base de datos global del sistema (futuro, cuando tú lo decidas).
- No sube archivos a la nube por el índice.
- No entrena un modelo.

## Dónde se guarda

`~/.elyra/rag/index.json`

## Carpetas por defecto

- Documents
- Documents/Informes
- Desktop
- Downloads

## Formatos

- Texto: `.txt` `.md` `.csv` `.json` `.log` `.html`
- Rico: `.pdf` `.docx` (vía Python + pypdf / python-docx)

## Comandos / tools

| Acción | Cómo |
|--------|------|
| Buscar en documentos | tool `rag_search` o pregunta del tipo «según mis informes…» |
| Reconstruir índice | «reindexar documentos» / tool `reindex_docs` |

## Límites actuales

- Retrieval léxico (no embeddings vectoriales aún)
- Tope de archivos/fragmentos para no hinchar el disco
- PDF grandes: extracción parcial

## Evolución posible

Embeddings locales → vector store → **base de datos de sistema** (tu decisión posterior).
