# ELYRA Security (0.9)

## Controles activos

| Control | Descripción |
|---------|-------------|
| Confirmación verbal | Apagar, reiniciar, kill, papelera, shell agresivo |
| Shell blocklist | rm -rf /, format, diskpart, shutdown, etc. |
| Procesos críticos | explorer, winlogon, csrss, system… |
| Rutas | Escritura preferente bajo perfil de usuario |
| Secretos | Redacción en logs de auditoría |
| audit.log | `~/.elyra/audit.log` |

## No cubierto aún

- UI de permiso nativa por acción
- Sandbox de código arbitrario completo
- Cifrado de config.json en reposo

## Buenas prácticas

- No compartas `~/.elyra/config.json`
- Revisa `audit.log` si algo raro ocurrió
- Usa «confirma» solo cuando quieras acciones irreversibles
