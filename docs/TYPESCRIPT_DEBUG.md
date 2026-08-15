# Depuración de errores TypeScript — ELYRA

## 1. Comprobar tipos sin arrancar la app

En la raíz del proyecto:

```powershell
npm run typecheck
```

Modo continuo (se re-ejecuta al guardar):

```powershell
npm run typecheck:watch
```

Esto usa `tsconfig.app.json` (`strict: true`, sin emitir archivos).

## 2. Leer el mensaje de error

Ejemplo típico:

```text
src/components/PageTransition.tsx:12:5 - error TS2322:
  Type 'X' is not assignable to type 'Y'.
```

- **Archivo y línea**: dónde mirar primero.
- **TS####**: código de error (búscalo en la doc de TypeScript si hace falta).
- **Type 'X' is not assignable to type 'Y'**: el valor no coincide con el tipo esperado.

## 3. Errores frecuentes en este repo

| Síntoma | Causa habitual | Qué hacer |
|--------|----------------|-----------|
| `Cannot find module '@/…'` | Alias `@` / Vite | Revisa `tsconfig.app.json` → `paths` y `vite.config` |
| `Property 'elyra' does not exist on Window` | Tipos del preload | Revisa `src/vite-env.d.ts` o declaraciones de `window.elyra` |
| `Module '"framer-motion"' has no exported member '…'` | Versión o import | `npm install` y usa imports oficiales de FM 11 |
| `"@react-spring/web"` no encontrado | Dependencia no instalada | `npm install` tras `git pull` |
| Error en `motion` con LazyMotion strict | `strict` exige componente `m` | En ELYRA `strict` está **desactivado** a propósito |
| Tipos de React rotos tras actualizar | Cache / lock | Borra `node_modules` y reinstala (ver abajo) |

## 4. En VS Code / Cursor

1. Abre la paleta: `Ctrl+Shift+P`.
2. Ejecuta **“TypeScript: Select TypeScript Version”** → **Use Workspace Version**.
3. Si el editor se queda con errores fantasma: **“TypeScript: Restart TS Server”**.
4. Asegúrate de abrir la **carpeta raíz** del repo (donde está `package.json`), no un subdirectorio.

## 5. Reinstalación limpia (si todo falla)

```powershell
cd C:\ASISTENTE\ELYRA-nuevo
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm install
npm run typecheck
npm run dev:electron
```

## 6. Qué no hacer

- No uses `// @ts-ignore` ni `any` por sistema salvo un caso puntual y comentado.
- No ejecutes `npm audit fix --force`: puede romper Electron.
- No cambies `strict: false` en `tsconfig` para “ocultar” errores; corrígelos.

## 7. Flujo recomendado al tocar UI / motion

```powershell
git pull origin main
npm install
npm run typecheck
npm run dev:electron
```

Si `typecheck` pasa y la app arranca, los tipos están bien aunque el editor aún no se haya actualizado (reinicia el TS Server).
