/**
 * Control real del PC — Windows — ELYRA Autonomous Core
 * Mouse, teclado, shell, ventanas, sistema.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/* Solo procesos que al matarlos dejan el SO inutilizable de inmediato */
const PROTECTED = new Set([
  'csrss', 'smss', 'wininit', 'services', 'lsass', 'system', 'registry', 'winlogon',
]);

async function ps(command, timeout = 20000) {
  if (process.platform !== 'win32') {
    return { ok: false, result: 'Optimizado para Windows.' };
  }
  try {
    const escaped = String(command).replace(/"/g, '\\"');
    const wrapped = 'powershell -NoProfile -ExecutionPolicy Bypass -Command "' + escaped + '"';
    const { stdout, stderr } = await execAsync(wrapped, {
      timeout,
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024,
    });
    return { ok: true, result: (stdout || stderr || 'OK').trim().slice(0, 8000) };
  } catch (e) {
    return { ok: false, result: (e.message || String(e)).slice(0, 600) };
  }
}

async function shell(command, timeout = 60000) {
  if (!command || !String(command).trim()) {
    return { ok: false, result: 'Comando vacío' };
  }
  try {
    const { stdout, stderr } = await execAsync(String(command), {
      timeout,
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024,
      shell: process.platform === 'win32' ? true : '/bin/bash',
      cwd: os.homedir(),
    });
    const out = ((stdout || '') + (stderr ? '\n' + stderr : '')).trim();
    return { ok: true, result: (out || 'OK').slice(0, 8000) };
  } catch (e) {
    const out = ((e.stdout || '') + '\n' + (e.stderr || '') + '\n' + (e.message || '')).trim();
    return { ok: false, result: out.slice(0, 8000) };
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
    await ps(
      'try { $o = New-Object -ComObject WScript.Shell; 1..15 | ForEach-Object { $o.SendKeys([char]174) }; Start-Sleep -Milliseconds 150; $n = [math]::Round(' +
        pct +
        '/2); 1..$n | ForEach-Object { $o.SendKeys([char]175) }; \'OK\' } catch { $_.Exception.Message }',
    );
    return { ok: true, result: 'Volumen ~' + pct + '%' };
  }
  return { ok: false, result: 'Acción de volumen no reconocida' };
}

async function media(action) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const map = {
    play: 179, pause: 179, 'play/pause': 179,
    next: 176, siguiente: 176, prev: 177, anterior: 177, stop: 178,
  };
  const key = map[(action || '').toLowerCase()];
  if (!key) return { ok: false, result: 'Acción multimedia no reconocida' };
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
  return { ok: false, result: 'Acción de brillo no reconocida' };
}

async function clipboard(action, text) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const a = (action || '').toLowerCase();
  if (a === 'read' || a === 'leer') {
    const r = await ps('Get-Clipboard -Raw');
    return r.ok ? { ok: true, result: (r.result || '(vacío)').slice(0, 4000) } : r;
  }
  if (a === 'write' || a === 'escribir') {
    const safe = String(text || '').replace(/'/g, "''");
    const r = await ps("Set-Clipboard -Value '" + safe + "'");
    return r.ok ? { ok: true, result: 'Texto copiado al portapapeles' } : r;
  }
  if (a === 'clear' || a === 'limpiar') {
    await ps("Set-Clipboard -Value ''");
    return { ok: true, result: 'Portapapeles vacío' };
  }
  return { ok: false, result: 'Usa read, write o clear' };
}

async function screenshot() {
  const dir = path.join(os.homedir(), 'Documents', 'Informes', 'Capturas');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'captura-' + Date.now() + '.png');
  if (process.platform !== 'win32') {
    return { ok: false, result: 'Captura automática disponible en Windows' };
  }
  const safeFile = file.replace(/'/g, "''");
  const psCmd =
    'Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; ' +
    '$b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; ' +
    '$bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; ' +
    '$g=[System.Drawing.Graphics]::FromImage($bmp); ' +
    '$g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size); ' +
    "$bmp.Save('" + safeFile + "'); $g.Dispose(); $bmp.Dispose(); Write-Output 'OK'";
  const r = await ps(psCmd, 25000);
  if (r.ok && fs.existsSync(file)) {
    return {
      ok: true,
      result: 'Captura guardada: ' + path.basename(file) + ' en Documentos/Informes/Capturas',
      path: file,
    };
  }
  return { ok: false, result: r.result || 'No se pudo capturar' };
}

