/**
 * Router ELYRA v7 — skills + apertura inteligente + excel en contexto
 */
const os = require('os');
const { smartKnowledge } = require('./smart-knowledge.cjs');
const { applyTypos, parseCompound, cleanOpenName } = require('./intent-compound.cjs');
const { trySkillIntent } = require('./skills-router.cjs');
const { resolveOpenExcelPath } = require('./open-excel-context.cjs');

const PRESENCE_REPLIES = [
  'Sí, señor. Estoy aquí.',
  'Online. ¿En qué le ayudo?',
  'Presente. Diga.',
  'Sistemas operativos. Le escucho.',
  'Aquí estoy. ¿Qué necesita?',
];

function pickPresence() {
  return PRESENCE_REPLIES[Math.floor(Math.random() * PRESENCE_REPLIES.length)];
}

async function routeChat({
  message,
  history,
  helpers,
  runAgent,
  getConfig,
  fallbackResponse,
  normalizeUserIntent,
  chatOpenClaw,
  getOpenClawConfig,
  pc,
  getSystemStats,
}) {
  const fixed =
    typeof normalizeUserIntent === 'function' ? normalizeUserIntent(message) : message;
  let text = applyTypos((fixed || '').toLowerCase().trim());

  text = text
    .replace(/\b(hey\s+)?(elyra|elira|eliara)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    !text ||
    /^(estas ahi|estás ahí|estas alli|me escuchas|hola|oye|hey|buenos dias|buenas tardes|buenas noches)$/i.test(
      text,
    )
  ) {
    return { response: pickPresence(), intelligent: true, via: 'presence' };
  }

  try {
    const skill = await trySkillIntent(text);
    if (skill) return skill;
  } catch {}

  const quick = await tryLocal(text, helpers, pc, getSystemStats);
  if (quick) return quick;

  try {
    const oc = getOpenClawConfig && getOpenClawConfig();
    if (oc?.enabled && chatOpenClaw) {
      const ocRes = await chatOpenClaw(fixed, history || []);
      if (ocRes.ok && ocRes.response) {
        return { response: ocRes.response, intelligent: true, via: 'openclaw' };
      }
    }
  } catch {}

  const config = getConfig();
  if (!config.apiKey) {
    const sk = await trySmartTopic(fixed, text);
    if (sk) return sk;
    return (
      fallbackResponse?.(message) || {
        response:
          'No hay API key. En Configuración puede añadirla para razonamiento avanzado. El control del PC y archivos ya funcionan.',
        intelligent: false,
      }
    );
  }

  try {
    const result = await runAgent(fixed, history || [], helpers);
    const resp = result?.response || '';

    if (/api key no es válida|no hay api key|falta la api|no pude conectar|401|unauthorized/i.test(resp)) {
      const sk = await trySmartTopic(fixed, text);
      if (sk) {
        return {
          response: sk.response + ' (Modo local: la API no respondió.)',
          intelligent: true,
          via: 'smart-fallback',
        };
      }
      return {
        response:
          resp.includes('API') || resp.includes('key')
            ? resp
            : 'El modelo no respondió. Revisa la API key. Sigo con el PC y archivos.',
        intelligent: false,
        via: 'error',
      };
    }

    return { response: resp, intelligent: true, via: 'llm' };
  } catch (err) {
    const msg = String(err.message || err);
    if (/429|rate limit/i.test(msg)) {
      const sk = await trySmartTopic(fixed, text);
      if (sk) return { ...sk, via: 'smart-ratelimit' };
      return {
        response: 'El servicio de IA está saturado un momento. Intente de nuevo en unos segundos.',
        intelligent: false,
      };
    }
    const sk = await trySmartTopic(fixed, text);
    if (sk) return { ...sk, via: 'smart-error' };
    return {
      response: 'Problema con el modelo. Sigo operativa para el sistema y archivos.',
      intelligent: false,
    };
  }
}

