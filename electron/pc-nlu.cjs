/**
 * PC NLU 1.9.1 — lenguaje natural → acciones de control del PC
 * Cubre muchas formas de pedir lo mismo en español.
 */

function n(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @returns {Promise<{response:string,intelligent?:boolean,via?:string}|null>}
 */
async function tryPcNlu(text, helpers, pc, getSystemStats) {
  const t = n(text);
  if (!t || t.length < 2) return null;

  // —— Volumen ——
  if (/\b(sube|subir|aumenta|alza)\b.*\bvolumen\b|\bvolumen\b.*\b(sube|alto|mas)\b/.test(t)) {
    const r = await pc.volume('up');
    return { response: r.result || 'Subí el volumen.', via: 'pc-nlu-vol' };
  }
  if (/\b(baja|bajar|reduce|quita)\b.*\bvolumen\b|\bvolumen\b.*\b(bajo|menos)\b/.test(t)) {
    const r = await pc.volume('down');
    return { response: r.result || 'Bajé el volumen.', via: 'pc-nlu-vol' };
  }
  if (/\b(silencia|mute|enmudece|quita el sonido|sin sonido)\b/.test(t)) {
    const r = await pc.volume('mute');
    return { response: r.result || 'Silencio.', via: 'pc-nlu-mute' };
  }
  const volSet = t.match(/\bvolumen\s+(?:al\s+)?(\d{1,3})\s*%?/);
  if (volSet) {
    const r = await pc.volume('set', volSet[1]);
    return { response: r.result || 'Volumen ajustado.', via: 'pc-nlu-vol-set' };
  }

  // —— Brillo ——
  if (/\b(sube|subir|aumenta)\b.*\bbrillo\b|\bbrillo\b.*\b(sube|mas)\b/.test(t)) {
    const r = await pc.brightness('up');
    return { response: r.result || 'Subí el brillo.', via: 'pc-nlu-bri' };
  }
  if (/\b(baja|bajar|reduce)\b.*\bbrillo\b|\bbrillo\b.*\b(bajo|menos)\b/.test(t)) {
    const r = await pc.brightness('down');
    return { response: r.result || 'Bajé el brillo.', via: 'pc-nlu-bri' };
  }
  const briSet = t.match(/\bbrillo\s+(?:al\s+)?(\d{1,3})\s*%?/);
  if (briSet) {
    const r = await pc.brightness('set', briSet[1]);
    return { response: r.result || 'Brillo ajustado.', via: 'pc-nlu-bri-set' };
  }

  // —— Multimedia ——
  if (/\b(pausa|pausar|play|reproduce|reproducir|continua la musica|continua el video)\b/.test(t)) {
    const r = await pc.media('play/pause');
    return { response: r.result || 'Play/pausa.', via: 'pc-nlu-media' };
  }
  if (/\b(siguiente cancion|siguiente pista|next track|salta cancion)\b/.test(t)) {
    const r = await pc.media('next');
    return { response: r.result || 'Siguiente.', via: 'pc-nlu-media' };
  }
  if (/\b(anterior cancion|pista anterior|previous)\b/.test(t)) {
    const r = await pc.media('prev');
    return { response: r.result || 'Anterior.', via: 'pc-nlu-media' };
  }

  // —— Captura / pantalla ——
  if (/\b(captura|screenshot|captura de pantalla|haz una captura|toma una captura)\b/.test(t)) {
    const r = await pc.screenshot();
    return { response: r.result || 'Captura lista.', via: 'pc-nlu-shot' };
  }
  if (/\b(apaga la pantalla|pantalla off|screen off)\b/.test(t)) {
    const r = await pc.windows('screen_off');
    return { response: r.result || 'Pantalla apagada.', via: 'pc-nlu-screen' };
  }
  if (/\b(bloquea|bloquear)\b.*\b(sesion|pc|pantalla|equipo)\b|\bbloquea el pc\b/.test(t)) {
    const r = await pc.windows('lock');
    return { response: r.result || 'Sesión bloqueada.', via: 'pc-nlu-lock' };
  }
  if (/\b(minimiza|minimizar)\b.*\b(todas|ventanas|todo)\b|\bmostrar escritorio\b|\bve al escritorio\b/.test(t)) {
    const r = await pc.windows('minimize_all');
    return { response: r.result || 'Escritorio.', via: 'pc-nlu-desk' };
  }

  // —— Power ——
  if (/\b(cancela|cancelar)\b.*\b(apagado|reinicio|shutdown)\b|\bcancela el apagado\b/.test(t)) {
    const r = await pc.power('cancel');
    return { response: r.result || 'Cancelado.', via: 'pc-nlu-power' };
  }
  if (/\b(apaga|apagar)\b.*\b(pc|equipo|computadora|ordenador)\b/.test(t) && !/pantalla/.test(t)) {
    const r = await pc.power('shutdown', 0);
    return { response: r.result || 'Apagando…', via: 'pc-nlu-power' };
  }
  if (/\b(reinicia|reiniciar)\b.*\b(pc|equipo)?\b/.test(t) && !/explorador/.test(t)) {
    const r = await pc.power('restart', 0);
    return { response: r.result || 'Reiniciando…', via: 'pc-nlu-power' };
  }
  if (/\b(suspende|suspender|duerme|modo sleep|a dormir)\b/.test(t)) {
    const r = await pc.power('sleep');
    return { response: r.result || 'Suspendiendo…', via: 'pc-nlu-power' };
  }

  // —— Sistema / info ——
  if (/\b(estado del sistema|como esta el pc|cómo está el pc|diagnostico|diagnóstico|rendimiento)\b/.test(t)) {
    try {
      const s = getSystemStats ? await getSystemStats() : null;
      if (s) {
        return {
          response:
            'CPU ' + s.cpu + '%, RAM ' + s.ram + '%, disco ' + s.disk + '%. Equipo ' + (s.hostname || '') + '.',
          via: 'pc-nlu-stats',
          intelligent: true,
        };
      }
    } catch {}
  }
  if (/\b(bateria|batería)\b/.test(t)) {
    const r = await pc.battery();
    return { response: r.result || 'Sin datos de batería.', via: 'pc-nlu-bat' };
  }
  if (/\b(espacio en disco|disco libre|cuanto disco|cuánto disco)\b/.test(t)) {
    const r = await pc.systemExtras('disk_space');
    return { response: (r.result || '').slice(0, 500) || 'Sin datos de disco.', via: 'pc-nlu-disk' };
  }
  if (/\b(cuanto tiempo encendido|uptime|desde cuando esta encendido)\b/.test(t)) {
    const r = await pc.systemExtras('uptime');
    return { response: r.result || 'Sin dato.', via: 'pc-nlu-up' };
  }
  if (/\b(red|network|ip|wifi status|estado (del )?wifi|estado de la red)\b/.test(t) && !/activa|desactiva/.test(t)) {
    if (/wifi/.test(t) && pc.wifiStatus) {
      const r = await pc.wifiStatus();
      return { response: (r.result || '').slice(0, 400), via: 'pc-nlu-wifi' };
    }
    const r = await pc.networkInfo();
    return { response: (r.result || '').slice(0, 500), via: 'pc-nlu-net' };
  }
  if (/\b(activa|activar|enciende)\b.*\bwifi\b/.test(t)) {
    const r = await pc.setWifi(true);
    return { response: r.result || 'WiFi on.', via: 'pc-nlu-wifi' };
  }
  if (/\b(desactiva|desactivar|apaga)\b.*\bwifi\b/.test(t)) {
    const r = await pc.setWifi(false);
    return { response: r.result || 'WiFi off.', via: 'pc-nlu-wifi' };
  }
  if (/\b(flush dns|limpia dns|vacía dns|vacia dns)\b/.test(t)) {
    const r = await pc.flushDns();
    return { response: r.result || 'DNS limpio.', via: 'pc-nlu-dns' };
  }
  if (/\b(limpia|limpiar)\b.*\btemporales\b|\bvacia temporales\b/.test(t)) {
    const r = await pc.emptyTemp();
    return { response: r.result || 'Temporales limpios.', via: 'pc-nlu-temp' };
  }
  if (/\b(vacia|vacía|vaciar)\b.*\bpapelera\b/.test(t)) {
    const r = await pc.emptyRecycle();
    return { response: r.result || 'Papelera vacía.', via: 'pc-nlu-bin' };
  }

  // —— Procesos / ventanas ——
  if (/\b(administrador de tareas|task manager|gestor de tareas)\b/.test(t)) {
    const r = await pc.openTaskManager();
    return { response: r.result || 'Task Manager.', via: 'pc-nlu-tm' };
  }
  if (/\b(que ventanas|qué ventanas|ventanas abiertas|lista de ventanas)\b/.test(t)) {
    const r = await (pc.listWindows ? pc.listWindows() : pc.windows('list'));
    return { response: (r.result || '').slice(0, 600) || 'Sin ventanas.', via: 'pc-nlu-wins' };
  }
  if (/\b(procesos|que procesos|qué procesos|procesos pesados)\b/.test(t)) {
    const r = await pc.listProcesses();
    return { response: (r.result || '').slice(0, 800), via: 'pc-nlu-proc' };
  }
  const killM = t.match(/\b(?:cierra|cerrar|mata|mata el proceso|cierra el proceso)\s+(?:la\s+|el\s+)?([a-z0-9._-]{2,40})/);
  if (killM && !/ventana|sesion|pc|equipo/.test(killM[1])) {
    const r = await pc.killProcess(killM[1]);
    return { response: r.result || 'Listo.', via: 'pc-nlu-kill' };
  }
  const focusM = t.match(/\b(?:enfoca|activa|trae|pon al frente)\s+(?:la\s+|el\s+)?(.+)/);
  if (focusM) {
    const r = await pc.windows('focus', focusM[1].trim().slice(0, 80));
    return { response: r.result || 'Ventana activada.', via: 'pc-nlu-focus' };
  }
  const closeWin = t.match(/\b(?:cierra la ventana|cerrar ventana)\s+(?:de\s+)?(.+)/);
  if (closeWin) {
    const r = await pc.windows('close', closeWin[1].trim().slice(0, 80));
    return { response: r.result || 'Ventana cerrada.', via: 'pc-nlu-close' };
  }

  // —— Ajustes Windows ——
  if (/\b(abre|abrir|abre la)\b.*\b(configuracion|configuración|ajustes|settings)\b/.test(t)) {
    let page = 'system';
    if (/wifi|red|network/.test(t)) page = 'wifi';
    else if (/bluetooth/.test(t)) page = 'bluetooth';
    else if (/pantalla|display|brillo/.test(t)) page = 'display';
    else if (/sonido|audio/.test(t)) page = 'sound';
    else if (/privacidad/.test(t)) page = 'privacy';
    else if (/actualiz/.test(t)) page = 'update';
    else if (/energia|bater/.test(t)) page = 'power';
    const r = await pc.openSettings(page);
    return { response: r.result || 'Ajustes abiertos.', via: 'pc-nlu-settings' };
  }

  // —— Portapapeles ——
  if (/\b(que hay en el portapapeles|lee el portapapeles|clipboard)\b/.test(t)) {
    const r = await pc.clipboard('read');
    return { response: (r.result || '(vacío)').slice(0, 400), via: 'pc-nlu-clip' };
  }
  if (/\b(limpia el portapapeles|borra el portapapeles)\b/.test(t)) {
    const r = await pc.clipboard('clear');
    return { response: r.result || 'Portapapeles limpio.', via: 'pc-nlu-clip' };
  }

  // —— Notificación ——
  const noti = t.match(/\b(?:notifica|avisa|muestra un aviso)\s+(.+)/);
  if (noti) {
    await pc.notify('ELYRA', noti[1].slice(0, 180));
    return { response: 'Aviso enviado.', via: 'pc-nlu-notify' };
  }

  // —— Hotkeys comunes ——
  if (/\b(copiar|copy)\b/.test(t) && t.split(' ').length <= 3) {
    await pc.input('hotkey', { keys: 'ctrl+c' });
    return { response: 'Ctrl+C enviado.', via: 'pc-nlu-hotkey' };
  }
  if (/\b(pegar|paste)\b/.test(t) && t.split(' ').length <= 3) {
    await pc.input('hotkey', { keys: 'ctrl+v' });
    return { response: 'Ctrl+V enviado.', via: 'pc-nlu-hotkey' };
  }
  if (/\b(deshacer|undo)\b/.test(t) && t.split(' ').length <= 3) {
    await pc.input('hotkey', { keys: 'ctrl+z' });
    return { response: 'Ctrl+Z enviado.', via: 'pc-nlu-hotkey' };
  }
  if (/\b(guardar|save)\b/.test(t) && /\b(archivo|documento|esto)\b/.test(t)) {
    await pc.input('hotkey', { keys: 'ctrl+s' });
    return { response: 'Ctrl+S enviado.', via: 'pc-nlu-hotkey' };
  }
  if (/\b(alt\s*tab|cambia de ventana|siguiente ventana)\b/.test(t)) {
    await pc.input('hotkey', { keys: 'alt+tab' });
    return { response: 'Alt+Tab.', via: 'pc-nlu-hotkey' };
  }

  // —— Buscar archivos ——
  const findF = t.match(
    /\b(?:busca|buscar|encuentra)\s+(?:el\s+archivo\s+|archivo\s+|el\s+)?["']?([^"']+?)["']?\s*(?:en\s+(documentos|descargas|escritorio))?$/,
  );
  if (findF && !/pdf|youtube|google|en internet|en la web/.test(t)) {
    const path = require('path');
    const os = require('os');
    const home = os.homedir();
    const rootMap = {
      documentos: path.join(home, 'Documents'),
      descargas: path.join(home, 'Downloads'),
      escritorio: path.join(home, 'Desktop'),
    };
    const root = rootMap[findF[2]] || path.join(home, 'Documents');
    const r = await pc.searchFiles(findF[1].trim(), root);
    return { response: (r.result || 'Sin resultados.').slice(0, 700), via: 'pc-nlu-find', intelligent: true };
  }

  return null;
}

module.exports = { tryPcNlu };
