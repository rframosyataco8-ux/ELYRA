/**
 * Conocimiento inteligente ELYRA 1.11 — Wikipedia + DDG + aliases ampliados
 */

const AI_ALIASES = {
  gemini: 'Google Gemini',
  'google gemini': 'Google Gemini',
  chatgpt: 'ChatGPT',
  'chat gpt': 'ChatGPT',
  openai: 'OpenAI',
  claude: 'Claude (language model)',
  groq: 'Groq',
  llama: 'Llama (language model)',
  copilot: 'Microsoft Copilot',
  python: 'Python (programming language)',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  react: 'React (software)',
  electron: 'Electron (software framework)',
  'segunda guerra mundial': 'Segunda Guerra Mundial',
  'primera guerra mundial': 'Primera Guerra Mundial',
  'guerra mundial': 'Segunda Guerra Mundial',
  fotosintesis: 'Fotosíntesis',
  'fotosíntesis': 'Fotosíntesis',
  internet: 'Internet',
  'inteligencia artificial': 'Inteligencia artificial',
  peru: 'Perú',
  'perú': 'Perú',
  lima: 'Lima',
  nasa: 'NASA',
  elon: 'Elon Musk',
  'elon musk': 'Elon Musk',
  bitcoin: 'Bitcoin',
  ethereum: 'Ethereum',
  covid: 'COVID-19',
  coronavirus: 'COVID-19',
  adn: 'ADN',
  dna: 'ADN',
  relatividad: 'Teoría de la relatividad',
  'agujero negro': 'Agujero negro',
  'agujeros negros': 'Agujero negro',
  'sistema solar': 'Sistema solar',
  'cambio climatico': 'Cambio climático',
  'cambio climático': 'Cambio climático',
  'energia solar': 'Energía solar',
  'energía solar': 'Energía solar',
  'machine learning': 'Aprendizaje automático',
  'aprendizaje automatico': 'Aprendizaje automático',
  'redes neuronales': 'Red neuronal artificial',
  'big bang': 'Big Bang',
  newton: 'Isaac Newton',
  einstein: 'Albert Einstein',
  darwin: 'Charles Darwin',
  shakespeare: 'William Shakespeare',
  'marie curie': 'Marie Curie',
};

function normalizeQuery(q) {
  return String(q || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[?.!]+$/g, '')
    .trim();
}

/** Quita muletillas de pregunta para buscar mejor en Wiki */
function stripQuestion(q) {
  return String(q || '')
    .replace(/^(oye|hey|por favor|porfa|elyra)\s+/i, '')
    .replace(
      /^(dime|cuéntame|cuentame|explícame|explicame|busca información sobre|busca informacion sobre|busca|buscar|investiga)\s+/i,
      '',
    )
    .replace(/^(qué|que)\s+(es|son|fue|fueron|significa)\s+(un|una|el|la|los|las)?\s*/i, '')
    .replace(/^(quién|quien)\s+(es|fue|era)\s+/i, '')
    .replace(/^(cómo|como)\s+(funciona|se hace|se llama)\s+/i, '')
    .replace(/^(dónde|donde)\s+(está|esta|queda)\s+/i, '')
    .replace(/^(cuándo|cuando)\s+(fue|ocurrió|ocurrio)\s+/i, '')
    .replace(/^(sobre|de|acerca de)\s+/i, '')
    .replace(/[¿?¡!]+/g, '')
    .trim();
}

function resolvePreferredTitle(query) {
  const stripped = stripQuestion(query);
  const n = normalizeQuery(stripped);
  if (AI_ALIASES[n]) return AI_ALIASES[n];
  for (const [k, v] of Object.entries(AI_ALIASES)) {
    if (n === k || n.includes(k)) return v;
  }
  if (/\b(ia|ai|modelo|inteligencia)\b/.test(n)) {
    if (/gemini/.test(n)) return 'Google Gemini';
    if (/claude/.test(n)) return 'Claude (language model)';
    if (/gpt|chatgpt/.test(n)) return 'ChatGPT';
  }
  if (/segunda guerra|ii guerra|ww2|world war ii/.test(n)) return 'Segunda Guerra Mundial';
  if (/primera guerra|i guerra|ww1|world war i/.test(n)) return 'Primera Guerra Mundial';
  if (/fotosint/.test(n)) return 'Fotosíntesis';
  return stripped || query.trim();
}

