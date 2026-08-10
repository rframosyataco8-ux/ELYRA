/**
 * ELYRA 1.2 — Multi-agent ligero
 *
 * Roles internos (un solo proceso, sin microservicios):
 *   PLANNER   → descompone la tarea en pasos
 *   RESEARCHER → web / RAG / archivos
 *   EXECUTOR  → tools de PC y productividad
 *   VERIFIER  → comprueba que el resultado sea usable
 *
 * No inventa APIs: reutiliza helpers, deepWebSearch, rag, files.
 */

const { deepWebSearch } = require('./web-search-boost.cjs');

function isComplexTask(text) {
  const t = String(text || '').toLowerCase();
  if (t.length < 12) return false;

  // Multi-paso explícito
  if (/\b(y luego|después|despues|además|ademas|también|tambien)\b/.test(t) && t.split(/\s+/).length > 8) {
    return true;
  }
  // Investigación + acción
  if (
    /\b(investiga|busca|resume|analiza|compara)\b/.test(t) &&
    /\b(abre|guarda|crea|genera|escribe|exporta|envía|envia)\b/.test(t)
  ) {
    return true;
  }
  // Informes / laboratorio multi-parte
  if (
    /\b(informe|reporte|dashboard|presentación|presentacion)\b/.test(t) &&
    /\b(excel|pdf|datos|cadmio|laboratorio|documentos)\b/.test(t)
  ) {
    return true;
  }
  // Lista de acciones
  if ((t.match(/\b(abre|busca|analiza|crea|guarda|resume)\b/g) || []).length >= 2) {
    return true;
  }
  return false;
}

/**
 * PLANNER — plan determinista (sin LLM obligatorio)
 */
function plan(userText) {
  const t = String(userText || '').toLowerCase();
  const steps = [];

  // 1. Búsqueda / investigación
  if (/\b(busca|investiga|qué es|que es|información|informacion|noticias|compara)\b/.test(t)) {
    let q = userText
      .replace(/\b(busca|buscar|buscame|investiga|información sobre|informacion sobre)\b/gi, ' ')
      .replace(/\b(y luego|después|despues).*$/i, '')
      .trim();
    if (q.length < 3) q = userText;
    steps.push({ role: 'researcher', action: 'web_search', query: q.slice(0, 200), label: 'Investigar' });
  }

  // 2. Documentos locales
  if (/\b(mis (documentos|informes|pdf|archivos)|rag|según el informe|segun el informe)\b/.test(t)) {
    steps.push({
      role: 'researcher',
      action: 'rag_search',
      query: userText.slice(0, 200),
      label: 'Consultar documentos',
    });
  }

  // 3. Excel
  if (/\b(excel|xlsx|csv|analiza.*(tabla|datos|hoja))\b/.test(t)) {
    const pathMatch = userText.match(/[\w\-./\\]+\.(xlsx|xls|csv)/i);
    steps.push({
      role: 'executor',
      action: 'analyze_excel',
      path: pathMatch ? pathMatch[0] : null,
      label: 'Analizar tabla',
    });
  }

  // 4. PDF
  if (/\b(pdf|resume.*(documento|pdf))\b/.test(t)) {
    const pathMatch = userText.match(/[\w\-./\\]+\.pdf/i);
    steps.push({
      role: 'executor',
      action: 'summarize_pdf',
      path: pathMatch ? pathMatch[0] : null,
      label: 'Leer PDF',
    });
  }

  // 5. Abrir app
  const openMatch = t.match(/\b(?:abre|abrir)\s+(?:el\s+|la\s+)?(chrome|word|excel|notepad|spotify|código|code|edge)/i);
  if (openMatch) {
    steps.push({
      role: 'executor',
      action: 'open_app',
      name: openMatch[1],
      label: 'Abrir ' + openMatch[1],
    });
  }

  // 6. Crear informe
  if (/\b(crea|genera|escribe|redacta)\b/.test(t) && /\b(informe|reporte|word|docx)\b/.test(t)) {
    steps.push({
      role: 'executor',
      action: 'write_docx',
      title: 'Informe ELYRA',
      label: 'Generar Word',
    });
  }

  // 7. Dashboard
  if (/\b(dashboard|html)\b/.test(t) && /\b(crea|genera)\b/.test(t)) {
    steps.push({
      role: 'executor',
      action: 'html_dashboard',
      title: 'Dashboard ELYRA',
      label: 'Generar dashboard',
    });
  }

  // Si no hubo pasos claros pero es complejo → investigar + sintetizar
  if (!steps.length) {
    steps.push({
      role: 'researcher',
      action: 'web_search',
      query: userText.slice(0, 200),
      label: 'Investigar tema',
    });
  }

  steps.push({ role: 'verifier', action: 'synthesize', label: 'Verificar y responder' });

  return {
    goal: String(userText).slice(0, 300),
    steps,
    planned_at: new Date().toISOString(),
  };
}

/**
 * RESEARCHER + EXECUTOR
 */
