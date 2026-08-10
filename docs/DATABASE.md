# ELYRA System Database (1.1)

## Ubicación

```text
~/.elyra/system/elyra-system.json
```

## Qué guarda (todo el sistema)

| Colección | Contenido |
|-----------|-----------|
| conversations | Sesiones de diálogo |
| messages | Mensajes user/assistant |
| memory_items | Hechos, preferencias, episodios |
| tool_events | Uso de herramientas |
| file_events | Archivos tocados |
| search_events | Búsquedas web/RAG |
| audit_events | Seguridad / bloqueos |
| settings_snapshots | (reservado) |

## Motor

JSON document-store versionado (**schema 1**), sin dependencia nativa.
API estable para migrar a SQLite (`better-sqlite3`) en una versión posterior sin cambiar los callers.

## Migración

Al cargar, si existe `~/.elyra/memory/cognitive.json` y aún no se migró, se importa a `memory_items` + `file_events`.

## API (Node)

```js
const db = require('./elyra-db.cjs');
db.addMessage({ role: 'user', content: 'hola' });
db.addMemoryItem({ kind: 'fact', text: '...' });
db.stats();
db.exportSnapshot();
```

## Privacidad

Todo queda en el perfil del usuario. No se sube a la nube desde este módulo.
