# Depuración de errores TypeScript — ELYRA

## Diagnóstico rápido (agosto 2026)

En CI / CLI el proyecto está **limpio**:

```bash
npm run typecheck   # 0 errores
npm run lint        # 0 errores (solo warnings menores)
npm run build       # OK
```

Si el **editor** muestra cientos o miles de errores (`Cannot find module '@/…'`, tipos rotos, etc.):

1. Abre la **raíz del repo** (donde está `package.json`), no un subcarpeta.
2. `npm install`
3. `Ctrl+Shift+P` → **TypeScript: Select TypeScript Version** → **Use Workspace Version**
4. `Ctrl+Shift+P` → **TypeScript: Restart TS Server**
5. Confirma que `tsconfig.app.json` tiene `"baseUrl": "."` y `paths` `@/*`

Sin `baseUrl`, algunos language services no resuelven el alias `@/` y cada import genera un error (eso multiplica el contador).

## 1. Comprobar tipos sin arrancar la app

```powershell
npm run typecheck
npm run typecheck:watch
```

Usa `tsconfig.app.json` (`strict: true`, sin emitir archivos). Solo incluye `src/` (no `electron/`).

## 2. Leer el mensaje de error

```text
src/components/PageTransition.tsx:12:5 - error TS2322:
  Type 'X' is not assignable to type 'Y'.
```

- **Archivo y línea**: dónde mirar primero.
- **TS####**: código de error.
- **Type 'X' is not assignable to type 'Y'**: valor vs tipo esperado.

## 3. Errores frecuentes en este repo

| Síntoma | Causa habitual | Qué hacer |
|--------|----------------|-----------|
| `Cannot find module '@/…'` | Alias `@` / IDE sin baseUrl o sin `npm install` | `baseUrl` + paths en tsconfig; reinicia TS Server |
| `Property 'elyra' does not exist on Window` | Tipos del preload | `src/vite-env.d.ts` |
| Miles de errores en Problems | node_modules / carpeta mal abierta | Abre raíz del repo; excluye node_modules |
| `Module '"framer-motion"' has no exported member` | Dependencia | `npm install` |
| Tipos React rotos tras actualizar | Cache | Borra `node_modules` y reinstala |

## 4. En VS Code / Cursor

1. `Ctrl+Shift+P` → **TypeScript: Select TypeScript Version** → Workspace.
2. Si hay errores fantasma: **TypeScript: Restart TS Server**.
3. Carpeta raíz del repo (con `package.json`).

## 5. Reinstalación limpia

```powershell
cd C:\ruta\a\ELYRA
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm install
npm run typecheck
npm run lint
npm run dev:electron
```

## 6. Qué no hacer

- No uses `// @ts-ignore` ni `any` por sistema.
- No ejecutes `npm audit fix --force` (rompe Electron).
- No pongas `strict: false` para ocultar errores.

## 7. Flujo recomendado

```powershell
git pull origin main
npm install
npm run typecheck
npm run dev:electron
```

Si `typecheck` pasa y la app arranca, los tipos están bien aunque el editor aún no se haya actualizado.
