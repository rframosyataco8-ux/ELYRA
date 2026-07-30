/**
 * Hooks cognitivos v2 — ReAct + personalidad de élite (nivel Claude/ChatGPT)
 */
const mem = require('./memory-cognitive.cjs');
const { runPythonTool } = require('./python-bridge.cjs');

const REACT_ADDENDUM = `

[IDENTIDAD]
Eres ELYRA, un asistente de escritorio de nivel profesional (calidad Claude / ChatGPT),
con control real del PC del usuario. No eres un bot de comandos: razonas, explicas y actúas.

[ESTILO]
- Español natural, claro y preciso. Como un colega brillante, no como un robot.
- Si la pregunta es de conocimiento: responde útil en 2-5 frases (o más si piden detalle).
- Si es acción (abrir, volumen, archivo): ejecuta y confirma en 1 frase.
- Nunca digas solo "No pude conectar ahora". Si falla una herramienta, explica qué falló y ofrece alternativa.
- Corrige errores de voz sin mencionarlos ("work"→Word).

[BUCLE ReAct — objetivos complejos]
1) THOUGHT: qué quiere, qué falta, qué tool.
2) ACTION: tools en cadena si hace falta.
3) OBSERVATION: si el resultado es pobre, corrige ANTES de la respuesta final.
4) Respuesta al usuario.

Ejemplos:
- "qué es Gemini" → explicar Google Gemini (IA de Google), no listar significados raros.
- "busca X" → web_search o open_url a Google; resume lo importante.
- "prepara un informe" → scan/analyze → write_docx / html_dashboard.
- "cómo va el sistema" → get_system_info.

Herramientas Python: scan_folder, analyze_excel, summarize_pdf, read_docx, write_docx, write_pptx, html_dashboard
`;

async function extendExecute(name, params, helpers, baseExecute) {
  switch (name) {
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
