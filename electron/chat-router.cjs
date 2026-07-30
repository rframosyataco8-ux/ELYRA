/**
 * Router de conversación ELYRA v4 — decide local / knowledge / LLM
 */
const os = require('os');
const { smartKnowledge } = require('./smart-knowledge.cjs');
const { applyTypos, parseCompound, cleanOpenName } = require('./intent-compound.cjs');

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
  const text = applyTypos((fixed || '').toLowerCase().trim());

  // —— 1. Intents locales de alta prioridad ——
  const quick = await tryLocal(text, helpers, pc, getSystemStats);
  if (quick) return quick;

  // —— 2. OpenClaw opcional ——
  try {
    const oc = getOpenClawConfig && getOpenClawConfig();
    if (oc?.enabled && chatOpenClaw) {
      const ocRes = await chatOpenClaw(fixed, history || []);
      if (ocRes.ok && ocRes.response) {
        return { response: ocRes.response, intelligent: true, via: 'openclaw' };
      }
    }
  } catch {}

  // —— 3. LLM con fallback inteligente ——
  const config = getConfig();
  if (!config.apiKey) {
    const sk = await trySmartTopic(fixed, text);
    if (sk) return sk;
    return (
      fallbackResponse?.(message) || {
        response:
          'No hay API key. Ve a Configuración, pega tu clave Groq (gsk_…) y pulsa Probar conexión.',
        intelligent: false,
      }
    );
  }

  try {
    const result = await runAgent(fixed, history || [], helpers);
    const resp = result?.response || '';

    if (/api key no es válida|no hay api key|falta la api|no pude conectar|límite de uso|401|unauthorized/i.test(resp)) {
      const sk = await trySmartTopic(fixed, text);
      if (sk) {
        return {
          response: sk.response + ' (Respondí con conocimiento local porque la API falló. Revisa la key en Configuración.)',
          intelligent: true,
          via: 'smart-fallback',
        };
      }
      return {
        response:
          resp.includes('API') || resp.includes('key')
            ? resp
            : 'No pude usar el modelo de IA. Revisa tu API key en Configuración y pulsa Probar conexión. Mientras tanto puedo abrir apps y buscar en la web.',
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
      return { response: 'El servicio de IA está saturado un momento. Intenta de nuevo en unos segundos.', intelligent: false };
    }
    const sk = await trySmartTopic(fixed, text);
    if (sk) return { ...sk, via: 'smart-error' };
    return {
      response:
        'Hubo un problema al contactar el modelo (' +
        msg.slice(0, 80) +
        '). Revisa internet y la API key. Puedo seguir abriendo apps y controlando el PC.',
      intelligent: false,
    };
  }
}

async function trySmartTopic(fixed, text) {
  // Extraer tema de conocimiento
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
  // Frases cortas tipo "gemini google"
  if (!topic && text.split(/\s+/).length <= 4 && !/\b(abre|abrir|volumen|brillo)\b/.test(text)) {
    if (/gemini|chatgpt|claude|python|openai|groq|llama/.test(text)) topic = text;
  }
  if (!topic || topic.length < 2) return null;
  const sk = await smartKnowledge(topic);
  if (sk.ok) return { response: sk.response, intelligent: true, via: sk.source || 'smart' };
  return null;
}

async function tryLocal(text, helpers, pc, getSystemStats) {
  // Memoria
  if (/\b(qué recuerdas|que recuerdas|dime (todo )?lo que recuerdas|tu memoria)\b/.test(text)) {
    const r = await helpers.recall();
    return { response: r.result, intelligent: false };
  }
  const rememberMatch = text.match(/\b(?:recuerda|anota|guarda|no olvides)\s+(?:que\s+)?(.+)/i);
  if (rememberMatch) {
    await helpers.remember(rememberMatch[1].trim());
    return { response: 'Listo, lo guardé en mi memoria.', intelligent: false };
  }

  // Estado del sistema (sin LLM)
  if (
    /\b(cómo va|como va|estado del|estado de)\s+(el\s+)?(sistema|pc|equipo)\b/.test(text) ||
    /\b(estado del sistema|cómo está el pc|como esta el pc)\b/.test(text)
  ) {
    try {
      const s = getSystemStats ? await getSystemStats() : null;
      if (s) {
        return {
          response:
            'Sistema operativo. CPU al ' +
            s.cpu +
            '%, RAM al ' +
            s.ram +
            '%, disco al ' +
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
        'Sistemas operativos. Equipo ' +
        os.hostname() +
        ', ' +
        Math.round(os.totalmem() / 1e9) +
        ' GB de RAM total.',
      intelligent: false,
    };
  }

  // Compuesto abre + busca
  const compound = parseCompound(text);
  if (compound?.type === 'compound_search') {
    await helpers.openApp(compound.browser || 'chrome');
    await helpers.openUrl('https://www.google.com/search?q=' + encodeURIComponent(compound.query));
    // Además resumen inteligente si es tema conocido
    const sk = await smartKnowledge(compound.query);
    if (sk.ok) {
      return {
        response: 'Abrí la búsqueda de "' + compound.query + '". ' + sk.response.slice(0, 400),
        intelligent: true,
        via: 'compound+smart',
      };
    }
    return {
      response: 'Abrí Chrome y busqué "' + compound.query + '".',
      intelligent: false,
    };
  }

  // "busca X" → conocimiento inteligente primero (no solo Google)
  if (compound?.type === 'google_search') {
    const sk = await smartKnowledge(compound.query);
    if (sk.ok) {
      return { response: sk.response, intelligent: true, via: sk.source };
    }
    await helpers.openUrl('https://www.google.com/search?q=' + encodeURIComponent(compound.query));
    return {
      response: 'No tuve un resumen listo; abrí Google con "' + compound.query + '".',
      intelligent: false,
    };
  }

  // Volumen / brillo / media / captura…
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

  // Conocimiento explícito (qué es / la ia de…)
  const skEarly = await trySmartTopic(text, text);
  if (skEarly && (/\b(qué es|que es|quién|quien|ia de|inteligencia)\b/.test(text) || /^(gemini|chatgpt|claude)/.test(text))) {
    return skEarly;
  }

  // Abrir apps
  const openMatch = text.match(
    /\b(?:abre|abrir|lanza|ejecuta)\s+(?:el\s+|la\s+|los\s+|las\s+)?(.+)/i,
  );
  if (openMatch || /\b(abre|abrir)\b/.test(text)) {
    const folderKeys = ['documentos', 'descargas', 'escritorio', 'informes', 'imagenes', 'musica', 'videos'];
    for (const f of folderKeys) {
      if (text.includes(f)) {
        const r = await helpers.openFolder(f);
        return { response: r.message || r.result, intelligent: false };
      }
    }
    let name = cleanOpenName(openMatch ? openMatch[1] : '');
    if (!name) {
      const candidates = [
        'youtube', 'google', 'gmail', 'word', 'excel', 'chrome', 'edge', 'notepad',
        'calculadora', 'spotify', 'discord', 'code', 'firefox', 'powerpoint', 'chatgpt', 'gemini', 'claude',
      ];
      for (const app of candidates) {
        if (new RegExp('\\b' + app + '\\b', 'i').test(text)) {
          name = app;
          break;
        }
      }
    }
    if (name) {
      const r = await helpers.openApp(name);
      return { response: r.message || r.result, intelligent: false };
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
