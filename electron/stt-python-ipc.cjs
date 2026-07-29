/**
 * Handler helper for Python STT — loaded from main if needed.
 * Prefer inline in main: ipc 'stt-listen-python'
 */
const path = require('path');
const { spawn } = require('child_process');
const { getConfig, ensureDefaultConfig } = require('./agent.cjs');

function runPythonStt(seconds = 5) {
  return new Promise((resolve) => {
    ensureDefaultConfig();
    const config = getConfig();
    if (!config.apiKey) {
      resolve({ ok: false, error: 'Sin API key' });
      return;
    }
    const script = path.join(__dirname, 'stt_listen.py');
    const args = [script, config.apiKey, String(seconds || 5)];
    const tries = [
      { cmd: 'python', args },
      { cmd: 'py', args: ['-3', ...args] },
      { cmd: 'python3', args },
    ];

    const tryOne = (i) => {
      if (i >= tries.length) {
        resolve({
          ok: false,
          error: 'Python no disponible. Instala: pip install sounddevice numpy',
        });
        return;
      }
      const t = tries[i];
      const child = spawn(t.cmd, t.args, { windowsHide: true });
      let out = '';
      let err = '';
      child.stdout.on('data', (d) => (out += d.toString()));
      child.stderr.on('data', (d) => (err += d.toString()));
      child.on('error', () => tryOne(i + 1));
      child.on('close', (code) => {
        if (code !== 0 && !out.trim()) {
          if (i < tries.length - 1) return tryOne(i + 1);
          resolve({ ok: false, error: err.slice(0, 200) || 'STT Python falló' });
          return;
        }
        try {
          const line = out.trim().split('\n').filter(Boolean).pop();
          resolve(JSON.parse(line));
        } catch {
          resolve({ ok: false, error: out.slice(0, 200) || err.slice(0, 200) || 'Respuesta inválida' });
        }
      });
    };
    tryOne(0);
  });
}

module.exports = { runPythonStt };
