# Integración aplicada en commits recientes

## Configuración requerida (seguridad)
La API key YA NO va en el código. En tu PC crea o edita:

`%USERPROFILE%\.elyra\config.json`

```json
{
  "apiKey": "gsk_TU_CLAVE_AQUI",
  "baseUrl": "https://api.groq.com/openai/v1",
  "model": "llama-3.1-8b-instant"
}
```

O variable de entorno: `GROQ_API_KEY`

## Archivos nuevos / clave
- electron/pc-control.cjs — volumen, media, brillo, clipboard, captura, procesos, ventanas, input
- electron/agent.cjs — sin key hardcodeada + escalado de modelo + tools PC
- NetworkGlobe amplitude prop

## Atajos
- Ctrl+Shift+E — mostrar/ocultar
- Ctrl+Space — interrumpir voz (barge-in) cuando esté cableado en main

## Actualizar local
```bash
cd ~/proyectos/jarvis
git pull
# asegura config con apiKey
npm run dev:electron
```