async function runStep(step, helpers, observations) {
  const { action } = step;

  try {
    if (action === 'web_search') {
      const deep = await deepWebSearch(step.query || '');
      return {
        ok: !!deep.ok,
        result: deep.response || deep.result || 'Sin resultados web',
        via: deep.source || 'web',
      };
    }

    if (action === 'rag_search' && helpers) {
      try {
        const rag = require('./rag-local.cjs');
        return await rag.searchDocs(step.query || '', 6);
      } catch (e) {
        return { ok: false, result: 'RAG no disponible: ' + e.message };
      }
    }

    if (action === 'analyze_excel' && helpers) {
      try {
        const files = require('./files-reliability.cjs');
        if (step.path) {
          return await files.analyzeExcelSafe({ path: step.path });
        }
        return {
          ok: false,
          result: 'Indica el nombre o ruta del Excel (Documentos/Informes).',
        };
      } catch (e) {
        return { ok: false, result: e.message };
      }
    }

    if (action === 'summarize_pdf' && helpers) {
      try {
        const files = require('./files-reliability.cjs');
        if (step.path) return await files.summarizePdfSafe({ path: step.path });
        return { ok: false, result: 'Falta ruta del PDF.' };
      } catch (e) {
        return { ok: false, result: e.message };
      }
    }

    if (action === 'open_app' && helpers && helpers.openApp) {
      const r = await helpers.openApp(step.name);
      return { ok: r.ok !== false, result: r.message || r.result || 'App abierta' };
    }

    if (action === 'write_docx' && helpers) {
      const { runPythonTool } = require('./python-bridge.cjs');
      const body = observations
        .filter((o) => o.result)
        .map((o) => o.result)
        .join('\n\n')
        .slice(0, 4000);
      return await runPythonTool('write_docx', {
        title: step.title || 'Informe ELYRA',
        body: body || 'Sin contenido recopilado.',
      });
    }

    if (action === 'html_dashboard' && helpers) {
      const { runPythonTool } = require('./python-bridge.cjs');
      const body = observations
        .filter((o) => o.result)
        .map((o) => '<p>' + String(o.result).slice(0, 800).replace(/</g, '') + '</p>')
        .join('\n');
      return await runPythonTool('html_dashboard', {
        title: step.title || 'Dashboard ELYRA',
        body: body || '<p>Sin datos</p>',
      });
    }

    if (action === 'synthesize') {
      return { ok: true, result: '__SYNTH__' };
    }

    return { ok: false, result: 'Paso no implementado: ' + action };
  } catch (e) {
    return { ok: false, result: e.message || String(e) };
  }
}

/**
 * VERIFIER — arma respuesta hablable
 */
function verifyAndSpeak(goal, observations) {
  const useful = observations.filter((o) => o.action !== 'synthesize' && o.result && o.result !== '__SYNTH__');
  const failed = useful.filter((o) => o.ok === false);
  const okOnes = useful.filter((o) => o.ok !== false);

  if (!okOnes.length && failed.length) {
    return {
      ok: false,
      response:
        'No pude completar la tarea: ' +
        failed
          .map((f) => f.label + ' — ' + String(f.result).slice(0, 120))
          .join('. '),
      via: 'multi-agent-fail',
    };
  }

  const parts = [];
  parts.push('Listo.');
  for (const o of okOnes.slice(0, 4)) {
    const snippet = String(o.result)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 280);
    if (snippet) parts.push(snippet);
  }
  if (failed.length) {
    parts.push(
      'Pendiente: ' + failed.map((f) => f.label).join(', ') + '.',
    );
  }

  let response = parts.join(' ');
  if (response.length > 700) {
    response = response.slice(0, 680).replace(/\s+\S*$/, '') + '.';
  }

  return {
    ok: true,
    response,
    intelligent: true,
    via: 'multi-agent',
    plan_steps: observations.map((o) => o.label || o.action),
  };
}

/**
 * Orquestación completa
 */
async function runMultiAgent(userText, helpers) {
  const planned = plan(userText);
  const observations = [];

  try {
    const db = require('./elyra-db.cjs');
    db.logAudit('multi_agent_plan', planned.goal.slice(0, 200));
  } catch {}

  for (const step of planned.steps) {
    if (step.action === 'synthesize') {
      observations.push({ ...step, ok: true, result: '__SYNTH__' });
      continue;
    }
    const out = await runStep(step, helpers, observations);
    observations.push({
      ...step,
      ok: out.ok !== false,
      result: out.result,
      via: out.via,
    });
  }

  const final = verifyAndSpeak(planned.goal, observations);

  try {
    const db = require('./elyra-db.cjs');
    db.logToolEvent({
      name: 'multi_agent',
      ok: final.ok,
      paramsSummary: planned.goal.slice(0, 150),
      resultSummary: String(final.response || '').slice(0, 200),
    });
  } catch {}

  return final;
}

module.exports = {
  isComplexTask,
  plan,
  runMultiAgent,
  verifyAndSpeak,
};
