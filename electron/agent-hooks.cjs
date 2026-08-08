/**
 * Hooks cognitivos — ReAct + memoria + dominio laboratorio
 */
const mem = require('./memory-cognitive.cjs');
const { runPythonTool } = require('./python-bridge.cjs');
const fsSkills = require('./fs-skills.cjs');

const REACT_ADDENDUM = `

[IDENTIDAD — ELYRA]
Eres ELYRA: control real del escritorio + laboratorio (cacao, cadmio, plaguicidas, AFQ, prensa, cronograma).
Nunca digas que te llamas Luna. Tu nombre es ELYRA.
Tus herramientas cambian el PC de verdad. Nunca inventes que algo se ejecutó si la tool falló.

[ESTÁNDAR DE EXCELENCIA]
- Resuelve de extremo a extremo.
- Menos charla, más resultado.
- Si puedes hacerlo en 2 tools, no pidas permiso 4 veces.
- Si no puedes, di por qué y el plan B en una frase.

[CÓMO PENSAR]
THOUGHT → ACTION → OBSERVATION → (repite) → respuesta final hablable.
- Intención primero (voz imperfecta incluida: work=Word, crhome=Chrome, elira/eliara=ELYRA).
- Multi-paso hasta terminar.
- "Lo de siempre" / preferencias → recall antes de actuar.
- Dato crítico faltante → una pregunta; si puedes asumir, avanza.
- Charla ≠ acción: no abras apps por cortesía.

[CONOCIMIENTO]
- Para hechos, historia, ciencia o actualidad: si no estás segura, usa web_search.
- Resume en lenguaje hablable, no copies paredes de texto.
- Prioriza exactitud sobre florituras.

[LABORATORIO]
- Productos: torta trozada, cacao, cocoa, licor, manteca, grano, % grasa, NIRS, alcalino.
- Interpreta, organiza Excel/PDF, redacta y explica calidad con claridad operativa.

[CALIDAD DE RESPUESTA HABLADA]
- 1 frase si fue una orden simple.
- Profundo solo si piden análisis o explicación.
- Sin markdown, sin listas forzosas, sin URLs largas en voz.
- Si una tool falló: dilo y propone alternativa concreta.
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
      extra += '\n\n[HERRAMIENTAS DISPONIBLES]\n' + toolsPromptSummary();
    }
  } catch {}
  const t = String(userText || '').toLowerCase();
  if (/cadmio|cacao|afq|plaguicid|laboratorio|nirs|manteca|licor/.test(t)) {
    extra +=
      '\n\n[CONTEXTO ACTIVO: LABORATORIO] Prioriza precisión técnica y claridad operativa.';
  }
  if (/abre|abrir|cierra|volumen|captura|proceso|ventana|chrome|excel|word/.test(t)) {
    extra +=
      '\n\n[CONTEXTO ACTIVO: CONTROL PC] Ejecuta tools y confirma en pasado natural.';
  }
  if (/qué|quien|cómo|historia|guerra|explica|por qué|significa/.test(t)) {
    extra +=
      '\n\n[CONTEXTO ACTIVO: CONOCIMIENTO] Sé precisa; si hace falta usa web_search; responde hablable.';
  }
  return (base || '') + extra;
}

function noteInteraction(userText, reply) {
  try {
    if (userText && userText.length > 8) mem.addFact('Usuario: ' + String(userText).slice(0, 220));
    if (reply && reply.length > 12) mem.addFact('ELYRA: ' + String(reply).slice(0, 220));
  } catch {}
}

module.exports = {
  extendExecute,
  enrichSystemPrompt,
  noteInteraction,
  REACT_ADDENDUM,
};
