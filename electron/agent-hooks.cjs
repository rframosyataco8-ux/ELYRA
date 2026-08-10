/**
 * Hooks cognitivos — ReAct + memoria + web + RAG + files + vision 0.8
 */
const mem = require('./memory-cognitive.cjs');
const { runPythonTool } = require('./python-bridge.cjs');
const fsSkills = require('./fs-skills.cjs');
const rag = require('./rag-local.cjs');
const files = require('./files-reliability.cjs');
const vision = require('./vision-engine.cjs');
const { getConfig } = require('./agent.cjs');

const REACT_ADDENDUM = `

[IDENTIDAD — ELYRA]
Eres ELYRA. Nunca digas que te llamas Luna.
Control real del escritorio + internet + documentos + visión de imágenes + laboratorio.
Nunca inventes que una tool funcionó si falló.

[AUTONOMÍA]
- Mundo real → web_search.
- Archivos → rag_search / analyze_excel / summarize_pdf / read_docx.
- Imágenes → analyze_image o analyze_screenshot.
- Encadena tools hasta terminar.

[CÓMO PENSAR]
THOUGHT → ACTION → OBSERVATION → respuesta hablable.
- work=Word, crhome=Chrome, elira/eliara=ELYRA.

[CALIDAD HABLADA]
- 1 frase si fue orden simple.
- Sin markdown ni URLs largas en voz.
- Si una tool falló: dilo y propone alternativa.
`;

async function extendExecute(name, params, helpers, baseExecute) {
  switch (name) {
    case 'rag_search':
      return rag.searchDocs(params.query || params.q || '', params.limit);
    case 'reindex_docs':
      return rag.buildIndex({ force: params.force === true || params.force === 'true' });
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
    case 'files_health':
    case 'python_health':
      return files.pythonHealth();
    case 'analyze_excel': {
      const r = await files.analyzeExcelSafe({
        path: params.path,
        export: params.export,
        sheet: params.sheet,
      });
      if (r.ok && (r.path || params.path)) {
        mem.noteFile(r.path || params.path, (r.result || '').slice(0, 200));
      }
      return r;
    }
    case 'summarize_pdf':
      return files.summarizePdfSafe({
        path: params.path,
        max_pages: params.max_pages,
      });
    case 'read_docx':
      return files.readDocxSafe({ path: params.path });
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
        body: params.body || params.data,
      });
    case 'analyze_image': {
      const cfg = getConfig();
      return vision.analyzeImage(
        {
          path: params.path || params.file || params.image,
          dataUrl: params.dataUrl,
          prompt: params.prompt || params.question || params.query,
          detail: params.detail,
        },
        cfg,
      );
    }
    case 'analyze_screenshot': {
      const cfg = getConfig();
      return vision.analyzeScreenshot(
        params.prompt || params.question || 'Describe esta captura de pantalla en español.',
        helpers,
        cfg,
      );
    }
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
    if (rag.looksLikeDocQuery(userText)) {
      const block = rag.buildRagBlock(userText || '');
      if (block) extra += block;
    }
  } catch {}
  try {
    const { toolsPromptSummary } = require('./tools-schema.cjs');
    if (typeof toolsPromptSummary === 'function') {
      extra += '\n\n[HERRAMIENTAS]\n' + toolsPromptSummary();
    }
  } catch {}
  const t = String(userText || '').toLowerCase();
  if (/cadmio|cacao|afq|plaguicid|laboratorio|nirs|manteca|licor/.test(t)) {
    extra += '\n\n[CONTEXTO: LABORATORIO] Precisión técnica y claridad operativa.';
  }
  if (/abre|abrir|cierra|volumen|captura|proceso|ventana|chrome|excel|word/.test(t)) {
    extra += '\n\n[CONTEXTO: CONTROL PC] Ejecuta tools y confirma en pasado natural.';
  }
  if (/qué|quien|cómo|historia|guerra|explica|por qué|significa|noticias|actualidad|cuándo|cuando/.test(t)) {
    extra +=
      '\n\n[CONTEXTO: INTERNET] Usa web_search de forma autónoma. Resume en lenguaje hablable. No inventes.';
  }
  if (rag.looksLikeDocQuery(userText) || /excel|pdf|docx|informe|csv/.test(t)) {
    extra +=
      '\n\n[CONTEXTO: ARCHIVOS] Usa analyze_excel / summarize_pdf / read_docx / rag_search.';
  }
  if (/imagen|foto|captura|screenshot|pantalla|describe.*\.(png|jpg|jpeg|webp)|qué ves|que ves|analiza la (foto|imagen)/.test(t)) {
    extra +=
      '\n\n[CONTEXTO: VISIÓN] Usa analyze_image (path) o analyze_screenshot. Requiere modelo multimodal en Configuración.';
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
