/**
 * Conocimiento inteligente — desambiguación + Wikipedia + DDG + preferencia IA
 * No devolver listados basura de desambiguación.
 */

/** Preferencias semánticas: si el usuario habla de IA, priorizar estos títulos wiki */
const AI_ALIASES = {
  gemini: 'Google Gemini',
  'google gemini': 'Google Gemini',
  'ia de gemini': 'Google Gemini',
  'gemini google': 'Google Gemini',
  'gemini ai': 'Google Gemini',
  chatgpt: 'ChatGPT',
  'chat gpt': 'ChatGPT',
  openai: 'OpenAI',
  claude: 'Anthropic',
  'claude ai': 'Claude (language model)',
  groq: 'Groq',
  llama: 'Llama (language model)',
  copilot: 'Microsoft Copilot',
  python: 'Python (programming language)',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  react: 'React (software)',
  electron: 'Electron (software framework)',
};

function normalizeQuery(q) {
  return String(q || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[?.!]+$/g, '')
    .trim();
}

function resolvePreferredTitle(query) {
  const n = normalizeQuery(query);
  if (AI_ALIASES[n]) return AI_ALIASES[n];
  // partial
  for (const [k, v] of Object.entries(AI_ALIASES)) {
    if (n.includes(k) || k.includes(n)) return v;
  }
  // si menciona ia/ai junto a un nombre
  if (/\b(ia|ai|modelo|inteligencia)\b/.test(n)) {
    if (/gemini/.test(n)) return 'Google Gemini';
    if (/claude/.test(n)) return 'Claude (language model)';
    if (/gpt|chatgpt/.test(n)) return 'ChatGPT';
  }
  return query.trim();
}

async function fetchWikiSummary(title, lang = 'es') {
  const url =
    'https://' +
    lang +
    '.wikipedia.org/api/rest_v1/page/summary/' +
    encodeURIComponent(title);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'ELYRA/4.0 (desktop-assistant)' } });
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

async function fetchDDG(query) {
  try {
    const res = await fetch(
      'https://api.duckduckgo.com/?q=' + encodeURIComponent(query) + '&format=json&no_html=1&skip_disambig=1',
      { headers: { 'User-Agent': 'ELYRA/4.0' } },
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

/**
 * Respuesta de conocimiento lista para voz (corta, útil).
 * @returns {{ ok: boolean, response: string, source?: string }}
 */
async function smartKnowledge(query) {
  const raw = String(query || '').trim();
  if (!raw || raw.length < 2) return { ok: false, response: '' };

  const preferred = resolvePreferredTitle(raw);

  // 1) Wikipedia con título preferido (ES luego EN)
  for (const lang of ['es', 'en']) {
    let page = await fetchWikiSummary(preferred, lang);
    if (page && page.disambiguation) {
      // reintentar con preferencia IA si el query es genérico
      page = await fetchWikiSummary(resolvePreferredTitle(raw + ' ia'), lang);
    }
    if (page && !page.disambiguation && page.extract) {
      let text = page.extract;
      // Cortar basura de desambiguación residual
      if (/puede referirse|may refer to|puede aludir/i.test(text) && text.length > 400) {
        // intentar título más específico
        const better = await fetchWikiSummary('Google Gemini', lang);
        if (better?.extract && !better.disambiguation) text = better.extract;
      }
      // Respuesta natural
      const short = text.length > 700 ? text.slice(0, 680).replace(/\s+\S*$/, '') + '…' : text;
      return {
        ok: true,
        response: short,
        source: 'wikipedia:' + lang,
        title: page.title,
      };
    }
  }

  // 2) DuckDuckGo Instant Answer
  const ddg = await fetchDDG(preferred);
  if (ddg && ddg.length > 40) {
    return {
      ok: true,
      response: ddg.length > 700 ? ddg.slice(0, 680) + '…' : ddg,
      source: 'duckduckgo',
    };
  }

  // 3) Sin inventar: indicar que abra búsqueda
  return {
    ok: false,
    response:
      'No encontré un resumen claro sobre "' +
      raw +
      '". Puedo abrirte la búsqueda en Google si quieres.',
    source: 'none',
  };
}

module.exports = {
  smartKnowledge,
  resolvePreferredTitle,
  normalizeQuery,
  AI_ALIASES,
};
