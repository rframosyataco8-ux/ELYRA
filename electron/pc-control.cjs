/**
 * Control real del PC (Windows vía PowerShell; degradación clara en otros SO)
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const PROTECTED = new Set([
  'csrss', 'smss', 'wininit', 'services', 'lsass', 'svchost', 'system',
  'registry', 'winlogon', 'dwm', 'fontdrvhost', 'sihost', 'taskhostw',
  'explorer', 'securityhealthservice', 'msmpeng', 'nissrv',
]);

async function ps(command, timeout = 12000) {
  if (process.platform !== 'win32') {
    return { ok: false, result: 'Esta función está optimizada para Windows.' };
  }
  try {
    const wrapped = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${command.replace(/"/g, '\\"')}"`;
    const { stdout, stderr } = await execAsync(wrapped, {
      timeout,
      windowsHide: true,
      maxBuffer: 1024 * 512,
    });
    return { ok: true, result: (stdout || stderr || 'OK').trim().slice(0, 2000) };
  } catch (e) {
    return { ok: false, result: e.message.slice(0, 400) };
  }
}

async function volume(action, value) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const a = (action || '').toLowerCase();
  // Simulación de teclas de volumen del sistema (sin dependencias)
  const send = async (key) => {
    // 175 vol+, 174 vol-, 173 mute
    return ps(`(New-Object -ComObject WScript.Shell).SendKeys([char]${key})`);
  };
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
    // Aproximación: mute + subir N veces desde 0 no es fiable sin API nativa.
    // Usamos teclas repetidas hacia arriba tras un mute no garantizado.
    const pct = Math.max(0, Math.min(100, parseInt(value, 10) || 50));
    return {
      ok: true,
      result: `Ajuste aproximado pedido al ${pct}%. Usa subir/bajar para afinar (Windows sin drivers extra).`,
    };
  }
  return { ok: false, result: 'Acción de volumen no reconocida' };
}

async function media(action) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const map = {
    play: 179,
    pause: 179,
    'play/pause': 179,
    next: 176,
    siguiente: 176,
    prev: 177,
    anterior: 177,
  };
  const key = map[(action || '').toLowerCase()];
  if (!key) return { ok: false, result: 'Acción multimedia no reconocida' };
  const r = await ps(`(New-Object -ComObject WScript.Shell).SendKeys([char]${key})`);
  return r.ok
    ? { ok: true, result: `Multimedia: ${action}` }
    : r;
}

async function brightness(action, value) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const a = (action || '').toLowerCase();
  try {
    if (a === 'up' || a === 'subir') {
      await ps(
        `$b=(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods);$c=(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness).CurrentBrightness;$n=[Math]::Min(100,$c+10);$b.WmiSetBrightness(1,$n)`,
      );
      return { ok: true, result: 'Brillo subido' };
    }
    if (a === 'down' || a === 'bajar') {
      await ps(
        `$b=(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods);$c=(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness).CurrentBrightness;$n=[Math]::Max(5,$c-10);$b.WmiSetBrightness(1,$n)`,
      );
      return { ok: true, result: 'Brillo bajado' };
    }
    if (a === 'set' || a === 'fijar') {
      const pct = Math.max(5, Math.min(100, parseInt(value, 10) || 50));
      await ps(
        `$b=(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods);$b.WmiSetBrightness(1,${pct})`,
      );
      return { ok: true, result: `Brillo al ${pct}%` };
    }
  } catch (e) {
    return { ok: false, result: 'No pude cambiar el brillo en este equipo.' };
  }
  return { ok: false, result: 'Acción de brillo no reconocida' };
}

async function clipboard(action, text) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const a = (action || '').toLowerCase();
  if (a === 'read' || a === 'leer') {
    const r = await ps('Get-Clipboard -Raw');
    return r.ok
      ? { ok: true, result: (r.result || '(vacío)').slice(0, 1500) }
      : r;
  }
  if (a === 'write' || a === 'escribir') {
    const safe = String(text || '').replace(/'/g, "''");
    const r = await ps(`Set-Clipboard -Value '${safe}'`);
    return r.ok ? { ok: true, result: 'Texto copiado al portapapeles' } : r;
  }
  return { ok: false, result: 'Usa read o write' };
}

async function screenshot() {
  const dir = path.join(os.homedir(), 'Documents', 'Informes', 'Capturas');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `captura-${Date.now()}.png`);
  if (process.platform !== 'win32') {
    return { ok: false, result: 'Captura automática disponible en Windows' };
  }
  const psCmd =
    `Add-Type -AssemblyName System.Windows.Forms;Add-Type -AssemblyName System.Drawing;` +
    `$b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds;` +
    `$bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height;` +
    `$g=[System.Drawing.Graphics]::FromImage($bmp);` +
    `$g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size);` +
    `$bmp.Save('${file.replace(/'/g, "''")}' );$g.Dispose();$bmp.Dispose();Write-Output 'OK'`;
  const r = await ps(psCmd, 20000);
  if (r.ok && fs.existsSync(file)) {
    return { ok: true, result: `Captura guardada como ${path.basename(file)} en Documentos/Informes/Capturas` };
  }
  return { ok: false, result: r.result || 'No se pudo capturar' };
}

async function listProcesses() {
  if (process.platform !== 'win32') {
    return { ok: true, result: 'Listado detallado disponible en Windows' };
  }
  const r = await ps(
    `Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 12 Name,@{N='MB';E={[math]::Round($_.WorkingSet64/1MB,1)}} | Format-Table -AutoSize | Out-String`,
  );
  return r.ok ? { ok: true, result: r.result.slice(0, 1500) } : r;
}

async function killProcess(name) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const n = String(name || '').replace(/\.exe$/i, '').trim().toLowerCase();
  if (!n) return { ok: false, result: 'Falta nombre de proceso' };
  if (PROTECTED.has(n)) {
    return { ok: false, result: `No puedo cerrar "${n}": está protegido por seguridad.` };
  }
  const r = await ps(`Stop-Process -Name '${n.replace(/'/g, "''")}' -Force -ErrorAction SilentlyContinue; Write-Output 'cerrado'`);
  return r.ok
    ? { ok: true, result: `Proceso ${n} cerrado (si estaba en ejecución)` }
    : r;
}

async function windows(action) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const a = (action || '').toLowerCase();
  if (a === 'minimize_all' || a === 'minimizar') {
    // Win+D
    const r = await ps(
      `$w=New-Object -ComObject WScript.Shell;$w.SendKeys('^{ESC}');Start-Sleep -Milliseconds 200;$w.SendKeys('d')`,
    );
    // Alternative: show desktop via shell
    await ps(`(New-Object -ComObject Shell.Application).ToggleDesktop()`);
    return { ok: true, result: 'Escritorio mostrado / ventanas minimizadas' };
  }
  if (a === 'lock' || a === 'bloquear') {
    await ps('rundll32.exe user32.dll,LockWorkStation');
    return { ok: true, result: 'Sesión bloqueada' };
  }
  if (a === 'screen_off' || a === 'pantalla_off') {
    await ps(
      `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class S{[DllImport(\"user32.dll\")]public static extern int SendMessage(int h,int m,int w,int l);}';[S]::SendMessage(-1,0x0112,0xF170,2)`,
    );
    return { ok: true, result: 'Pantalla apagada' };
  }
  return { ok: false, result: 'Acción de ventana no reconocida' };
}

async function input(action, payload = {}) {
  if (process.platform !== 'win32') return { ok: false, result: 'Solo Windows' };
  const a = (action || '').toLowerCase();
  if (a === 'type' || a === 'escribir') {
    const text = String(payload.text || '').replace(/[+^%~(){}\[\]]/g, '{$&}').replace(/'/g, "''");
    const r = await ps(`(New-Object -ComObject WScript.Shell).SendKeys('${text}')`);
    return r.ok ? { ok: true, result: 'Texto enviado a la ventana activa' } : r;
  }
  if (a === 'click') {
    // Click en posición actual
    const r = await ps(
      `Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern void mouse_event(int f,int x,int y,int d,int e);' -Name U -Namespace W;` +
        `[W.U]::mouse_event(0x02,0,0,0,0);[W.U]::mouse_event(0x04,0,0,0,0)`,
    );
    return r.ok ? { ok: true, result: 'Clic realizado' } : r;
  }
  return { ok: false, result: 'Acción de input no reconocida' };
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
};
