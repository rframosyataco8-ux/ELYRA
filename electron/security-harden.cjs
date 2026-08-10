/**
 * ELYRA 0.9 — endurecimiento de seguridad
 * Redacción de secretos, rutas seguras, auditoría ligera.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = path.resolve(os.homedir());

const SECRET_PATTERNS = [
  /gsk_[a-zA-Z0-9]{20,}/g,
  /sk-ant-[a-zA-Z0-9\-_]{20,}/g,
  /sk-or-v1-[a-zA-Z0-9]{20,}/g,
  /sk-[a-zA-Z0-9]{20,}/g,
  /nvapi-[a-zA-Z0-9\-_]{20,}/g,
  /xai-[a-zA-Z0-9]{20,}/g,
  /AIza[0-9A-Za-z\-_]{20,}/g,
  /Bearer\s+[a-zA-Z0-9._\-]+/gi,
];

function redactSecrets(text) {
  let t = String(text || '');
  for (const re of SECRET_PATTERNS) {
    t = t.replace(re, '[REDACTED]');
  }
  return t;
}

/** Solo permitir rutas bajo el perfil del usuario (con excepciones de lectura temporal) */
function isPathSafe(target, { allowWrite = true } = {}) {
  try {
    if (!target) return false;
    const resolved = path.resolve(String(target));
    // Bloquear áreas de sistema
    const lower = resolved.toLowerCase();
    if (
      /\\windows\\system32|\\windows\\syswow64|\/etc\/|\/usr\/bin|program files/i.test(lower)
    ) {
      return false;
    }
    if (resolved === HOME || resolved.startsWith(HOME + path.sep)) return true;
    // tmp para TTS/STT
    const tmp = path.resolve(os.tmpdir());
    if (resolved.startsWith(tmp + path.sep) || resolved === tmp) return true;
    return false;
  } catch {
    return false;
  }
}

function auditLog(event, detail) {
  try {
    const dir = path.join(HOME, '.elyra');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const line =
      JSON.stringify({
        at: new Date().toISOString(),
        event: String(event || 'event'),
        detail: redactSecrets(
          typeof detail === 'string' ? detail : JSON.stringify(detail || {}).slice(0, 500),
        ),
      }) + '\n';
    fs.appendFileSync(path.join(dir, 'audit.log'), line, 'utf-8');
  } catch {
    /* no tumbar el asistente por el log */
  }
}

/** Extiende lista de shell peligroso (usado además de tool-permissions) */
const EXTRA_BLOCKED = [
  /reg\s+delete/i,
  /net\s+user\s+.*\s+\/delete/i,
  /bcdedit/i,
  /cipher\s+\/w/i,
  /\\Device\\Harddisk/i,
];

function extraShellBlocked(command) {
  const cmd = String(command || '');
  for (const re of EXTRA_BLOCKED) {
    if (re.test(cmd)) {
      return {
        ok: false,
        blocked: true,
        result: 'Comando bloqueado por política de seguridad ELYRA 0.9.',
      };
    }
  }
  return { ok: true };
}

module.exports = {
  redactSecrets,
  isPathSafe,
  auditLog,
  extraShellBlocked,
};
