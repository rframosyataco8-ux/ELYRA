/**
 * Hooks cognitivos v3 — ReAct + skills FS nativos (sin OpenClaw)
 */
const mem = require('./memory-cognitive.cjs');
const { runPythonTool } = require('./python-bridge.cjs');
const fsSkills = require('./fs-skills.cjs');

const REACT_ADDENDUM = `

[IDENTIDAD]
Eres ELYRA, asistente de escritorio profesional con control real del PC.
No dependes de servicios externos tipo OpenClaw: las skills de archivos y sistema son nativas.

[ESTILO]
- Español natural, claro. Como un colega brillante.
- Acciones: ejecuta y confirma en 1 frase.
- Conocimiento: 2-5 frases útiles.

[BUCLE ReAct]
1) THOUGHT 2) ACTION (tools en cadena) 3) OBSERVATION 4) respuesta final.

[SKILLS ARCHIVOS — nativas y rápidas]
- find_files: buscar por extensión (pdf, docx…) en descargas/documentos/escritorio
- collect_files: buscar + copiar a Informes + resumen (multi-paso)
- copy_file, mkdir, scan_folder, analyze_excel, summarize_pdf, write_docx…

Ejemplos:
- "busca los pdf de descargas y cópialos" → collect_files o skill local
- "lista excel en documentos" → find_files
`;

async function extendExecute(name, params, helpers, baseExecute) {
  switch (name) {
    case 'find_files':
      return fsSkills.findFiles({
        root: params.root,
        ext: params.ext,
        query: params.query,
      });
    case 'collect_files':
      return fsSkills.collectByExtension({
        root: params.root,
        ext: params.ext || 'pdf',
        dest: params.dest,
        query: params.query,
      });
    case 'copy_file':
      return fsSkills.copyFile(params.path || params.src, params.dest || params.destDir);
    case 'mkdir':
      return fsSkills.mkdir(params.name || params.path);
    case 'scan_folder':
      return runPythonTool('scan_folder', { root: params.root, pattern: params.pattern });
    case 'analyze_excel': {
      const r = await runPythonTool('analyze_excel', {
        path: params.path,
        export: params.export === true || params.export === 'true',
      });
      if (r.ok && params.path) mem.noteFile(params.path, (r.result || '').slice(0, 200));
      return r;
    }
    case 'summarize_pdf': {
      const r = await runPythonTool('summarize_pdf', { path: params.path });
      if (r.ok && params.path) mem.noteFile(params.path, (r.result || '').slice(0, 200));
      return r;
    }
    case 'read_docx':
      return runPythonTool('read_docx', { path: params.path });
    case 'write_docx': {
      const r = await runPythonTool('write_docx', {
        title: params.title,
        body: params.body || params.content,
        path: params.path,
      });
      if (r.ok && r.path) mem.noteFile(r.path, params.title || 'docx');
      return r;
    }
    case 'write_pptx': {
      const r = await runPythonTool('write_pptx', {
        title: params.title,
        slides: params.slides,
        body: params.body,
        path: params.path,
      });
      if (r.ok && r.path) mem.noteFile(r.path, params.title || 'pptx');
      return r;
    }
    case 'html_dashboard': {
      const r = await runPythonTool('html_dashboard', {
        title: params.title,
        body: params.body || params.html,
        path: params.path,
      });
      if (r.ok && r.path) mem.noteFile(r.path, params.title || 'dashboard');
      return r;
    }
    case 'remember': {
      const text = params.text || '';
      const kind = (params.kind || '').toLowerCase();
      if (kind === 'preference' || /me gusta|prefiero|siempre|nunca|mi nombre/i.test(text)) {
        mem.addPreference(text);
      } else {
        mem.addFact(text);
      }
      if (helpers.remember) await helpers.remember(text);
      return { ok: true, result: 'Guardado en memoria a largo plazo' };
    }
    case 'recall': {
      const ctx = mem.retrieveContext(params.query || 'preferencias hechos', 10);
      const legacy = helpers.recall ? await helpers.recall() : null;
      const parts = [];
      if (ctx) parts.push(ctx);
      if (legacy?.result) parts.push(legacy.result);
      return { ok: true, result: parts.join('\n') || 'Sin memoria aún.' };
    }
    default:
      return baseExecute ? baseExecute() : { ok: false, result: 'Desconocida: ' + name };
  }
}

function enrichSystemPrompt(basePrompt, userMessage) {
  return basePrompt + REACT_ADDENDUM + mem.buildMemoryBlock(userMessage);
}

function recordEpisode(user, assistant, tools) {
  try {
    mem.addEpisode(user, assistant, tools);
  } catch {}
}

module.exports = {
  extendExecute,
  enrichSystemPrompt,
  recordEpisode,
  REACT_ADDENDUM,
};
