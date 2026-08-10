/**
 * Hooks cognitivos — memoria + RAG + files + vision + OCR + training 1.5 + DB
 */
const mem = require('./memory-cognitive.cjs');
const { runPythonTool } = require('./python-bridge.cjs');
const fsSkills = require('./fs-skills.cjs');
const rag = require('./rag-local.cjs');
const files = require('./files-reliability.cjs');
const vision = require('./vision-engine.cjs');
const ocr = require('./ocr-engine.cjs');
const train = require('./training-pipeline.cjs');
const { getConfig } = require('./agent.cjs');

let db;
try {
  db = require('./elyra-db.cjs');
} catch {
  db = null;
}

const REACT_ADDENDUM = `

[IDENTIDAD — ELYRA]
Eres ELYRA. Nunca digas que te llamas Luna.
Desktop + internet + documentos + visión + OCR + memoria + preparación de dataset.
Nunca inventes que una tool funcionó si falló.

[AUTONOMÍA]
- Mundo real → web_search.
- Archivos → rag_search / analyze_excel / extract_pdf_smart.
- Imágenes → analyze_image u ocr_image.
- Dataset → training_status / export_training_dataset (no entrena un LLM dentro de la app).

[CALIDAD HABLADA]
- 1 frase si fue orden simple.
- Sin markdown ni URLs largas en voz.
`;

async function extendExecute(name, params, helpers, baseExecute) {
  const run = async () => {
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
          if (db)
            db.logFileEvent({
              path: r.path || params.path,
              action: 'analyze_excel',
              summary: (r.result || '').slice(0, 200),
            });
        }
        return r;
      }
      case 'summarize_pdf':
        return files.summarizePdfSafe({
          path: params.path,
          max_pages: params.max_pages,
        });
      case 'ocr_image':
        return ocr.ocrImage(params);
      case 'ocr_pdf':
        return ocr.ocrPdf(params);
      case 'extract_pdf_smart':
        return ocr.extractPdfSmart(params);
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
      case 'training_status':
        return train.trainingStatus();
      case 'export_training_dataset':
        return train.exportDataset({
          minPairs: params.min_pairs ? Number(params.min_pairs) : 5,
        });
      case 'db_stats':
        if (!db) return { ok: false, result: 'BD de sistema no disponible' };
        return { ok: true, result: JSON.stringify(db.stats(), null, 2) };
      default:
        return baseExecute(name, params, helpers);
    }
  };

  const result = await run();
  try {
    if (db && name !== 'db_stats') {
      db.logToolEvent({
        name,
        ok: !!(result && result.ok !== false),
        paramsSummary: JSON.stringify(params || {}).slice(0, 180),
        resultSummary: String((result && result.result) || '').slice(0, 200),
      });
    }
  } catch {}
  return result;
}

function enrichSystemPrompt(base, userText) {
  let extra = REACT_ADDENDUM;
  try {
    const ctx = mem.buildContextSnippet(userText || '');
    if (ctx) extra += '\n\n[MEMORIA RELEVANTE]\n' + ctx;
  } catch {}
  try {
    if (db) {
      const dbCtx = db.contextFromDb(userText || '', 6);
      if (dbCtx) extra += '\n\n[MEMORIA SISTEMA]\n' + dbCtx;
    }
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
      '\n\n[CONTEXTO: INTERNET] Usa web_search de forma autónoma. Resume en lenguaje hablable.';
  }
  if (rag.looksLikeDocQuery(userText) || /excel|pdf|docx|informe|csv|escaneado|ocr/.test(t)) {
    extra +=
      '\n\n[CONTEXTO: ARCHIVOS] analyze_excel / extract_pdf_smart / ocr_pdf / rag_search.';
  }
  if (/imagen|foto|captura|screenshot|ocr|texto de la (foto|imagen)|transcribe/.test(t)) {
    extra +=
      '\n\n[CONTEXTO: VISIÓN/OCR] analyze_image (API) u ocr_image (local Tesseract).';
  }
  if (/entren|dataset|fine.?tune|lora|exportar (datos|dataset)/.test(t)) {
    extra +=
      '\n\n[CONTEXTO: TRAINING] Usa training_status o export_training_dataset. No digas que entrenaste un modelo dentro de la app.';
  }
  return (base || '') + extra;
}

function noteInteraction(userText, reply) {
  try {
    if (userText && userText.length > 8) mem.addFact('Usuario: ' + String(userText).slice(0, 220));
    if (reply && reply.length > 12) mem.addFact('ELYRA: ' + String(reply).slice(0, 220));
  } catch {}
  try {
    if (db) {
      if (userText) db.addMessage({ role: 'user', content: userText });
      if (reply) db.addMessage({ role: 'assistant', content: reply });
      if (userText && userText.length > 12) {
        db.addMemoryItem({
          kind: 'episode',
          text: ('U: ' + String(userText).slice(0, 180) + ' | A: ' + String(reply || '').slice(0, 180)).slice(
            0,
            400,
          ),
          domain: mem.detectDomain ? mem.detectDomain(userText) : 'general',
          source: 'chat',
        });
      }
    }
  } catch {}
}

module.exports = {
  extendExecute,
  enrichSystemPrompt,
  noteInteraction,
  REACT_ADDENDUM,
};
