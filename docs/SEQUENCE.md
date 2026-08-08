# ELYRA — Implementation sequence

Ordered work from the 0.0 audit. **One phase at a time** on `main`.

| Order | Version | Name | Status |
|------:|---------|------|--------|
| 0 | 0.0 | Full audit | Done |
| 1 | **0.1** | Foundation (docs, version, smoke) | **Done** |
| 2 | 0.2 | Tool permissions + safe destructive actions | Next |
| 3 | 0.3 | LLM resilience (providers, tool-calling) | Pending |
| 4 | 0.4 | Memory structured + better recall | Pending |
| 5 | 0.5 | RAG over user documents | Pending |
| 6 | 0.6 | Voice pro (VAD, barge-in, latency) | Pending |
| 7 | 0.7 | Files/data pipeline reliability | Pending |
| 8 | 0.8 | Vision via multimodal API | Pending |
| 9 | 0.9 | ELYRA_EVAL + security hardening | Pending |
| 10 | 1.0 | Production polish | Pending |

After each phase: user runs only `git pull origin main` and tests.
