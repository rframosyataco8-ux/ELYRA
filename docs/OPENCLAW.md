# ELYRA × OpenClaw

## Qué es OpenClaw (resumen técnico real)

OpenClaw es un **gateway local de agentes** (hub-and-spoke), no solo un chat:

1. **Gateway** — demonio Node.js en `127.0.0.1:18789` (HTTP + WebSocket). Autenticación, sesiones, routing.
2. **Channels** — adaptadores (Telegram, Discord, web…) que normalizan mensajes.
3. **Agent runtime** — contexto + LLM + bucle tool-call / observation.
4. **Tools / Skills** — shell, archivos, browser, plugins.
5. **Memory** — persistencia de sesión y hechos.

Ciclo típico: mensaje → contexto → LLM → tool call → política/sandbox → ejecución local → observation → respuesta.

## Qué hace ELYRA sin OpenClaw

ELYRA **ya implementa** el equivalente operativo en el proceso Electron:

| Capa OpenClaw | Equivalente ELYRA |
|---|---|
| Gateway | `main.cjs` + IPC (`agent-chat`) |
| Agent loop | `agent.cjs` ReAct + function calling |
| Tools | `pc-control`, `apps`, Python bridge, `web_search` |
| Memory | `memory-cognitive` + `elyra-memory.json` |
| Canal de entrada | UI + wake word + micrófono |

Por eso ELYRA controla el PC **sin** depender de un demonio externo.

## Cómo activar OpenClaw (opcional, amplificación)

1. Instalar y arrancar el gateway:
   ```bash
   npm i -g openclaw
   openclaw gateway
   # o: openclaw gateway --daemon
   ```
2. En `%USERPROFILE%\.elyra\config.json`:
   ```json
   {
     "openclaw": {
       "enabled": true,
       "prefer": true,
       "baseUrl": "http://127.0.0.1:18789",
       "token": ""
     }
   }
   ```
3. Reiniciar ELYRA. El router prueba OpenClaw antes del LLM propio si `prefer` es true.

## Por qué ELYRA puede superar a “solo OpenClaw” en escritorio

- **UI holográfica + voz hands-free** (wake word) nativa.
- **Control Windows profundo** (volumen, brillo, capturas, power, WiFi, procesos) sin pasar por shell genérico.
- **Offline parcial**: intents locales y conocimiento smart sin gateway.
- **OpenClaw como opcional**: si el gateway está caído, ELYRA sigue operativa.

No se empaqueta OpenClaw dentro de Electron por defecto: evita conflictos de empaquetado y privilegios. El patrón correcto es **cliente** (ELYRA) → **gateway** (OpenClaw en localhost).
