/**
 * Router ELYRA v9 — conversación vocal natural + PC + búsquedas
 */
const os = require('os');
const { smartKnowledge } = require('./smart-knowledge.cjs');
const { tryLocalMath } = require('./local-math.cjs');
const {
  applyTypos,
  parseCompound,
  cleanOpenName,
  youtubeSearchUrl,
  googleSearchUrl,
  wikiSearchUrl,
} = require('./intent-compound.cjs');
const { trySkillIntent } = require('./skills-router.cjs');
const { resolveOpenExcelPath } = require('./open-excel-context.cjs');
const { deepWebSearch } = require('./web-search-boost.cjs');

const PRESENCE_REPLIES = [
  'Sí, aquí estoy. Dime.',
  'Te escucho.',
  'Hola. ¿Qué necesitas?',
  'Estoy contigo. ¿En qué te ayudo?',
  'Dime, te oigo bien.',
  'Aquí. ¿Qué hacemos?',
];

function pickPresence() {
  return PRESENCE_REPLIES[Math.floor(Math.random() * PRESENCE_REPLIES.length)];
}

/** Respuestas cortas y hablables (estilo voz) */
function speakify(text) {
  if (!text) return text;
  let t = String(text);
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/\*\*?/g, '');
  t = t.replace(/^#+\s+/gm, '');
  t = t.replace(/\n{2,}/g, '. ');
  t = t.replace(/\n/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  // Acortar muros de texto para voz
  if (t.length > 480) {
    const cut = t.slice(0, 480);
    const last = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('?'));
    t = last > 200 ? cut.slice(0, last + 1) : cut + '.';
  }
  return t;
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
    /^(estas ahi|estás ahí|estas alli|me escuchas|me oyes|hola|oye|hey|buenos dias|buenas tardes|buenas noches|ey|eh)$/i.test(
      text,
    )
  ) {
    return { response: pickPresence(), intelligent: true, via: 'presence' };
  }

  try {
    const skill = await trySkillIntent(text);
    if (skill) return { ...skill, response: speakify(skill.response) };
  } catch {}

  const quick = await tryLocal(text, helpers, pc, getSystemStats);
  if (quick) return { ...quick, response: speakify(quick.response) };

  try {
    const oc = getOpenClawConfig && getOpenClawConfig();
    if (oc?.enabled && chatOpenClaw) {
      const ocRes = await chatOpenClaw(fixed, history || []);
      if (ocRes.ok && ocRes.response) {
        return { response: speakify(ocRes.response), intelligent: true, via: 'openclaw' };
      }
    }
  } catch {}

  const config = getConfig();
  if (!config.apiKey) {
    const sk = await trySmartTopic(fixed, text);
    if (sk) return { ...sk, response: speakify(sk.response) };
    return {
      response:
        'Aún no tengo clave de inteligencia configurada. Puedo controlar el PC y buscar en la web. Si quieres razonar más a fondo, agrega una API key en Configuración.',
      intelligent: false,
    };
  }

  try {
    const result = await runAgent(fixed, history || [], helpers);
    const resp = result?.response || '';

    if (/api key no es válida|no hay api key|falta la api|no pude conectar|401|unauthorized/i.test(resp)) {
      const sk = await trySmartTopic(fixed, text);
      if (sk) {
        return {
          response: speakify(sk.response + ' Por cierto, la API no respondió del todo.'),
          intelligent: true,
          via: 'smart-fallback',
        };
      }
      return {
        response: 'El modelo no respondió bien. Revisa la API key. Mientras, sigo con el PC y las búsquedas.',
        intelligent: false,
        via: 'error',
      };
    }

    return { response: speakify(resp), intelligent: true, via: 'llm' };
  } catch (err) {
    const msg = String(err.message || err);
    if (/429|rate limit/i.test(msg)) {
      const sk = await trySmartTopic(fixed, text);
      if (sk) return { ...sk, response: speakify(sk.response), via: 'smart-ratelimit' };
      return {
        response: 'El servicio de inteligencia está un poco saturado. Prueba en unos segundos.',
        intelligent: false,
      };
    }
    const sk = await trySmartTopic(fixed, text);
    if (sk) return { ...sk, response: speakify(sk.response), via: 'smart-error' };
    return {
      response: 'Tuve un tropiezo con el modelo. Sigo lista para el sistema y búsquedas.',
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
      if (/\byoutube\b|\ben\s+yt\b/i.test(m[1])) continue;
      topic = m[1].replace(/[?.!]+$/, '').trim();
      break;
    }
  }
  if (!topic && text.split(/\s+/).length <= 4 && !/\b(abre|abrir|volumen|brillo|youtube)\b/.test(text)) {
    if (/gemini|chatgpt|claude|python|openai|groq|llama/.test(text)) topic = text;
  }
  if (!topic || topic.length < 2) return null;
  const deep = await deepWebSearch(topic);
  if (deep.ok) return { response: deep.response, intelligent: true, via: deep.source || 'deep' };
  const sk = await smartKnowledge(topic);
  if (sk.ok) return { response: sk.response, intelligent: true, via: sk.source || 'smart' };
  return null;
}

