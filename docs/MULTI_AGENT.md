# ELYRA Multi-Agent (1.2)

## Roles

| Rol | Función |
|-----|---------|
| Planner | Descompone la petición en pasos |
| Researcher | Web / RAG |
| Executor | Excel, PDF, Word, apps, dashboard |
| Verifier | Une resultados en respuesta hablable |

## Cuándo se activa

Tareas **complejas**, por ejemplo:

- «Investiga X y crea un informe Word»
- «Analiza el excel Y y genera un dashboard»
- Varias acciones en una sola frase (abre + busca + resume)

Órdenes simples (volumen, hora, una sola app) **no** pasan por multi-agent.

## Archivo

`electron/multi-agent.cjs`

## Límites

- Plan determinista (no depende de un LLM para planificar)
- El agente LLM clásico sigue disponible para el resto
