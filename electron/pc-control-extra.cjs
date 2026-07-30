/**
 * Extensiones de control PC — ELYRA
 */
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function ps(command, timeout = 15000) {
  if (process.platform !== 'win32') {
    return { ok: false, result: 'Optimizado para Windows.' };
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

async function openTaskManager() {
  try {
    await execAsync('taskmgr', { windowsHide: true });
    return { ok: true, result: 'Administrador de tareas abierto' };
  } catch {
    const r = await ps('Start-Process taskmgr');
    return r.ok ? { ok: true, result: 'Administrador de tareas abierto' } : r;
  }
}

async function openExplorer(target) {
  const home = os.homedir();
  const map = {
    home: home,
    documents: path.join(home, 'Documents'),
    downloads: path.join(home, 'Downloads'),
    desktop: path.join(home, 'Desktop'),
    pictures: path.join(home, 'Pictures'),
  };
  const t = map[(target || '').toLowerCase()] || target || home;
  const r = await ps("Start-Process explorer.exe -ArgumentList '" + String(t).replace(/'/g, "''") + "'");
  return r.ok ? { ok: true, result: 'Explorador abierto' } : r;
}

async function flushDns() {
  try {
    await execAsync('ipconfig /flushdns', { windowsHide: true });
    return { ok: true, result: 'Caché DNS vaciada' };
  } catch (e) {
    return { ok: false, result: e.message };
  }
}

async function wifiStatus() {
  const r = await ps(
    "netsh wlan show interfaces | Select-String 'SSID|Estado|Signal|State' | Out-String",
  );
  return r.ok ? { ok: true, result: (r.result || 'Sin datos WiFi').slice(0, 800) } : r;
}

async function setWifi(enabled) {
  const on = enabled === true || enabled === 'on' || enabled === 'enable';
  const r = await ps(
    on
      ? "Get-NetAdapter -Name '*Wi-Fi*','*WLAN*' -ErrorAction SilentlyContinue | Enable-NetAdapter -Confirm:$false; Write-Output 'WiFi activado'"
      : "Get-NetAdapter -Name '*Wi-Fi*','*WLAN*' -ErrorAction SilentlyContinue | Disable-NetAdapter -Confirm:$false; Write-Output 'WiFi desactivado'",
  );
  return r.ok
    ? { ok: true, result: on ? 'WiFi activado' : 'WiFi desactivado' }
    : { ok: false, result: r.result || 'No pude cambiar el WiFi (puede requerir admin)' };
}

async function openUrlDefault(url) {
  const u = String(url || '').trim();
  if (!u) return { ok: false, result: 'URL vacía' };
  const full = /^https?:/i.test(u) ? u : 'https://' + u;
  const r = await ps("Start-Process '" + full.replace(/'/g, "''") + "'");
  return r.ok ? { ok: true, result: 'Enlace abierto' } : r;
}

async function listWindows() {
  const r = await ps(
    "Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object -First 20 ProcessName, MainWindowTitle | Format-Table -AutoSize | Out-String",
  );
  return r.ok ? { ok: true, result: (r.result || '').slice(0, 1500) } : r;
}

async function emptyTemp() {
  const r = await ps(
    "$t = $env:TEMP; Get-ChildItem $t -Recurse -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue; Write-Output 'Temporales limpiados'",
    30000,
  );
  return r.ok ? { ok: true, result: 'Archivos temporales limpiados' } : r;
}

module.exports = {
  openTaskManager,
  openExplorer,
  flushDns,
  wifiStatus,
  setWifi,
  openUrlDefault,
  listWindows,
  emptyTemp,
};