async function tryAnalyzeOpenExcel(helpers) {
  try {
    const found = await resolveOpenExcelPath();
    if (!found.ok || !found.path) {
      return {
        response: found.result || 'No encontré un Excel reciente. Ábrelo o dime la ruta.',
        intelligent: true,
        via: 'excel-miss',
      };
    }
    if (helpers.runPythonTool) {
      const r = await helpers.runPythonTool('analyze_excel', { path: found.path });
      if (r.ok) {
        return {
          response: 'Revisé «' + found.name + '». ' + String(r.result || '').slice(0, 900),
          intelligent: true,
          via: 'excel-open',
        };
      }
    }
    return {
      response: 'Encontré «' + found.name + '». Si quieres, dime y lo analizo a fondo.',
      intelligent: true,
      via: 'excel-path',
    };
  } catch (e) {
    return {
      response: 'No pude mirar el Excel ahora. Probemos de nuevo en un momento.',
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
    return { response: 'Listo, lo guardé.', intelligent: false };
  }

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
            'Ahora mismo: procesador al ' +
            s.cpu +
            ' por ciento, memoria al ' +
            s.ram +
            ' y disco al ' +
            s.disk +
            '. Equipo ' +
            (s.hostname || os.hostname()) +
            '.',
          intelligent: false,
          via: 'local-stats',
        };
      }
    } catch {}
    return {
      response: 'El equipo está en marcha. ' + os.hostname() + '.',
      intelligent: false,
    };
  }

  if (/\b(administrador de tareas|task ?manager|gestor de tareas)\b/.test(text) && pc.openTaskManager) {
    const r = await pc.openTaskManager();
    return { response: r.result || 'Abrí el administrador de tareas.', intelligent: false };
  }
  if ((/\b(limpia|limpiar)\s+(los\s+)?temporales\b/.test(text) || /\bvacia temporales\b/.test(text)) && pc.emptyTemp) {
    const r = await pc.emptyTemp();
    return { response: r.result || 'Limpié los temporales.', intelligent: false };
  }
  if (/\b(estado (del )?wifi|wifi status)\b/.test(text) && pc.wifiStatus) {
    const r = await pc.wifiStatus();
    return { response: (r.result || '').slice(0, 400), intelligent: false };
  }
  if (/\b(activa|activar|enciende|encender)\s+(el\s+)?wifi\b/.test(text) && pc.setWifi) {
    const r = await pc.setWifi(true);
    return { response: r.result || 'Activé el wifi.', intelligent: false };
  }
  if (/\b(desactiva|desactivar|apaga|apagar)\s+(el\s+)?wifi\b/.test(text) && pc.setWifi) {
    const r = await pc.setWifi(false);
    return { response: r.result || 'Apagué el wifi.', intelligent: false };
  }
  if ((/\b(flush|vacía|vacia)\s+dns\b/.test(text) || /\blimpia (la )?dns\b/.test(text)) && pc.flushDns) {
    const r = await pc.flushDns();
    return { response: r.result || 'Listo, DNS limpio.', intelligent: false };
  }
  if (/\b(qué ventanas|que ventanas|ventanas abiertas)\b/.test(text) && pc.listWindows) {
    const r = await pc.listWindows();
    return { response: (r.result || 'No veo ventanas ahora.').slice(0, 500), intelligent: false };
  }

  const compound = parseCompound(text);

  if (compound?.type === 'youtube_search') {
    await helpers.openUrl(youtubeSearchUrl(compound.query));
    return {
      response: 'Listo, abrí YouTube con «' + compound.query + '».',
      intelligent: true,
      via: 'youtube-search',
    };
  }

  if (compound?.type === 'wiki_search') {
    await helpers.openUrl(wikiSearchUrl(compound.query));
    const sk = await smartKnowledge(compound.query);
    if (sk.ok) {
      return {
        response: 'Abrí Wikipedia. ' + sk.response.slice(0, 400),
        intelligent: true,
        via: 'wiki',
      };
    }
    return {
      response: 'Abrí Wikipedia con «' + compound.query + '».',
      intelligent: true,
      via: 'wiki',
    };
  }

  if (compound?.type === 'compound_search') {
    if (/youtube|\byt\b/i.test(compound.browser || '')) {
      await helpers.openUrl(youtubeSearchUrl(compound.query));
      return {
        response: 'Abrí YouTube con «' + compound.query + '».',
        intelligent: true,
        via: 'youtube-search',
      };
    }
    await helpers.openApp(compound.browser || 'chrome');
    await helpers.openUrl(googleSearchUrl(compound.query));
    const deep = await deepWebSearch(compound.query);
    if (deep.ok) {
      return {
        response: 'Listo. ' + deep.response.slice(0, 400),
        intelligent: true,
        via: 'compound+deep',
      };
    }
    return {
      response: 'Abrí el navegador con la búsqueda de «' + compound.query + '».',
      intelligent: false,
    };
  }

  if (compound?.type === 'google_search') {
    if (/\b(video|vídeo|cancion|canción|trailer|clip)\b/i.test(text)) {
      await helpers.openUrl(youtubeSearchUrl(compound.query));
      return {
        response: 'Parece un video: te abrí YouTube con «' + compound.query + '».',
        intelligent: true,
        via: 'youtube-from-google-intent',
      };
    }
    const deep = await deepWebSearch(compound.query);
    if (deep.ok) {
      return { response: deep.response, intelligent: true, via: 'deep-web' };
    }
    await helpers.openUrl(googleSearchUrl(compound.query));
    return {
      response: 'Abrí Google con «' + compound.query + '».',
      intelligent: false,
      via: 'google-open',
    };
  }

  if (/\b(sube|subir)\s+(el\s+)?volumen\b/.test(text)) {
    const r = await pc.volume('up');
    return { response: r.result || 'Subí el volumen.', intelligent: false };
  }
  if (/\b(baja|bajar)\s+(el\s+)?volumen\b/.test(text)) {
    const r = await pc.volume('down');
    return { response: r.result || 'Bajé el volumen.', intelligent: false };
  }
  if (/\b(silencia|mute|silencio)\b/.test(text)) {
    const r = await pc.volume('mute');
    return { response: r.result || 'Silenciado.', intelligent: false };
  }
  if (/\b(sube|subir)\s+(el\s+)?brillo\b/.test(text)) {
    const r = await pc.brightness('up');
    return { response: r.result || 'Subí el brillo.', intelligent: false };
  }
  if (/\b(baja|bajar)\s+(el\s+)?brillo\b/.test(text)) {
    const r = await pc.brightness('down');
    return { response: r.result || 'Bajé el brillo.', intelligent: false };
  }
  if (/\b(captura|screenshot)\b/.test(text)) {
    const r = await pc.screenshot();
    return { response: r.result || 'Listo, capturé la pantalla.', intelligent: false };
  }
  if (/\b(bloquea|bloquear)\s+(la\s+)?(sesión|pc|pantalla)\b/.test(text)) {
    const r = await pc.windows('lock');
    return { response: r.result || 'Bloqueé la sesión.', intelligent: false };
  }
  if (/\b(minimiza|minimizar)\s+(todas|ventanas|todo)\b/.test(text) || /\bmostrar escritorio\b/.test(text)) {
    const r = await pc.windows('minimize_all');
    return { response: r.result || 'Minimicé las ventanas.', intelligent: false };
  }
  if (/\b(batería|bateria)\b/.test(text)) {
    const r = await pc.battery();
    return { response: r.result, intelligent: false };
  }
  if (/\b(vacía|vacia|vaciar)\s+(la\s+)?papelera\b/.test(text)) {
    const r = await pc.emptyRecycle();
    return { response: r.result || 'Vacío la papelera.', intelligent: false };
  }
  if (/\b(apaga|apagar)\s+(el\s+)?(pc|equipo)\b/.test(text) && !/pantalla/.test(text)) {
    const r = await pc.power('shutdown', 1);
    return { response: r.result || 'Voy a apagar el equipo.', intelligent: false };
  }
  if (/\b(reinicia|reiniciar)\b/.test(text)) {
    const r = await pc.power('restart', 1);
    return { response: r.result || 'Reinicio el equipo.', intelligent: false };
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
    if (/\by\s+(?:me\s+)?busca/i.test(text) && /youtube/i.test(text)) {
      /* compound */
    } else {
      const folderKeys = ['documentos', 'descargas', 'escritorio', 'informes', 'imagenes', 'musica', 'videos'];
      for (const f of folderKeys) {
        if (text.includes(f)) {
          const r = await helpers.openFolder(f);
          return { response: r.message || r.result || 'Abrí la carpeta.', intelligent: false };
        }
      }
      let name = openMatch ? openMatch[1].trim() : '';
      name = cleanOpenName(name) || name;
      if (!name) {
        const candidates = [
          'youtube', 'google', 'gmail', 'word', 'excel', 'chrome', 'edge', 'notepad',
          'calculadora', 'spotify', 'discord', 'code', 'firefox', 'powerpoint',
          'chatgpt', 'gemini', 'claude', 'papelera', 'bluestacks',
        ];
        for (const app of candidates) {
          if (new RegExp('\\b' + app + '\\b', 'i').test(text)) {
            name = app;
            break;
          }
        }
      }
      if (/\ben\s+(la\s+)?web\b/i.test(text) && name && !/\ben\s+(la\s+)?web\b/i.test(name)) {
        name = name + ' en la web';
      }
      if (name) {
        const r = await helpers.openApp(name);
        return { response: r.message || r.result || 'Listo, lo abrí.', intelligent: false, via: 'open-app' };
      }
    }
  }

  if (/\b(qu[eé]\s+puedes\s+hacer|qu[eé]\s+sabes\s+hacer|tus\s+funciones|capacidades|ayuda\s+con\s+qu[eé]|c[oó]mo\s+me\s+ayudas)\b/i.test(text)) {
    return {
      response:
        'Puedo controlar tu PC: abrir apps, carpetas, páginas, volumen, capturas y procesos. ' +
        'Busco en Google o YouTube. Calculo, recuerdo cosas y te ayudo con el laboratorio de cacao, cadmio y plaguicidas. ' +
        'Háblame normal, como a una persona. ¿Qué quieres hacer?',
      intelligent: true,
      via: 'capabilities',
    };
  }

  {
    const mathReply = tryLocalMath(text);
    if (mathReply) {
      return { response: mathReply, intelligent: false, via: 'local-math' };
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