async function trySmartTopic(fixed, text) {
  let topic = null;
  const patterns = [
    /(?:dime|cuéntame|cuentame|explícame|explicame|qué sabes|que sabes)\s+(?:sobre|de|acerca de)\s+(.+)/i,
    /(?:qué es|que es|quién es|quien es)\s+(.+)/i,
    /(?:busca|buscar|buscame|investiga)\s+(?:información\s+)?(?:sobre\s+)?(.+)/i,
    /(?:la\s+)?ia\s+de\s+(.+)/i,
    /^(gemini|chatgpt|claude|python|javascript|react)(?:\s+google)?$/i,
  ];
  for (const re of patterns) {
    const m = String(fixed).match(re) || text.match(re);
    if (m && m[1]) {
      topic = m[1].replace(/[?.!]+$/, '').trim();
      break;
    }
  }
  if (!topic && text.split(/\s+/).length <= 4 && !/\b(abre|abrir|volumen|brillo)\b/.test(text)) {
    if (/gemini|chatgpt|claude|python|openai|groq|llama/.test(text)) topic = text;
  }
  if (!topic || topic.length < 2) return null;
  const sk = await smartKnowledge(topic);
  if (sk.ok) return { response: sk.response, intelligent: true, via: sk.source || 'smart' };
  return null;
}

async function tryAnalyzeOpenExcel(helpers) {
  try {
    const found = await resolveOpenExcelPath();
    if (!found.ok || !found.path) {
      return {
        response:
          found.result ||
          'No localicé un Excel reciente. Abre el archivo o dime la ruta (por ejemplo en Documentos).',
        intelligent: true,
        via: 'excel-miss',
      };
    }
    // Usa tool Python si está disponible vía agent hooks helpers
    if (helpers.runPythonTool) {
      const r = await helpers.runPythonTool('analyze_excel', { path: found.path });
      if (r.ok) {
        return {
          response: 'Analicé «' + found.name + '»:\n' + String(r.result || '').slice(0, 1200),
          intelligent: true,
          via: 'excel-open',
        };
      }
    }
    // Fallback: pedir al agente con path inyectado no siempre disponible — mensaje útil
    return {
      response:
        'Encontré el archivo «' +
        found.name +
        '» en ' +
        found.path +
        '. Dime «analiza este excel: ' +
        found.path +
        '» o ábrelo desde Documentos si quieres más detalle.',
      intelligent: true,
      via: 'excel-path',
    };
  } catch (e) {
    return {
      response: 'No pude inspeccionar Excel ahora (' + (e.message || 'error') + ').',
      intelligent: false,
    };
  }
}

