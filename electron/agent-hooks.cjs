/**
 * Hooks cognitivos v4 — ReAct + memoria + dominio laboratorio
 */
const mem = require('./memory-cognitive.cjs');
const { runPythonTool } = require('./python-bridge.cjs');
const fsSkills = require('./fs-skills.cjs');

const REACT_ADDENDUM = `

[IDENTIDAD]
Eres ELYRA: asistente de escritorio y apoyo de laboratorio (cacao, cadmio, plaguicidas, AFQ).
Controlas el PC de verdad. No inventes resultados de herramientas.

[INTELIGENCIA]
- Antes de actuar: entiende la intención real (incluso con errores de voz u ortografía).
- Si la tarea tiene varios pasos, encaena herramientas y solo al final resume en lenguaje humano.
- Usa recall cuando el usuario diga "lo de siempre", "como la vez pasada" o mencione preferencias.
- Si falta un dato crítico (ruta, nombre de archivo), pregunta una sola cosa concreta; si puedes asumir algo razonable, avanza.
- Diferencia charla casual vs. pedido de acción: no abras apps si solo preguntan algo.

[DOMINIO LABORATORIO]
- Cadmio y Plaguicidas / AFQ: productos de cacao (torta, grano, licor, manteca, cocoa, % grasa, NIRS).
- Registro de prensa: datos y dashboard operativos.
- Puedes ayudar a interpretar, redactar informes, organizar Excel/PDF y explicar conceptos de calidad.

[ESTILO]
- Español latino natural, como un colega muy competente.
- Confirmaciones de acción en 1 frase. Explicaciones densas solo si las piden.
- Sin markdown pesado ni rutas largas en voz.

[BUCLE]
THOUGHT → ACTION (tools) → OBSERVATION → respuesta final hablable.
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
  let extra = '';
  const u = (userMessage || '').toLowerCase();
  if (/cadmio|plaguicid|afq|cacao|torta|licor|manteca|prensa|laboratorio|nirs|grasa/i.test(u)) {
    extra +=
      '\n[CONTEXTO] El usuario habla de laboratorio/cacao. Sé precisa, práctica y orientada a datos o acciones útiles.\n';
  }
  if (/abre|abrir|volumen|captura|cierra|mata|proceso/i.test(u)) {
    extra += '\n[CONTEXTO] Prioriza herramientas de PC y confirma el resultado en una frase.\n';
  }
  return basePrompt + REACT_ADDENDUM + extra + mem.buildMemoryBlock(userMessage);
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