async function listProcesses() {
  if (process.platform !== 'win32') {
    return { ok: true, result: 'Listado detallado disponible en Windows' };
  }
  const r = await ps(
    'Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 25 Name,Id,@{N=\'MB\';E={[math]::Round($_.WorkingSet64/1MB,1)}} | Format-Table -AutoSize | Out-String',
  );
  return r.ok ? { ok: true, result: r.result.slice(0, 3000) } : r;
}

async function killProcess(name) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const n = String(name || '').replace(/\.exe$/i, '').trim().toLowerCase();
  if (!n) return { ok: false, result: 'Falta nombre de proceso' };
  if (PROTECTED.has(n)) {
    return { ok: false, result: '"' + n + '" es crítico del kernel; no se cierra.' };
  }
  const safe = n.replace(/'/g, "''");
  const r = await ps("Stop-Process -Name '" + safe + "' -Force -ErrorAction SilentlyContinue; Write-Output 'cerrado'");
  return r.ok ? { ok: true, result: 'Proceso ' + n + ' cerrado' } : r;
}

async function windows(action, title) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const a = (action || '').toLowerCase();
  if (a === 'minimize_all' || a === 'minimizar') {
    await ps('(New-Object -ComObject Shell.Application).ToggleDesktop()');
    return { ok: true, result: 'Escritorio / ventanas minimizadas' };
  }
  if (a === 'lock' || a === 'bloquear') {
    await ps('rundll32.exe user32.dll,LockWorkStation');
    return { ok: true, result: 'Sesión bloqueada' };
  }
  if (a === 'screen_off' || a === 'pantalla_off') {
    await ps(
      'Add-Type -TypeDefinition \'using System;using System.Runtime.InteropServices;public class S{[DllImport("user32.dll")]public static extern int SendMessage(int h,int m,int w,int l);}\'; [S]::SendMessage(-1,0x0112,0xF170,2)',
    );
    return { ok: true, result: 'Pantalla apagada' };
  }
  if (a === 'list' || a === 'listar') {
    const r = await ps(
      "Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object -First 30 ProcessName, Id, MainWindowTitle | Format-Table -AutoSize | Out-String",
    );
    return r.ok ? { ok: true, result: (r.result || '').slice(0, 3000) } : r;
  }
  if (a === 'focus' || a === 'activar') {
    const t = String(title || '').replace(/'/g, "''").slice(0, 120);
    if (!t) return { ok: false, result: 'Falta título o nombre de ventana' };
    const r = await ps(
      "$p = Get-Process | Where-Object { $_.MainWindowTitle -like '*" +
        t +
        "*' -or $_.ProcessName -like '*" +
        t +
        "*' } | Select-Object -First 1; if(-not $p){ Write-Output 'NO'; exit 0 }; " +
        "Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class W{[DllImport(\"user32.dll\")]public static extern bool SetForegroundWindow(IntPtr h);[DllImport(\"user32.dll\")]public static extern bool ShowWindow(IntPtr h,int n);}'; " +
        "[W]::ShowWindow($p.MainWindowHandle,9); [W]::SetForegroundWindow($p.MainWindowHandle); Write-Output ('FOCUSED ' + $p.ProcessName + ' ' + $p.MainWindowTitle)",
    );
    if (!r.ok) return r;
    if (/^NO\b/.test(r.result || '')) return { ok: false, result: 'No encontré ventana: ' + title };
    return { ok: true, result: r.result };
  }
  if (a === 'close' || a === 'cerrar') {
    const t = String(title || '').replace(/'/g, "''").slice(0, 120);
    if (!t) return { ok: false, result: 'Falta título' };
    const r = await ps(
      "Get-Process | Where-Object { $_.MainWindowTitle -like '*" +
        t +
        "*' } | ForEach-Object { $_.CloseMainWindow() | Out-Null; Start-Sleep -Milliseconds 200; if(-not $_.HasExited){ Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } }; Write-Output 'closed'",
    );
    return r.ok ? { ok: true, result: 'Ventana cerrada: ' + title } : r;
  }
  return { ok: false, result: 'Acción de ventana no reconocida' };
}

/**
 * input: type | click | dblclick | rightclick | move | enter | escape | hotkey | key
 * payload: text, x, y, keys (array o string "ctrl+s")
 */
async function input(action, payload = {}) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const a = (action || '').toLowerCase();
  const x = parseInt(payload.x, 10);
  const y = parseInt(payload.y, 10);

  const moveCursorPs =
    'Add-Type -MemberDefinition \'[DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);[DllImport("user32.dll")] public static extern void mouse_event(int f,int dx,int dy,int d,int e);\' -Name M -Namespace U -ErrorAction SilentlyContinue; ';

  if (a === 'move' || a === 'mover') {
    if (Number.isNaN(x) || Number.isNaN(y)) return { ok: false, result: 'Faltan x,y' };
    const r = await ps(moveCursorPs + '[U.M]::SetCursorPos(' + x + ',' + y + '); Write-Output "moved"');
    return r.ok ? { ok: true, result: 'Cursor en ' + x + ',' + y } : r;
  }

  if (a === 'click' || a === 'clic' || a === 'dblclick' || a === 'rightclick' || a === 'clic_derecho') {
    let prep = moveCursorPs;
    if (!Number.isNaN(x) && !Number.isNaN(y)) {
      prep += '[U.M]::SetCursorPos(' + x + ',' + y + '); Start-Sleep -Milliseconds 40; ';
    }
    if (a === 'dblclick') {
      prep +=
        '[U.M]::mouse_event(0x02,0,0,0,0); [U.M]::mouse_event(0x04,0,0,0,0); Start-Sleep -Milliseconds 50; [U.M]::mouse_event(0x02,0,0,0,0); [U.M]::mouse_event(0x04,0,0,0,0);';
    } else if (a === 'rightclick' || a === 'clic_derecho') {
      prep += '[U.M]::mouse_event(0x08,0,0,0,0); [U.M]::mouse_event(0x10,0,0,0,0);';
    } else {
      prep += '[U.M]::mouse_event(0x02,0,0,0,0); [U.M]::mouse_event(0x04,0,0,0,0);';
    }
    prep += ' Write-Output "click"';
    const r = await ps(prep);
    return r.ok
      ? {
          ok: true,
          result:
            a +
            (!Number.isNaN(x) ? ' @' + x + ',' + y : ' (posición actual)'),
        }
      : r;
  }

  if (a === 'type' || a === 'escribir') {
    const text = String(payload.text || '')
      .replace(/[+^%~(){}\[\]]/g, '{$&}')
      .replace(/'/g, "''");
    const r = await ps("(New-Object -ComObject WScript.Shell).SendKeys('" + text + "')");
    return r.ok ? { ok: true, result: 'Texto enviado (' + String(payload.text || '').length + ' chars)' } : r;
  }

  if (a === 'enter') {
    await ps("(New-Object -ComObject WScript.Shell).SendKeys('{ENTER}')");
    return { ok: true, result: 'Enter' };
  }
  if (a === 'escape' || a === 'esc') {
    await ps("(New-Object -ComObject WScript.Shell).SendKeys('{ESC}')");
    return { ok: true, result: 'Escape' };
  }
  if (a === 'tab') {
    await ps("(New-Object -ComObject WScript.Shell).SendKeys('{TAB}')");
    return { ok: true, result: 'Tab' };
  }
  if (a === 'backspace') {
    await ps("(New-Object -ComObject WScript.Shell).SendKeys('{BACKSPACE}')");
    return { ok: true, result: 'Backspace' };
  }

  if (a === 'hotkey' || a === 'key' || a === 'tecla') {
    let keys = payload.keys || payload.key || payload.text || '';
    if (Array.isArray(keys)) keys = keys.join('+');
    keys = String(keys).toLowerCase().trim();
    if (!keys) return { ok: false, result: 'Faltan teclas' };
    const parts = keys.split(/[+\s]+/).filter(Boolean);
    const map = {
      ctrl: '^', control: '^', alt: '%', shift: '+', win: '^{ESC}',
      enter: '{ENTER}', tab: '{TAB}', esc: '{ESC}', escape: '{ESC}',
      backspace: '{BACKSPACE}', delete: '{DELETE}', del: '{DELETE}',
      up: '{UP}', down: '{DOWN}', left: '{LEFT}', right: '{RIGHT}',
      home: '{HOME}', end: '{END}', pgup: '{PGUP}', pgdn: '{PGDN}',
      f1: '{F1}', f2: '{F2}', f3: '{F3}', f4: '{F4}', f5: '{F5}',
      f6: '{F6}', f7: '{F7}', f8: '{F8}', f9: '{F9}', f10: '{F10}',
      f11: '{F11}', f12: '{F12}', space: ' ',
    };
    let seq = '';
    const mods = [];
    const normals = [];
    for (const p of parts) {
      if (['ctrl', 'control', 'alt', 'shift'].includes(p)) mods.push(map[p]);
      else if (map[p]) normals.push(map[p]);
      else normals.push(p.length === 1 ? p : '{' + p.toUpperCase() + '}');
    }
    seq = mods.join('') + normals.join('');
    if (keys.includes('win') || parts.includes('win')) {
      await ps(
        'Add-Type -MemberDefinition \'[DllImport("user32.dll")] public static extern void keybd_event(byte b,byte s,uint f,int e);\' -Name K -Namespace W; [W.K]::keybd_event(0x5B,0,0,0); Start-Sleep -Milliseconds 30; [W.K]::keybd_event(0x5B,0,2,0)',
      );
      return { ok: true, result: 'Tecla Windows' };
    }
    const safe = seq.replace(/'/g, "''");
    const r = await ps("(New-Object -ComObject WScript.Shell).SendKeys('" + safe + "')");
    return r.ok ? { ok: true, result: 'Hotkey: ' + keys } : r;
  }

  return { ok: false, result: 'Acción de input no reconocida: ' + a };
}

async function notify(title, message) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const t = String(title || 'ELYRA').replace(/'/g, "''").slice(0, 80);
  const m = String(message || '').replace(/'/g, "''").slice(0, 200);
  const r = await ps(
    "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; " +
      "try { $tpl = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); " +
      "$t = $tpl.GetElementsByTagName('text'); $t.Item(0).AppendChild($tpl.CreateTextNode('" +
      t +
      "')); $t.Item(1).AppendChild($tpl.CreateTextNode('" +
      m +
      "')); $n = [Windows.UI.Notifications.ToastNotification]::new($tpl); " +
      "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('ELYRA').Show($n); 'toast' } catch { " +
      "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('" +
      m +
      "','" +
      t +
      "') | Out-Null; 'msg' }",
    12000,
  );
  return r.ok ? { ok: true, result: 'Notificación enviada' } : { ok: true, result: 'Aviso mostrado' };
}

async function battery() {
  if (process.platform !== 'win32') return { ok: true, result: 'SO: ' + os.platform() };
  const r = await ps(
    "$b = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue; if(-not $b){ 'Sin batería (escritorio o no detectada)' } else { $s = switch($b.BatteryStatus){1{'Desconectada'}2{'Cargando'}3{'Descargando'} default{'Estado ' + $b.BatteryStatus}}; 'Batería ' + $b.EstimatedChargeRemaining + '% - ' + $s }",
  );
  return r.ok ? { ok: true, result: r.result } : r;
}

async function networkInfo() {
  if (process.platform !== 'win32') return { ok: true, result: 'Hostname ' + os.hostname() };
  const cmd =
    "$w = Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | Select-Object -First 3 Name,LinkSpeed,MacAddress | Format-Table -AutoSize | Out-String; " +
    "$ip = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 3 IPAddress,InterfaceAlias | Format-Table -AutoSize | Out-String; " +
    "Write-Output ('Adaptadores: ' + $w + ' IPs: ' + $ip)";
  const r = await ps(cmd);
  return r.ok ? { ok: true, result: r.result.slice(0, 2000) } : r;
}

async function emptyRecycle() {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const r = await ps("Clear-RecycleBin -Force -ErrorAction SilentlyContinue; Write-Output 'Papelera vaciada'");
  return r.ok ? { ok: true, result: 'Papelera vaciada' } : r;
}

async function openSettings(page) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const map = {
    system: 'ms-settings:about', about: 'ms-settings:about',
    display: 'ms-settings:display', pantalla: 'ms-settings:display',
    sound: 'ms-settings:sound', sonido: 'ms-settings:sound',
    network: 'ms-settings:network', red: 'ms-settings:network',
    wifi: 'ms-settings:network-wifi', bluetooth: 'ms-settings:bluetooth',
    privacy: 'ms-settings:privacy', privacidad: 'ms-settings:privacy',
    apps: 'ms-settings:appsfeatures', update: 'ms-settings:windowsupdate',
    actualizaciones: 'ms-settings:windowsupdate', power: 'ms-settings:powersleep',
    energia: 'ms-settings:powersleep', personalization: 'ms-settings:personalization',
    time: 'ms-settings:dateandtime', fecha: 'ms-settings:dateandtime',
  };
  const key = String(page || 'system').toLowerCase().trim();
  const uri = map[key] || (key.startsWith('ms-settings:') ? key : 'ms-settings:about');
  const r = await ps("Start-Process '" + uri + "'");
  return r.ok ? { ok: true, result: 'Ajustes abiertos (' + key + ')' } : r;
}

async function searchFiles(query, root) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const q = String(query || '').replace(/'/g, "''").slice(0, 120);
  if (!q) return { ok: false, result: 'Falta término de búsqueda' };
  const base = root ? String(root) : path.join(os.homedir(), 'Documents');
  const safeBase = base.replace(/'/g, "''");
  const r = await ps(
    "Get-ChildItem -Path '" +
      safeBase +
      "' -Recurse -ErrorAction SilentlyContinue -Filter '*" +
      q +
      "*' | Select-Object -First 25 FullName | ForEach-Object { $_.FullName } | Out-String",
    30000,
  );
  if (!r.ok) return r;
  const lines = (r.result || '').trim();
  if (!lines) return { ok: true, result: 'Sin resultados para "' + query + '"' };
  return { ok: true, result: lines.slice(0, 4000) };
}

async function power(action, minutes) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const a = (action || '').toLowerCase();
  const delay = Math.max(0, Math.min(120, parseInt(minutes, 10) || 0));
  const seconds = delay * 60 || 30;
  if (a === 'cancel' || a === 'cancelar') {
    await execAsync('shutdown /a', { windowsHide: true }).catch(() => {});
    return { ok: true, result: 'Apagado/reinicio cancelado' };
  }
  if (a === 'shutdown' || a === 'apagar') {
    await execAsync('shutdown /s /t ' + seconds, { windowsHide: true });
    return { ok: true, result: 'Apagado en ' + seconds + 's. Di cancelar para abortar.' };
  }
  if (a === 'restart' || a === 'reiniciar') {
    await execAsync('shutdown /r /t ' + seconds, { windowsHide: true });
    return { ok: true, result: 'Reinicio en ' + seconds + 's. Di cancelar para abortar.' };
  }
  if (a === 'sleep' || a === 'suspender') {
    await ps(
      'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend,$false,$false)',
    );
    return { ok: true, result: 'Suspensión solicitada' };
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
    return r.ok ? { ok: true, result: r.result.slice(0, 1200) } : r;
  }
  return { ok: false, result: 'Acción no reconocida' };
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
  shell,
  ps,
};
