/**
 * ELYRA 1.3 — permisos con diálogo nativo de Electron
 * Complementa la confirmación verbal («confirma»).
 */
const { dialog, BrowserWindow } = require('electron');

function parentWindow() {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused;
  const all = BrowserWindow.getAllWindows();
  return all.find((w) => !w.isDestroyed()) || null;
}

/**
 * Diálogo modal sí/no. Devuelve true si el usuario acepta.
 */
function confirmDestructive({ title, message, detail }) {
  try {
    const result = dialog.showMessageBoxSync(parentWindow(), {
      type: 'warning',
      buttons: ['Cancelar', 'Confirmar'],
      defaultId: 0,
      cancelId: 0,
      title: title || 'ELYRA — Confirmación',
      message: message || '¿Confirmas esta acción?',
      detail: detail || 'Esta acción puede ser irreversible.',
      noLink: true,
    });
    return result === 1;
  } catch (e) {
    console.warn('[ELYRA] permission dialog:', e.message);
    return false;
  }
}

function confirmPower(action) {
  const labels = {
    shutdown: 'apagar el equipo',
    restart: 'reiniciar el equipo',
    sleep: 'suspender el equipo',
  };
  return confirmDestructive({
    title: 'ELYRA — Energía',
    message: '¿Confirmas ' + (labels[action] || action) + '?',
    detail: 'Se ejecutará en tu PC ahora.',
  });
}

function confirmKill(processName) {
  return confirmDestructive({
    title: 'ELYRA — Cerrar proceso',
    message: '¿Cerrar «' + processName + '»?',
    detail: 'Puedes perder trabajo no guardado.',
  });
}

function confirmEmptyRecycle() {
  return confirmDestructive({
    title: 'ELYRA — Papelera',
    message: '¿Vaciar la papelera?',
    detail: 'Los archivos no se podrán recuperar fácilmente.',
  });
}

function confirmShell(command) {
  return confirmDestructive({
    title: 'ELYRA — Comando',
    message: '¿Ejecutar este comando?',
    detail: String(command || '').slice(0, 400),
  });
}

module.exports = {
  confirmDestructive,
  confirmPower,
  confirmKill,
  confirmEmptyRecycle,
  confirmShell,
};
