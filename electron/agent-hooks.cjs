/**
 * Hooks cognitivos v4 — ReAct + memoria + dominio laboratorio
 */
const mem = require('./memory-cognitive.cjs');
const { runPythonTool } = require('./python-bridge.cjs');
const fsSkills = require('./fs-skills.cjs');

const REACT_ADDENDUM = `

[IDENTIDAD v15]
Eres ELYRA: escritorio + laboratorio (cacao, cadmio, plaguicidas, AFQ, registro de prensa, cronograma).
Tus herramientas cambian el PC real. No inventes éxitos.

[CÓMO PENSAR]
- Intención primero (voz imperfecta incluida).
- Multi-paso: herramientas en cadena → una sola respuesta final hablable.
- "Lo de siempre" / preferencias → recall antes de actuar.
- Dato crítico faltante → una pregunta; si puedes asumir con seguridad, avanza.
- Charla ≠ acción: no abras apps por cortesía.

[LABORATORIO]
- Productos: torta trozada, cacao, cocoa, licor, manteca, grano, % grasa, NIRS, alcalino.
- Ayuda a interpretar resultados, redactar, organizar Excel/PDF y explicar calidad sensorial.

[CALIDAD DE RESPUESTA]
- 1 frase si fue una orden. Profundo solo si piden análisis.
- Sin markdown, sin listas forzosas, sin URLs largas en voz.
- Si una tool falló: dilo y propone alternativa.

[BUCLE]
THOUGHT → ACTION → OBSERVATION → (repite si hace falta) → respuesta final.
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
    case 'summarize_pdf':
      return runPythonTool('summarize_pdf', { path: params.path, max_pages: params.max_pages });
    case 'read_docx':
      return runPythonTool('read_docx', { path: params.path });
    case 'write_docx':
      return runPythonTool('write_docx', {
        path: params.path,
        title: params.title,
        body: params.body || params.content,
      });
    case 'write_pptx':
      return runPythonTool('write_pptx', {
        path: params.path,
        title: params.title,
        slides: params.slides,
      });
    case 'html_dashboard':
      return runPythonTool('html_dashboard', {
        path: params.path,
        title: params.title,
        data: params.data,
      });
    default:
      return baseExecute(name, params, helpers);
  }
}

function enrichSystemPrompt(base, userText) {
  let extra = REACT_ADDENDUM;
  try {
    const ctx = mem.buildContextSnippet(userText || '');
    if (ctx) extra += '\n\n[MEMORIA RELEVANTE]\n' + ctx;
  } catch {}
  try {
    const { toolsPromptSummary } = require('./tools-schema.cjs');
    if (typeof toolsPromptSummary === 'function') {
      extra += '\n\n' + toolsPromptSummary();
    }
  } catch {}
  return (base || '') + extra;
}

function noteInteraction(userText, reply) {
  try {
    if (userText && userText.length > 8) mem.addFact('Usuario: ' + String(userText).slice(0, 200));
    if (reply && reply.length > 12) mem.addFact('ELYRA: ' + String(reply).slice(0, 200));
  } catch {}
}

module.exports = {
  extendExecute,
  enrichSystemPrompt,
  noteInteraction,
  REACT_ADDENDUM,
};
