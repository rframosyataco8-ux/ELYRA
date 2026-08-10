# ELYRA Training Foundation (1.5)

## Qué es (y qué no es)

**Sí:** pipeline para *preparar* datos y medir readiness de fine-tune.

**No:** entrenar GPT/Claude dentro de Electron ni “crear una IA mejor que cualquiera” sin datos ni cómputo.

## Flujo recomendado

1. Usar ELYRA con normalidad (conversaciones + tools).
2. Revisar readiness:
   ```bash
   node -e "console.log(JSON.stringify(require('./electron/training-pipeline.cjs').trainingStatus(),null,2))"
   ```
3. Exportar dataset:
   ```bash
   node -e "console.log(JSON.stringify(require('./electron/training-pipeline.cjs').exportDataset(),null,2))"
   ```
4. Archivo en `~/.elyra/training/elyra-sft-*.jsonl`
5. Fine-tune **externo** (Unsloth, Axolotl, Ollama, etc.) sobre un modelo abierto.
6. Apuntar ELYRA al modelo resultante (Ollama / OpenAI-compatible).

## Métricas

`behavioralMetrics()` reporta pares disponibles, longitudes medias, tool_ok_rate, etc.
No sustituyen un benchmark humano de calidad de respuesta.

## Privacidad

Export aplica redacción básica de secretos/emails/teléfonos. Revisa el JSONL antes de subirlo a cualquier servicio.
