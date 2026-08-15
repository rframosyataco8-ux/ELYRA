# Alias `@/` — baseUrl, paths y Vite

## Estado actual (recomendado)

| Capa | Configuración |
|------|----------------|
| **TypeScript** (`tsconfig.app.json`) | `baseUrl: "."` + `paths: { "@/*": ["src/*"] }` + `ignoreDeprecations: "6.0"` |
| **Vite** (`vite.config.ts`) | `resolve.alias['@']` → carpeta `src` |

Así funcionan imports como:

```ts
import { PageTransition } from '@/components/PageTransition';
```

## ¿Por qué sigue existiendo `baseUrl`?

En TypeScript 6.x, `baseUrl` está **deprecado** de cara a TS 7, pero:

1. Los `paths` del compilador **siguen necesitando** un ancla (`baseUrl`) en la práctica actual.
2. Vite **no usa** `baseUrl`: resuelve `@` por su propio `alias`.
3. Quitar `baseUrl` sin otra estrategia rompe el autocompletado y `tsc`.

Por eso se usa:

```json
"ignoreDeprecations": "6.0"
```

Eso elimina el aviso del panel Problems **sin cambiar imports** ni romper el build.

## Migración futura (cuando pase a TS 7)

Opciones reales (aún no necesarias):

1. **Mantener Vite alias** y, si TS 7 ofrece resolución de `paths` sin `baseUrl`, adaptar solo `tsconfig`.
2. **`package.json#imports`** (Node subpath imports), por ejemplo `#/*` → `./src/*`, y migrar `@/` → `#/` (cambio grande en todo el repo).
3. **Imports relativos** (no recomendado en apps medianas).

Hasta que TypeScript 7 esté estable en el toolchain de Vite, **no migres fuera de `baseUrl` + `paths` + alias de Vite**.

## Comprobar que el alias funciona

```powershell
npm run typecheck
npm run dev
```

Si VS Code marca mal `@/`,: **TypeScript: Select TypeScript Version → Use Workspace Version** y reinicia el TS Server.
