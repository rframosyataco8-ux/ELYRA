/**
 * Control real del PC — Windows (PowerShell) — ELYRA v2.2.1
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const PROTECTED = new Set([
  'csrss', 'smss', 'wininit', 'services', 'lsass', 'svchost', 'system',
  'registry', 'winlogon', 'dwm', 'fontdrvhost', 'sihost', 'taskhostw',
  'explorer', 'securityhealthservice', 'msmpeng', 'nissrv',
]);

async function ps(command, timeout = 15000) {
  if (process.platform !== 'win32') {
    return { ok: false, result: 'Esta funcion esta optimizada para Windows.' };
  }
  try {
    const escaped = String(command).replace(/"/g, '\\"');
    const wrapped = 'powershell -NoProfile -ExecutionPolicy Bypass -Command "' + escaped + '"';
    const { stdout, stderr } = await execAsync(wrapped, {
      timeout,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    return { ok: true, result: (stdout || stderr || 'OK').trim().slice(0, 3000) };
  } catch (e) {
    return { ok: false, result: (e.message || String(e)).slice(0, 400) };
  }
}

async function volume(action, value) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const a = (action || '').toLowerCase();
  const send = async (key) => ps('(New-Object -ComObject WScript.Shell).SendKeys([char]' + key + ')');
  if (a === 'up' || a === 'subir') {
    for (let i = 0; i < 4; i++) await send(175);
    return { ok: true, result: 'Volumen subido' };
  }
  if (a === 'down' || a === 'bajar') {
    for (let i = 0; i < 4; i++) await send(174);
    return { ok: true, result: 'Volumen bajado' };
  }
  if (a === 'mute' || a === 'silenciar') {
    await send(173);
    return { ok: true, result: 'Silencio alternado' };
  }
  if (a === 'set' || a === 'fijar') {
    const pct = Math.max(0, Math.min(100, parseInt(value, 10) || 50));
    const r = await ps(
      'try { $o = New-Object -ComObject WScript.Shell; 1..15 | ForEach-Object { $o.SendKeys([char]174) }; Start-Sleep -Milliseconds 200; $n = [math]::Round(' +
        pct +
        '/2); 1..$n | ForEach-Object { $o.SendKeys([char]175) }; \'OK\' } catch { $_.Exception.Message }',
    );
    return r.ok
      ? { ok: true, result: 'Volumen aproximado al ' + pct + '%' }
      : { ok: true, result: 'Pedido de volumen al ' + pct + '%. Ajusta con subir o bajar.' };
  }
  return { ok: false, result: 'Accion de volumen no reconocida' };
}

async function media(action) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const map = {
    play: 179, pause: 179, 'play/pause': 179,
    next: 176, siguiente: 176, prev: 177, anterior: 177,
    stop: 178,
  };
  const key = map[(action || '').toLowerCase()];
  if (!key) return { ok: false, result: 'Accion multimedia no reconocida' };
  const r = await ps('(New-Object -ComObject WScript.Shell).SendKeys([char]' + key + ')');
  return r.ok ? { ok: true, result: 'Multimedia: ' + action } : r;
}

async function brightness(action, value) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const a = (action || '').toLowerCase();
  try {
    if (a === 'up' || a === 'subir') {
      await ps(
        '$b=(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction SilentlyContinue); if(-not $b){ $b=(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods) }; $c=(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness -ErrorAction SilentlyContinue).CurrentBrightness; if(-not $c){ $c=(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness).CurrentBrightness }; $n=[Math]::Min(100,$c+10); $b.WmiSetBrightness(1,$n)',
      );
      return { ok: true, result: 'Brillo subido' };
    }
    if (a === 'down' || a === 'bajar') {
      await ps(
        '$b=(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction SilentlyContinue); if(-not $b){ $b=(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods) }; $c=(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness -ErrorAction SilentlyContinue).CurrentBrightness; if(-not $c){ $c=(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness).CurrentBrightness }; $n=[Math]::Max(5,$c-10); $b.WmiSetBrightness(1,$n)',
      );
      return { ok: true, result: 'Brillo bajado' };
    }
    if (a === 'set' || a === 'fijar') {
      const pct = Math.max(5, Math.min(100, parseInt(value, 10) || 50));
      await ps(
        '$b=(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction SilentlyContinue); if(-not $b){ $b=(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods) }; $b.WmiSetBrightness(1,' +
          pct +
          ')',
      );
      return { ok: true, result: 'Brillo al ' + pct + '%' };
    }
  } catch {
    return { ok: false, result: 'No pude cambiar el brillo en este equipo.' };
  }
  return { ok: false, result: 'Accion de brillo no reconocida' };
}

async function clipboard(action, text) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const a = (action || '').toLowerCase();
  if (a === 'read' || a === 'leer') {
    const r = await ps('Get-Clipboard -Raw');
    return r.ok ? { ok: true, result: (r.result || '(vacio)').slice(0, 1500) } : r;
  }
  if (a === 'write' || a === 'escribir') {
    const safe = String(text || '').replace(/'/g, "''");
    const r = await ps("Set-Clipboard -Value '" + safe + "'");
    return r.ok ? { ok: true, result: 'Texto copiado al portapapeles' } : r;
  }
  if (a === 'clear' || a === 'limpiar') {
    await ps("Set-Clipboard -Value ''");
    return { ok: true, result: 'Portapapeles vacio' };
  }
  return { ok: false, result: 'Usa read, write o clear' };
}

async function screenshot() {
  const dir = path.join(os.homedir(), 'Documents', 'Informes', 'Capturas');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'captura-' + Date.now() + '.png');
  if (process.platform !== 'win32') {
    return { ok: false, result: 'Captura automatica disponible en Windows' };
  }
  const safeFile = file.replace(/'/g, "''");
  const psCmd =
    'Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; ' +
    '$b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; ' +
    '$bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; ' +
    '$g=[System.Drawing.Graphics]::FromImage($bmp); ' +
    '$g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size); ' +
    "$bmp.Save('" + safeFile + "'); $g.Dispose(); $bmp.Dispose(); Write-Output 'OK'";
  const r = await ps(psCmd, 20000);
  if (r.ok && fs.existsSync(file)) {
    return {
      ok: true,
      result: 'Captura guardada como ' + path.basename(file) + ' en Documentos/Informes/Capturas',
    };
  }
  return { ok: false, result: r.result || 'No se pudo capturar' };
}

async function listProcesses() {
  if (process.platform !== 'win32') {
    return { ok: true, result: 'Listado detallado disponible en Windows' };
  }
  const r = await ps(
    'Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 15 Name,@{N=\'MB\';E={[math]::Round($_.WorkingSet64/1MB,1)}} | Format-Table -AutoSize | Out-String',
  );
  return r.ok ? { ok: true, result: r.result.slice(0, 1800) } : r;
}

async function killProcess(name) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const n = String(name || '').replace(/\.exe$/i, '').trim().toLowerCase();
  if (!n) return { ok: false, result: 'Falta nombre de proceso' };
  if (PROTECTED.has(n)) {
    return { ok: false, result: 'No puedo cerrar "' + n + '": esta protegido por seguridad.' };
  }
  const safe = n.replace(/'/g, "''");
  const r = await ps("Stop-Process -Name '" + safe + "' -Force -ErrorAction SilentlyContinue; Write-Output 'cerrado'");
  return r.ok ? { ok: true, result: 'Proceso ' + n + ' cerrado (si estaba en ejecucion)' } : r;
}

async function windows(action) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const a = (action || '').toLowerCase();
  if (a === 'minimize_all' || a === 'minimizar') {
    await ps('(New-Object -ComObject Shell.Application).ToggleDesktop()');
    return { ok: true, result: 'Escritorio mostrado / ventanas minimizadas' };
  }
  if (a === 'lock' || a === 'bloquear') {
    await ps('rundll32.exe user32.dll,LockWorkStation');
    return { ok: true, result: 'Sesion bloqueada' };
  }
  if (a === 'screen_off' || a === 'pantalla_off') {
    await ps(
      'Add-Type -TypeDefinition \'using System;using System.Runtime.InteropServices;public class S{[DllImport("user32.dll")]public static extern int SendMessage(int h,int m,int w,int l);}\'; [S]::SendMessage(-1,0x0112,0xF170,2)',
    );
    return { ok: true, result: 'Pantalla apagada' };
  }
  if (a === 'task_view' || a === 'vista_tareas') {
    await ps("$w = New-Object -ComObject WScript.Shell; $w.SendKeys('^{ESC}')");
    return { ok: true, result: 'Vista de tareas solicitada' };
  }
  return { ok: false, result: 'Accion de ventana no reconocida' };
}

async function input(action, payload = {}) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const a = (action || '').toLowerCase();
  if (a === 'type' || a === 'escribir') {
    const text = String(payload.text || '').replace(/[+^%~(){}\[\]]/g, '{$&}').replace(/'/g, "''");
    const r = await ps("(New-Object -ComObject WScript.Shell).SendKeys('" + text + "')");
    return r.ok ? { ok: true, result: 'Texto enviado a la ventana activa' } : r;
  }
  if (a === 'click') {
    const r = await ps(
      'Add-Type -MemberDefinition \'[DllImport("user32.dll")] public static extern void mouse_event(int f,int x,int y,int d,int e);\' -Name U -Namespace W; [W.U]::mouse_event(0x02,0,0,0,0); [W.U]::mouse_event(0x04,0,0,0,0)',
    );
    return r.ok ? { ok: true, result: 'Clic realizado' } : r;
  }
  if (a === 'enter') {
    await ps("(New-Object -ComObject WScript.Shell).SendKeys('{ENTER}')");
    return { ok: true, result: 'Enter enviado' };
  }
  if (a === 'escape' || a === 'esc') {
    await ps("(New-Object -ComObject WScript.Shell).SendKeys('{ESC}')");
    return { ok: true, result: 'Escape enviado' };
  }
  return { ok: false, result: 'Accion de input no reconocida' };
}

async function notify(title, message) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const t = String(title || 'ELYRA').replace(/'/g, "''").slice(0, 80);
  const m = String(message || '').replace(/'/g, "''").slice(0, 200);
  const r = await ps(
    "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('" +
      m +
      "','" +
      t +
      "') | Out-Null; Write-Output 'MSG'",
    10000,
  );
  return r.ok ? { ok: true, result: 'Notificacion enviada' } : { ok: true, result: 'Aviso mostrado' };
}

async function battery() {
  if (process.platform !== 'win32') {
    return { ok: true, result: 'SO: ' + os.platform() };
  }
  const r = await ps(
    "$b = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue; if(-not $b){ 'Sin bateria (equipo de escritorio o no detectada)' } else { $s = switch($b.BatteryStatus){1{'Desconectada'}2{'Cargando'}3{'Descargando'} default{'Estado ' + $b.BatteryStatus}}; 'Bateria ' + $b.EstimatedChargeRemaining + '% - ' + $s }",
  );
  return r.ok ? { ok: true, result: r.result } : r;
}

async function networkInfo() {
  if (process.platform !== 'win32') {
    return { ok: true, result: 'Hostname ' + os.hostname() };
  }
  const cmd =
    "$w = Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | Select-Object -First 3 Name,LinkSpeed,MacAddress | Format-Table -AutoSize | Out-String; " +
    "$ip = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 3 IPAddress,InterfaceAlias | Format-Table -AutoSize | Out-String; " +
    "Write-Output ('Adaptadores: ' + $w + ' IPs: ' + $ip)";
  const r = await ps(cmd);
  return r.ok ? { ok: true, result: r.result.slice(0, 1500) } : r;
}

async function emptyRecycle() {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const r = await ps(
    "Clear-RecycleBin -Force -ErrorAction SilentlyContinue; Write-Output 'Papelera vaciada'",
  );
  return r.ok ? { ok: true, result: 'Papelera de reciclaje vaciada' } : r;
}

async function openSettings(page) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const map = {
    system: 'ms-settings:about',
    about: 'ms-settings:about',
    display: 'ms-settings:display',
    pantalla: 'ms-settings:display',
    sound: 'ms-settings:sound',
    sonido: 'ms-settings:sound',
    network: 'ms-settings:network',
    red: 'ms-settings:network',
    wifi: 'ms-settings:network-wifi',
    bluetooth: 'ms-settings:bluetooth',
    privacy: 'ms-settings:privacy',
    privacidad: 'ms-settings:privacy',
    apps: 'ms-settings:appsfeatures',
    update: 'ms-settings:windowsupdate',
    actualizaciones: 'ms-settings:windowsupdate',
    power: 'ms-settings:powersleep',
    energia: 'ms-settings:powersleep',
    personalization: 'ms-settings:personalization',
    time: 'ms-settings:dateandtime',
    fecha: 'ms-settings:dateandtime',
  };
  const key = String(page || 'system').toLowerCase().trim();
  const uri = map[key] || (key.startsWith('ms-settings:') ? key : 'ms-settings:about');
  const r = await ps("Start-Process '" + uri + "'");
  return r.ok ? { ok: true, result: 'Ajustes abiertos (' + key + ')' } : r;
}

async function searchFiles(query, root) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const q = String(query || '').replace(/'/g, "''").slice(0, 80);
  if (!q) return { ok: false, result: 'Falta termino de busqueda' };
  const base = root ? String(root) : path.join(os.homedir(), 'Documents');
  const safeBase = base.replace(/'/g, "''");
  const r = await ps(
    "Get-ChildItem -Path '" +
      safeBase +
      "' -Recurse -ErrorAction SilentlyContinue -Filter '*" +
      q +
      "*' | Select-Object -First 15 FullName | ForEach-Object { $_.FullName } | Out-String",
    25000,
  );
  if (!r.ok) return r;
  const lines = (r.result || '').trim();
  if (!lines) return { ok: true, result: 'Sin resultados para "' + query + '" en Documentos' };
  return { ok: true, result: lines.slice(0, 2000) };
}

async function power(action, minutes) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const a = (action || '').toLowerCase();
  const delay = Math.max(0, Math.min(120, parseInt(minutes, 10) || 0));
  const seconds = delay * 60 || 30;
  if (a === 'cancel' || a === 'cancelar') {
    await execAsync('shutdown /a', { windowsHide: true }).catch(() => {});
    return { ok: true, result: 'Apagado o reinicio cancelado' };
  }
  if (a === 'shutdown' || a === 'apagar') {
    await execAsync('shutdown /s /t ' + seconds, { windowsHide: true });
    return {
      ok: true,
      result:
        'Apagado programado en ' +
        (Math.round(seconds / 60) || 0) +
        ' min (o ' +
        seconds +
        's). Di cancelar apagado para abortar.',
    };
  }
  if (a === 'restart' || a === 'reiniciar') {
    await execAsync('shutdown /r /t ' + seconds, { windowsHide: true });
    return {
      ok: true,
      result:
        'Reinicio programado en ' +
        (Math.round(seconds / 60) || 0) +
        ' min. Di cancelar apagado para abortar.',
    };
  }
  if (a === 'sleep' || a === 'suspender') {
    await ps(
      'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend,$false,$false)',
    );
    return { ok: true, result: 'Suspension solicitada' };
  }
  return { ok: false, result: 'Usa shutdown, restart, sleep o cancel' };
}

async function systemExtras(action) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const a = (action || '').toLowerCase();
  if (a === 'uptime') {
    const r = await ps(
      "$u = (Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime; 'Encendido desde hace ' + $u.Days + 'd ' + $u.Hours + 'h ' + $u.Minutes + 'm'",
    );
    return r.ok ? { ok: true, result: r.result } : r;
  }
  if (a === 'disk_space' || a === 'disco') {
    const r = await ps(
      'Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N="LibreGB";E={[math]::Round($_.Free/1GB,1)}}, @{N="UsadoGB";E={[math]::Round(($_.Used)/1GB,1)}} | Format-Table -AutoSize | Out-String',
    );
    return r.ok ? { ok: true, result: r.result.slice(0, 800) } : r;
  }
  return { ok: false, result: 'Accion no reconocida' };
}

module.exports = {
  volume,
  media,
  brightness,
  clipboard,
  screenshot,
  listProcesses,
  killProcess,
  windows,
  input,
  notify,
  battery,
  networkInfo,
  emptyRecycle,
  openSettings,
  searchFiles,
  power,
  systemExtras,
};
