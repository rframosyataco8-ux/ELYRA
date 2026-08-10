# ELYRA_EVAL (0.9)

## Ejecutar

Desde la raíz del repo:

```bash
node -e "console.log(JSON.stringify(require('./electron/elyra-eval.cjs').runEval(),null,2))"
```

O al arrancar Electron: el smoke ya carga módulos; el eval completo es bajo demanda.

## Qué cubre (offline)

- Versión y capabilities
- Carga de módulos críticos
- Permisos (power, shell, procesos críticos)
- Files / RAG / memory / vision (carga, no llamadas de pago)
- Redacción de secretos y rutas seguras

## Resultado

`ok: true` si todos los tests pasan. `failures` lista los que fallan.
