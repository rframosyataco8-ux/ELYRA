# ELYRA Permissions (1.3)

## Capas de seguridad

1. **Blocklist** — comandos nunca permitidos (`rm -rf /`, format, diskpart…)
2. **Procesos críticos** — no se pueden matar (explorer, winlogon…)
3. **Confirmación verbal** — «confirma», «hazlo ya», etc.
4. **Diálogo nativo (1.3)** — ventana Windows/macOS Sí/Cancelar

## Acciones que piden confirmación

- Apagar / reiniciar
- Cerrar proceso
- Vaciar papelera
- Shell agresivo (del, rmdir, remove-item…)

## Preferencia

Si dices «confirma apagar», no hace falta el diálogo.
Si no lo dices, aparece el diálogo nativo (cuando Electron está disponible).
