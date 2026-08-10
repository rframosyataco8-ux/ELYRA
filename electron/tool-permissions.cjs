/**
 * ELYRA permisos de herramientas (0.2 + 0.9 harden)
 */

const DESTRUCTIVE_TOOLS = new Set([
  'power',
  'kill_process',
  'empty_recycle',
  'run_command',
  'shell',
]);

const CONFIRM_RE =
  /\b(confirma|confirmado|confirmación|confirmacion|hazlo ya|sí confirma|si confirma|forzar|force|authorized|autorizo|procede con el apagado|procede con el reinicio)\b/i;

const BLOCKED_SHELL = [
  /rm\s+-rf\s+[\/\\]/i,
  /rm\s+-rf\s+~/,
  /format\s+[a-z]:/i,
  /del\s+\/s\s+\/q/i,
  /rd\s+\/s\s+\/q/i,
  /mkfs/i,
  /diskpart/i,
  /Remove-Item\s+.*-Recurse\s+.*-Force/i,
  /shutdown\s+\/s/i,
  /shutdown\s+\/r/i,
  /Stop-Computer/i,
  /Restart-Computer/i,
];

function userConfirmed(userText) {
  return CONFIRM_RE.test(String(userText || ''));
}

function isDestructiveTool(name) {
  return DESTRUCTIVE_TOOLS.has(String(name || '').toLowerCase());
}

function checkShellCommand(command) {
  const cmd = String(command || '');
  for (const re of BLOCKED_SHELL) {
    if (re.test(cmd)) {
      try {
        require('./security-harden.cjs').auditLog('shell_blocked', cmd.slice(0, 200));
      } catch {}
      return {
        ok: false,
        blocked: true,
        result:
          'Comando bloqueado por seguridad. Es demasiado destructivo para ejecutarlo automáticamente.',
      };
    }
  }
  try {
    const extra = require('./security-harden.cjs').extraShellBlocked(cmd);
    if (!extra.ok) {
      try {
        require('./security-harden.cjs').auditLog('shell_blocked_extra', cmd.slice(0, 200));
      } catch {}
      return extra;
    }
  } catch {}
  return { ok: true };
}

function authorizeTool(name, params, ctx) {
  const n = String(name || '').toLowerCase();
  const userText = (ctx && ctx.userText) || '';
  const force = !!(ctx && ctx.allowDestructive);

  if (n === 'run_command' || n === 'shell') {
    const shellCheck = checkShellCommand(params?.command || params?.cmd || '');
    if (!shellCheck.ok) return shellCheck;
  }

  if (n === 'power') {
    const action = String(params?.action || '').toLowerCase();
    if (action === 'shutdown' || action === 'restart') {
      if (!force && !userConfirmed(userText)) {
        try {
          require('./security-harden.cjs').auditLog('power_needs_confirm', action);
        } catch {}
        return {
          ok: false,
          blocked: true,
          needsConfirm: true,
          result:
            'Esa acción apaga o reinicia el PC. Di «confirma apagar» o «confirma reiniciar» si realmente lo quieres.',
        };
      }
      try {
        require('./security-harden.cjs').auditLog('power_authorized', action);
      } catch {}
    }
  }

  if (n === 'kill_process') {
    const proc = String(params?.name || '').toLowerCase();
    if (/explorer|winlogon|csrss|system|smss/.test(proc)) {
      try {
        require('./security-harden.cjs').auditLog('kill_blocked_critical', proc);
      } catch {}
      return {
        ok: false,
        blocked: true,
        result: 'No puedo terminar procesos críticos del sistema (' + proc + ').',
      };
    }
    if (!force && !userConfirmed(userText)) {
      return {
        ok: false,
        blocked: true,
        needsConfirm: true,
        result:
          'Cerrar el proceso «' +
          (params?.name || '') +
          '» puede perder datos. Di «confirma» y el nombre del proceso para continuar.',
      };
    }
  }

  if (n === 'empty_recycle') {
    if (!force && !userConfirmed(userText)) {
      return {
        ok: false,
        blocked: true,
        needsConfirm: true,
        result: 'Vaciar la papelera es irreversible. Di «confirma vaciar papelera» si lo deseas.',
      };
    }
  }

  if ((n === 'run_command' || n === 'shell') && !force && !userConfirmed(userText)) {
    const cmd = String(params?.command || params?.cmd || '');
    if (/remove-item|del |rmdir|rm |format |shutdown|stop-computer|restart-computer/i.test(cmd)) {
      return {
        ok: false,
        blocked: true,
        needsConfirm: true,
        result:
          'Ese comando puede modificar o borrar datos. Di «confirma» junto a la orden para autorizarlo.',
      };
    }
  }

  return { ok: true };
}

module.exports = {
  authorizeTool,
  checkShellCommand,
  userConfirmed,
  isDestructiveTool,
  DESTRUCTIVE_TOOLS,
};
