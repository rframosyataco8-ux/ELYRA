/**
 * Hooks cognitivos — se inyectan en agent sin reescribir todo el archivo.
 */
const path = require('path');
const mem = require('./memory-cognitive.cjs');
const { runPythonTool } = require('./python-bridge.cjs');

const REACT_ADDENDUM = `

[BUCLE COGNITIVO ReAct — OBLIGATORIO EN OBJETIVOS COMPLEJOS]
No eres un ejecutor de comandos sueltos. Interpretas OBJETIVOS.
Para tareas multi-paso (informes, reuniones, análisis de archivos):
1) THOUGHT: qué quiere el usuario, qué falta, qué herramientas usar.
2) ACTION: invoca herramientas (pueden ser varias en cadena).
3) OBSERVATION: evalúa el resultado. Si es pobre o incompleto, corrige con otra ACTION antes de la respuesta final.
4) Solo entonces responde al usuario en 1-3 frases (voz).

Ejemplos de autonomía:
- "Prepara la reunión de fin de mes" → scan_folder → analyze_excel / summarize_pdf → write_docx y/o write_pptx y/o html_dashboard.
- "Analiza este Excel y dame un resumen" → analyze_excel → write_docx o create_html_report.
- Preferencias del usuario están en [MEMORIA CONTEXTUAL]; úsalas.

Herramientas de productividad (Python):
scan_folder, analyze_excel, summarize_pdf, read_docx, write_docx, write_pptx, html_dashboard
`;

async function extendExecute(name, params, helpers, baseExecute) {
  switch (name) {
    case 'scan_folder':
      return runPythonTool('scan_folder', {
        root: params.root,
        pattern: params.pattern,
      });
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