async function fetchWikiSummary(title, lang = 'es') {
  const url =
    'https://' +
    lang +
    '.wikipedia.org/api/rest_v1/page/summary/' +
    encodeURIComponent(title);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ELYRA/1.11 (desktop-assistant)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.type === 'disambiguation') return { disambiguation: true, extract: data.extract || '' };
    if (data.extract) {
      return {
        title: data.title,
        extract: data.extract,
        description: data.description || '',
        url: data.content_urls?.desktop?.page || '',
      };
    }
  } catch {}
  return null;
}

async function fetchWikiSearch(query, lang = 'es') {
  try {
    const url =
      'https://' +
      lang +
      '.wikipedia.org/w/api.php?action=opensearch&search=' +
      encodeURIComponent(query) +
      '&limit=6&namespace=0&format=json';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ELYRA/1.11' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[1] || [];
  } catch {
    return null;
  }
}

async function fetchDDG(query) {
  try {
    const res = await fetch(
      'https://api.duckduckgo.com/?q=' +
        encodeURIComponent(query) +
        '&format=json&no_html=1&skip_disambig=1',
      {
        headers: { 'User-Agent': 'ELYRA/1.11' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.AbstractText) return data.AbstractText;
    if (data.Answer) return data.Answer;
    if (data.Definition) return data.Definition;
    if (data.RelatedTopics?.[0]?.Text) return data.RelatedTopics[0].Text;
  } catch {}
  return null;
}

function toSpokenSummary(text) {
  let t = String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\(\s*escuchar\s*\)/gi, '')
    .trim();
  if (t.length > 720) {
    const cut = t.slice(0, 700);
    const last = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf(';'));
    t = last > 220 ? cut.slice(0, last + 1) : cut.replace(/\s+\S*$/, '') + '…';
  }
  return t;
}

async function smartKnowledge(query) {
  const raw = String(query || '').trim();
  if (!raw || raw.length < 2) return { ok: false, response: '' };

  const preferred = resolvePreferredTitle(raw);
  const stripped = stripQuestion(raw);

  // 1) Título preferido ES → EN
  for (const lang of ['es', 'en']) {
    let page = await fetchWikiSummary(preferred, lang);
    if (page && page.disambiguation) {
      const titles = await fetchWikiSearch(preferred, lang);
      if (titles && titles[0]) page = await fetchWikiSummary(titles[0], lang);
    }
    if (page && !page.disambiguation && page.extract) {
      return {
        ok: true,
        response: toSpokenSummary(page.extract),
        source: 'wikipedia:' + lang,
        title: page.title,
      };
    }
  }

  // 2) OpenSearch
  for (const q of [stripped, preferred, raw]) {
    if (!q) continue;
    for (const lang of ['es', 'en']) {
      const titles = await fetchWikiSearch(q, lang);
      if (titles && titles.length) {
        for (const title of titles.slice(0, 4)) {
          const page = await fetchWikiSummary(title, lang);
          if (page && !page.disambiguation && page.extract && page.extract.length > 60) {
            return {
              ok: true,
              response: toSpokenSummary(page.extract),
              source: 'wikipedia-search:' + lang,
              title: page.title,
            };
          }
        }
      }
    }
  }

  // 3) DuckDuckGo
  const ddg =
    (await fetchDDG(preferred)) || (await fetchDDG(stripped)) || (await fetchDDG(raw));
  if (ddg && ddg.length > 40) {
    return {
      ok: true,
      response: toSpokenSummary(ddg),
      source: 'duckduckgo',
    };
  }

  return {
    ok: false,
    response:
      'No encontré un resumen claro sobre "' +
      stripped +
      '". Puedo abrirte la búsqueda en Google si quieres.',
    source: 'none',
  };
}

module.exports = {
  smartKnowledge,
  resolvePreferredTitle,
  normalizeQuery,
  stripQuestion,
  AI_ALIASES,
};
