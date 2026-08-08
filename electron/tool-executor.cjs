/**
 * Ejecutor unificado de tools ELYRA — PC, FS, Python, web, memoria + permisos 0.2
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const hooks = require('./agent-hooks.cjs');
const fsSkills = require('./fs-skills.cjs');
const HOOK_TOOLS = require('./agent-tool-gate.cjs');
const { deepWebSearch } = require('./web-search-boost.cjs');
const { youtubeSearchUrl, googleSearchUrl } = require('./intent-compound.cjs');
const pcControl = require('./pc-control.cjs');
const { authorizeTool, checkShellCommand } = require('./tool-permissions.cjs');

function resolveUserPath(filePath) {
  if (!filePath) return path.join(os.homedir(), 'Documents', 'elyra-output.txt');
  if (path.isAbsolute(filePath)) return filePath;
  const docs = path.join(os.homedir(), 'Documents');
  const normalized = filePath.replace(/\\/g, '/');
  if (/^informes\//i.test(normalized)) {
    const informes = path.join(docs, 'Informes');
    if (!fs.existsSync(informes)) fs.mkdirSync(informes, { recursive: true });
    return path.join(docs, normalized);
  }
  return path.join(docs, filePath);
}

async function executeTool(tool, helpers) {
  const name = String(tool.name || '').toLowerCase();
  const params = tool.params || {};
  const pc = helpers.pc || pcControl;
  const ctx = {
    userText: (helpers && helpers.userText) || '',
    allowDestructive: !!(helpers && helpers.allowDestructive),
  };

  const auth = authorizeTool(name, params, ctx);
  if (!auth.ok) {
    return { ok: false, result: auth.result, blocked: true, needsConfirm: !!auth.needsConfirm };
  }

  if (HOOK_TOOLS.has(name)) {
    return hooks.extendExecute(name, params, helpers, null);
  }

  if (name === 'find_files') {
    return fsSkills.findFiles({ root: params.root, ext: params.ext, query: params.query });
  }
  if (name === 'collect_files') {
    return fsSkills.collectByExtension({
      root: params.root,
      ext: params.ext || 'pdf',
      dest: params.dest,
      query: params.query,
    });
  }
  if (name === 'copy_file') {
    return fsSkills.copyFile(params.path || params.src, params.dest || params.destDir);
  }
  if (name === 'mkdir') {
    return fsSkills.mkdir(params.name || params.path);
  }

  try {
    switch (name) {
      case 'web_search': {
        const q = params.query || '';
        if (!q) return { ok: false, result: 'Falta query' };
        if (/\byoutube\b|\bvideo\b/i.test(q) && helpers.openUrl) {
          const clean = q
            .replace(/\s*en\s+youtube\s*/gi, ' ')
            .replace(/\byoutube\b/gi, ' ')
            .replace(/\bvideo\b/gi, ' ')
            .trim();
          if (clean) {
            await helpers.openUrl(youtubeSearchUrl(clean));
            return { ok: true, result: 'YouTube abierto con búsqueda: ' + clean };
          }
        }
        const deep = await deepWebSearch(q);
        if (deep.ok) return { ok: true, result: deep.response };
        return {
          ok: true,
          result: (deep.response || 'Sin resumen') + ' · Google: ' + googleSearchUrl(q),
        };
      }
      case 'create_file': {
        const filePath = resolveUserPath(params.path || 'elyra-output.txt');
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, params.content || '', 'utf-8');
        return { ok: true, result: 'Creado ' + path.basename(filePath) };
      }
      case 'create_html_report': {
        const filePath = resolveUserPath(params.path || 'Informes/reporte.html');
        const title = params.title || 'Reporte ELYRA';
        const body = params.body || '<p>Sin contenido</p>';
        const html =
          '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>' +
          title.replace(/</g, '') +
          '</title></head><body><h1>' +
          title.replace(/</g, '') +
          '</h1>' +
          body +
          '</body></html>';
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const finalPath = filePath.toLowerCase().endsWith('.html') ? filePath : filePath + '.html';
        fs.writeFileSync(finalPath, html, 'utf-8');
        return { ok: true, result: 'Reporte ' + path.basename(finalPath) + ' listo' };
      }
      case 'open_app':
        return await helpers.openApp(params.name || '');
      case 'open_folder':
        return await helpers.openFolder(params.name || '');
      case 'open_url':
        return await helpers.openUrl(params.url || '');
      case 'read_file': {
        let p = params.path;
        if (!p) return { ok: false, result: 'Falta path' };
        if (!path.isAbsolute(p)) p = resolveUserPath(p);
        const candidates = [
          p,
          path.join(os.homedir(), 'Documents', params.path),
          path.join(os.homedir(), 'Desktop', params.path),
          path.join(os.homedir(), 'Downloads', params.path),
        ];
        const found = candidates.find((c) => c && fs.existsSync(c) && fs.statSync(c).isFile());
        if (!found) return { ok: false, result: 'No existe ' + params.path };
        return {
          ok: true,
          result: path.basename(found) + ':\n' + fs.readFileSync(found, 'utf-8').slice(0, 14000),
        };
      }
      case 'list_dir': {
        let p = params.path || path.join(os.homedir(), 'Documents');
        if (!path.isAbsolute(p)) p = resolveUserPath(p);
        if (!fs.existsSync(p)) return { ok: false, result: 'No existe' };
        const items = fs.readdirSync(p, { withFileTypes: true }).slice(0, 120);
        return {
          ok: true,
          result: items.map((d) => (d.isDirectory() ? '[DIR] ' : '') + d.name).join('\n'),
        };
      }
      case 'search_files':
        return pc.searchFiles
          ? await pc.searchFiles(params.query, params.root)
          : { ok: false, result: 'N/A' };
      case 'run_command':
      case 'shell': {
        const cmd = params.command || params.cmd || '';
        const shellCheck = checkShellCommand(cmd);
        if (!shellCheck.ok) return shellCheck;
        if (helpers.runCommand) {
          try {
            return await helpers.runCommand(cmd);
          } catch {
            /* fallback */
          }
        }
        if (pc.shell) return await pc.shell(cmd);
        return { ok: false, result: 'Shell no disponible' };
      }
      case 'get_system_info':
        if (helpers.getSystemStats) {
          const s = await helpers.getSystemStats();
          return { ok: true, result: 'CPU ' + s.cpu + '%, RAM ' + s.ram + '%, disco ' + s.disk + '%.' };
        }
        return {
          ok: true,
          result: os.hostname() + ', ' + Math.round(os.totalmem() / 1e9) + ' GB RAM.',
        };
      case 'battery':
        return pc.battery ? await pc.battery() : { ok: false, result: 'N/A' };
      case 'network_info':
        return pc.networkInfo ? await pc.networkInfo() : { ok: false, result: 'N/A' };
      case 'disk_space':
        return pc.systemExtras ? await pc.systemExtras('disk_space') : { ok: false, result: 'N/A' };
      case 'uptime':
        return pc.systemExtras ? await pc.systemExtras('uptime') : { ok: false, result: 'N/A' };
      case 'volume':
        return pc.volume ? await pc.volume(params.action, params.value) : { ok: false, result: 'N/A' };
      case 'media':
        return pc.media ? await pc.media(params.action) : { ok: false, result: 'N/A' };
      case 'brightness':
        return pc.brightness
          ? await pc.brightness(params.action, params.value)
          : { ok: false, result: 'N/A' };
      case 'clipboard':
        return pc.clipboard
          ? await pc.clipboard(params.action, params.text)
          : { ok: false, result: 'N/A' };
      case 'screenshot':
        return pc.screenshot ? await pc.screenshot() : { ok: false, result: 'N/A' };
      case 'list_processes':
        return pc.listProcesses ? await pc.listProcesses() : { ok: false, result: 'N/A' };
      case 'kill_process':
        return pc.killProcess ? await pc.killProcess(params.name) : { ok: false, result: 'N/A' };
      case 'windows':
        return pc.windows
          ? await pc.windows(params.action, params.title || params.name)
          : { ok: false, result: 'N/A' };
      case 'input':
        return pc.input
          ? await pc.input(params.action, {
              text: params.text,
              x: params.x,
              y: params.y,
              keys: params.keys || params.key,
            })
          : { ok: false, result: 'N/A' };
      case 'notify':
        return pc.notify ? await pc.notify(params.title, params.message) : { ok: false, result: 'N/A' };
      case 'open_settings':
        return pc.openSettings
          ? await pc.openSettings(params.page || params.name)
          : { ok: false, result: 'N/A' };
      case 'empty_recycle':
        return pc.emptyRecycle ? await pc.emptyRecycle() : { ok: false, result: 'N/A' };
      case 'power':
        return pc.power ? await pc.power(params.action, params.minutes) : { ok: false, result: 'N/A' };
      default:
        return { ok: false, result: 'Herramienta desconocida: ' + name };
    }
  } catch (e) {
    return { ok: false, result: e.message };
  }
}

module.exports = { executeTool, resolveUserPath };
