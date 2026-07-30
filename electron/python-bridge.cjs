/**
 * Puente Node → Python para herramientas de productividad.
 * Si Python o paquetes faltan, devuelve error claro (no tumba el agente).
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SCRIPT = path.join(__dirname, 'python_tools', 'agent_tools.py');

function findPython() {
  const candidates =
    process.platform === 'win32'
      ? ['py', 'python', 'python3']
      : ['python3', 'python'];
  return candidates[0];
}

/**
 * @param {string} tool - analyze_excel | summarize_pdf | write_docx | write_pptx | scan_folder | html_dashboard
 * @param {object} args
 */
function runPythonTool(tool, args = {}, timeoutMs = 90000) {
  return new Promise((resolve) => {
    if (!fs.existsSync(SCRIPT)) {
      resolve({ ok: false, result: 'Script Python no encontrado: electron/python_tools/agent_tools.py' });
      return;
    }

    const payload = JSON.stringify({ tool, args });
    const py = findPython();
    const child = spawn(py, [SCRIPT], {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {}
      resolve({ ok: false, result: 'Timeout en herramienta Python (' + tool + ')' });
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        result:
          'Python no disponible (' +
          err.message +
          '). Instala Python 3 y: pip install -r electron/python_tools/requirements.txt',
      });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop() || '';
        const parsed = JSON.parse(line);
        resolve(parsed);
      } catch {
        resolve({
          ok: false,
          result:
            (stderr || stdout || 'Error Python code ' + code).slice(0, 800) +
            (stderr.includes('ModuleNotFoundError')
              ? ' → Ejecuta: pip install -r electron/python_tools/requirements.txt'
              : ''),
        });
      }
    });

    child.stdin.write(payload);
    child.stdin.end();
  });
}

function defaultDocs() {
  return path.join(os.homedir(), 'Documents');
}

module.exports = { runPythonTool, defaultDocs, SCRIPT };
