/**
 * Router ELYRA 1.9.1 — conversación + PC NLU + web + Brain local
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
const { runLocalIntelligence } = require('./local-intelligence.cjs');
const { isComplexTask, runMultiAgent } = require('./multi-agent.cjs');
const { tryPcFirst } = require('./chat-router-pc-hook.cjs');

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

function speakify(text) {
  if (!text) return text;
  let t = String(text);
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/\*\*?/g, '');
  t = t.replace(/^#+\s+/gm, '');
  t = t.replace(/\n{2,}/g, '. ');
  t = t.replace(/\n/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  if (/\{\s*"status"|Not found for account|tool_call/i.test(t)) {
    return 'El modelo tuvo un tropiezo. Puedo buscarlo en la web o controlar el PC.';
  }
  if (t.length > 520) {
    const cut = t.slice(0, 520);
    const last = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('?'));
    t = last > 200 ? cut.slice(0, last + 1) : cut + '.';
  }
  return t;
}

function looksLikeKnowledgeQuestion(text) {
  const t = String(text || '').toLowerCase();
  if (t.length < 4) return false;
  if (/\b(abre|abrir|cierra|volumen|brillo|captura|chrome|excel|word|carpeta|minimiza|apaga|reinicia|silencia|wifi|portapapeles)\b/.test(t))
    return false;
  return /\b(qué|que|quién|quien|cómo|como|por qué|porque|cuándo|cuando|dónde|donde|explica|cuéntame|cuentame|historia|guerra|pasó|paso|significa|diferencia|quién inventó|quien invento|busca información|investiga|noticias|actualidad|porfa|dime)\b/i.test(
    t,
  );
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
    .replace(/\b(hey\s+)?(elyra|elira|eliara|luna)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    !text ||
    /^(estas ahi|estás ahí|estas alli|me escuchas|me oyes|hola|oye|hey|buenos dias|buenas tardes|buenas noches|ey|eh|presentate|preséntate)$/i.test(
      text,
    )
  ) {
    if (/present/i.test(text)) {
      return {
        response:
          'Soy ELYRA. Controlo tu PC, busco en internet y razono en local. ¿En qué te ayudo?',
        intelligent: true,
        via: 'presence',
      };
    }
    return { response: pickPresence(), intelligent: true, via: 'presence' };
  }

  // PC NLU prioritario (antes que todo)
  try {
    const pcHit = await tryPcFirst(text, helpers, pc, getSystemStats);
    if (pcHit && pcHit.response) {
      return { ...pcHit, response: speakify(pcHit.response), intelligent: !!pcHit.intelligent };
    }
  } catch {}

  try {
    const skill = await trySkillIntent(text);
    if (skill) return { ...skill, response: speakify(skill.response) };
  } catch {}

  const quick = await tryLocal(text, helpers, pc, getSystemStats);
  if (quick) return { ...quick, response: speakify(quick.response) };

  try {
    if (isComplexTask(fixed) || isComplexTask(text)) {
      const ma = await runMultiAgent(fixed, helpers);
      if (ma && ma.response) {
        return {
          response: speakify(ma.response),
          intelligent: !!ma.intelligent,
          via: ma.via || 'multi-agent',
          plan_steps: ma.plan_steps,
        };
      }
    }
  } catch {}

  if (looksLikeKnowledgeQuestion(text) || looksLikeKnowledgeQuestion(fixed) || text.split(/\s+/).length >= 3) {
    try {
      const local = await runLocalIntelligence(fixed, history || []);
      if (local && local.ok !== false && local.response && local.via !== 'local-defer-pc') {
        return {
          response: speakify(local.response),
          intelligent: true,
          via: local.via || 'elyra-brain',
        };
      }
    } catch {}
    try {
      const sk = await trySmartTopic(fixed, text);
      if (sk && sk.response) {
        return { ...sk, response: speakify(sk.response), via: sk.via || 'web-auto' };
      }
      const deep = await deepWebSearch(fixed);
      if (deep.ok && deep.response) {
        return { response: speakify(deep.response), intelligent: true, via: 'web-auto-deep' };
      }
    } catch {}
  }

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
    try {
      const local = await runLocalIntelligence(fixed, history || []);
      if (local && local.response) {
        return {
          response: speakify(local.response),
          intelligent: true,
          via: local.via || 'local-intelligence',
        };
      }
    } catch {}
    return {
      response:
        'Puedo controlar el PC y buscar en internet sin API key. Para más inteligencia: ollama pull llama3.2',
      intelligent: true,
      via: 'no-key',
    };
  }

  try {
    const result = await runAgent(fixed, history || [], helpers);
    const resp = result?.response || '';
    const via = result?.via || 'llm';

    if (
      result?.intelligent === false ||
      via === 'agent-error' ||
      /api key no es válida|no hay api key|falta la api|no pude conectar|401|unauthorized|tropiezo|no respondió bien|revisa la api/i.test(
        resp,
      )
    ) {
      try {
        const local = await runLocalIntelligence(fixed, history || []);
        if (local && local.response) {
          return {
            response: speakify(local.response),
            intelligent: true,
            via: 'local-fallback:' + (local.via || ''),
          };
        }
      } catch {}
      const sk = await trySmartTopic(fixed, text);
      if (sk) {
        return { response: speakify(sk.response), intelligent: true, via: 'smart-fallback' };
      }
      return {
        response: speakify(resp || 'El modelo no respondió bien. Puedo controlar el PC y buscar en la web.'),
        intelligent: false,
        via: 'error',
      };
    }

    return { response: speakify(resp), intelligent: true, via };
  } catch (err) {
    try {
      const local = await runLocalIntelligence(fixed, history || []);
      if (local && local.response) {
        return {
          response: speakify(local.response),
          intelligent: true,
          via: 'local-error-fallback',
        };
      }
    } catch {}
    return {
      response: 'Tuve un tropiezo. Sigo lista para el sistema y búsquedas en internet.',
      intelligent: false,
    };
  }
}

async function trySmartTopic(fixed, text) {
  let topic = null;
  const patterns = [
    /(?:dime|cuéntame|cuentame|explícame|explicame|qué sabes|que sabes)\s+(?:sobre|de|acerca de)\s+(.+)/i,
    /(?:qué es|que es|quién es|quien es)\s+(.+)/i,
    /(?:qué|que)\s+(?:pasó|paso|sucedió|ocurrió)\s+(?:en|durante)?\s*(.+)/i,
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
  if (!topic && looksLikeKnowledgeQuestion(fixed)) {
    topic = String(fixed).replace(/[?.!]+$/, '').trim();
  }
  if (!topic && text.split(/\s+/).length <= 8 && !/\b(abre|abrir|volumen|brillo|youtube)\b/.test(text)) {
    if (/gemini|chatgpt|claude|python|openai|groq|llama|guerra|historia|ciencia/.test(text)) topic = text;
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
        response: found.result || 'No encontré un Excel reciente.',
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
      response: 'Encontré «' + found.name + '».',
      intelligent: true,
      via: 'excel-path',
    };
  } catch {
    return { response: 'No pude mirar el Excel ahora.', intelligent: false };
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
    /\b(analiza|analizar|resume|resumen)\b/.test(text) &&
    /\b(excel|xlsx|hoja)\b/.test(text)
  ) {
    return tryAnalyzeOpenExcel(helpers);
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
    return { response: 'Abrí Wikipedia con «' + compound.query + '».', intelligent: true, via: 'wiki' };
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
        response: 'Te abrí YouTube con «' + compound.query + '».',
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

  const openMatch = text.match(
    /\b(?:abre|abrir|lanza|ejecuta|abreme|abrime)\s+(?:el\s+|la\s+|los\s+|las\s+)?(.+)/i,
  );
  if (openMatch || /\b(abre|abrir)\b/.test(text)) {
    if (!(/\by\s+(?:me\s+)?busca/i.test(text) && /youtube/i.test(text))) {
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

  if (/\b(qu[eé]\s+puedes\s+hacer|capacidades|c[oó]mo\s+me\s+ayudas)\b/i.test(text)) {
    return {
      response:
        'Controlo volumen, brillo, ventanas, WiFi, capturas, procesos, apps, carpetas, y también busco en internet y razono en local. Dime qué hacer.',
      intelligent: true,
      via: 'capabilities',
    };
  }

  const mathReply = tryLocalMath(text);
  if (mathReply) {
    return { response: mathReply, intelligent: true, via: 'local-math' };
  }

  if (/\b(qué hora|que hora|hora es)\b/.test(text)) {
    return {
      response:
        'Son las ' +
        new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) +
        '.',
      intelligent: true,
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
      intelligent: true,
    };
  }

  return null;
}

module.exports = { routeChat };