async function tryLocal(text, helpers, pc, getSystemStats) {
  if (/\b(qué recuerdas|que recuerdas|dime (todo )?lo que recuerdas|tu memoria)\b/.test(text)) {
    const r = await helpers.recall();
    return { response: r.result, intelligent: false };
  }
  const rememberMatch = text.match(/\b(?:recuerda|anota|guarda|no olvides)\s+(?:que\s+)?(.+)/i);
  if (rememberMatch) {
    await helpers.remember(rememberMatch[1].trim());
    return { response: 'Anotado, señor.', intelligent: false };
  }

  // Excel abierto / reciente
  if (
    /\b(analiza|analizar|resume|resumen|dime qué|dime que)\b/.test(text) &&
    /\b(excel|xlsx|hoja|archivo)\b/.test(text)
  ) {
    return tryAnalyzeOpenExcel(helpers);
  }

  if (
    /\b(cómo va|como va|como esta|cómo está|estado del|estado de)\s+(el\s+)?(sistema|pc|equipo)\b/.test(
      text,
    ) ||
    /\b(estado del sistema|cómo está el pc|como esta el pc|diagnóstico|diagnostico)\b/.test(text)
  ) {
    try {
      const s = getSystemStats ? await getSystemStats() : null;
      if (s) {
        return {
          response:
            'Diagnóstico: CPU ' +
            s.cpu +
            '%, memoria ' +
            s.ram +
            '%, disco ' +
            s.disk +
            '%. Equipo ' +
            (s.hostname || os.hostname()) +
            '.',
          intelligent: false,
          via: 'local-stats',
        };
      }
    } catch {}
    return {
      response:
        'Sistemas operativos. ' +
        os.hostname() +
        ', ' +
        Math.round(os.totalmem() / 1e9) +
        ' GB de RAM.',
      intelligent: false,
    };
  }

  if (/\b(administrador de tareas|task ?manager|gestor de tareas)\b/.test(text)) {
    if (pc.openTaskManager) {
      const r = await pc.openTaskManager();
      return { response: r.result || 'Administrador de tareas abierto.', intelligent: false };
    }
  }
  if (/\b(limpia|limpiar)\s+(los\s+)?temporales\b/.test(text) || /\bvacia temporales\b/.test(text)) {
    if (pc.emptyTemp) {
      const r = await pc.emptyTemp();
      return { response: r.result, intelligent: false };
    }
  }
  if (/\b(estado (del )?wifi|wifi status)\b/.test(text) && pc.wifiStatus) {
    const r = await pc.wifiStatus();
    return { response: (r.result || '').slice(0, 400), intelligent: false };
  }
  if (/\b(activa|activar|enciende|encender)\s+(el\s+)?wifi\b/.test(text) && pc.setWifi) {
    const r = await pc.setWifi(true);
    return { response: r.result, intelligent: false };
  }
  if (/\b(desactiva|desactivar|apaga|apagar)\s+(el\s+)?wifi\b/.test(text) && pc.setWifi) {
    const r = await pc.setWifi(false);
    return { response: r.result, intelligent: false };
  }
  if ((/\b(flush|vacía|vacia)\s+dns\b/.test(text) || /\blimpia (la )?dns\b/.test(text)) && pc.flushDns) {
    const r = await pc.flushDns();
    return { response: r.result, intelligent: false };
  }
  if (/\b(qué ventanas|que ventanas|ventanas abiertas)\b/.test(text) && pc.listWindows) {
    const r = await pc.listWindows();
    return { response: (r.result || 'Sin datos').slice(0, 500), intelligent: false };
  }

  const compound = parseCompound(text);
  if (compound?.type === 'compound_search') {
    await helpers.openApp(compound.browser || 'chrome');
    await helpers.openUrl('https://www.google.com/search?q=' + encodeURIComponent(compound.query));
    const sk = await smartKnowledge(compound.query);
    if (sk.ok) {
      return {
        response: 'Hecho. ' + sk.response.slice(0, 400),
        intelligent: true,
        via: 'compound+smart',
      };
    }
    return {
      response: 'Abrí el navegador con la búsqueda de "' + compound.query + '".',
      intelligent: false,
    };
  }

  if (compound?.type === 'google_search') {
    const sk = await smartKnowledge(compound.query);
    if (sk.ok) return { response: sk.response, intelligent: true, via: sk.source };
    await helpers.openUrl('https://www.google.com/search?q=' + encodeURIComponent(compound.query));
    return {
      response: 'Abrí Google con "' + compound.query + '".',
      intelligent: false,
    };
  }

  if (/\b(sube|subir)\s+(el\s+)?volumen\b/.test(text)) {
    const r = await pc.volume('up');
    return { response: r.result, intelligent: false };
  }
  if (/\b(baja|bajar)\s+(el\s+)?volumen\b/.test(text)) {
    const r = await pc.volume('down');
    return { response: r.result, intelligent: false };
  }
  if (/\b(silencia|mute|silencio)\b/.test(text)) {
    const r = await pc.volume('mute');
    return { response: r.result, intelligent: false };
  }
  if (/\b(sube|subir)\s+(el\s+)?brillo\b/.test(text)) {
    const r = await pc.brightness('up');
    return { response: r.result, intelligent: false };
  }
  if (/\b(baja|bajar)\s+(el\s+)?brillo\b/.test(text)) {
    const r = await pc.brightness('down');
    return { response: r.result, intelligent: false };
  }
  if (/\b(captura|screenshot)\b/.test(text)) {
    const r = await pc.screenshot();
    return { response: r.result, intelligent: false };
  }
  if (/\b(bloquea|bloquear)\s+(la\s+)?(sesión|pc|pantalla)\b/.test(text)) {
    const r = await pc.windows('lock');
    return { response: r.result, intelligent: false };
  }
  if (/\b(minimiza|minimizar)\s+(todas|ventanas|todo)\b/.test(text) || /\bmostrar escritorio\b/.test(text)) {
    const r = await pc.windows('minimize_all');
    return { response: r.result, intelligent: false };
  }
  if (/\b(batería|bateria)\b/.test(text)) {
    const r = await pc.battery();
    return { response: r.result, intelligent: false };
  }
  if (/\b(vacía|vacia|vaciar)\s+(la\s+)?papelera\b/.test(text)) {
    const r = await pc.emptyRecycle();
    return { response: r.result, intelligent: false };
  }
  if (/\b(apaga|apagar)\s+(el\s+)?(pc|equipo)\b/.test(text) && !/pantalla/.test(text)) {
    const r = await pc.power('shutdown', 1);
    return { response: r.result, intelligent: false };
  }
  if (/\b(reinicia|reiniciar)\b/.test(text)) {
    const r = await pc.power('restart', 1);
    return { response: r.result, intelligent: false };
  }

  const skEarly = await trySmartTopic(text, text);
  if (
    skEarly &&
    (/\b(qué es|que es|quién|quien|ia de|inteligencia)\b/.test(text) ||
      /^(gemini|chatgpt|claude)/.test(text))
  ) {
    return skEarly;
  }

  const openMatch = text.match(
    /\b(?:abre|abrir|lanza|ejecuta|abreme|abrime)\s+(?:el\s+|la\s+|los\s+|las\s+)?(.+)/i,
  );
  if (openMatch || /\b(abre|abrir)\b/.test(text)) {
    const folderKeys = ['documentos', 'descargas', 'escritorio', 'informes', 'imagenes', 'musica', 'videos'];
    for (const f of folderKeys) {
      if (text.includes(f)) {
        const r = await helpers.openFolder(f);
        return { response: r.message || r.result, intelligent: false };
      }
    }
    // Pasar la frase completa al motor de apps (papelera, lenovo vantage, bluestacks en la web…)
    let name = openMatch ? openMatch[1].trim() : '';
    name = cleanOpenName(name) || name;
    if (!name) {
      const candidates = [
        'youtube',
        'google',
        'gmail',
        'word',
        'excel',
        'chrome',
        'edge',
        'notepad',
        'calculadora',
        'spotify',
        'discord',
        'code',
        'firefox',
        'powerpoint',
        'chatgpt',
        'gemini',
        'claude',
        'papelera',
        'bluestacks',
      ];
      for (const app of candidates) {
        if (new RegExp('\\b' + app + '\\b', 'i').test(text)) {
          name = app;
          break;
        }
      }
    }
    // Si el usuario escribió «en la web», conservar esa intención
    if (/\ben\s+(la\s+)?web\b/i.test(text) && name && !/\ben\s+(la\s+)?web\b/i.test(name)) {
      name = name + ' en la web';
    }
    if (name) {
      const r = await helpers.openApp(name);
      return { response: r.message || r.result, intelligent: false, via: 'open-app' };
    }
  }

  if (/\b(qué hora|que hora|hora es)\b/.test(text)) {
    return {
      response:
        'Son las ' +
        new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) +
        '.',
      intelligent: false,
    };
  }
  if (/\b(qué día|que dia|fecha de hoy)\b/.test(text)) {
    return {
      response:
        'Hoy es ' +
        new Date().toLocaleDateString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }) +
        '.',
      intelligent: false,
    };
  }

  return null;
}

module.exports = { routeChat };
