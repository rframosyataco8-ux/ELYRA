/**
 * Búsqueda web inteligente ELYRA
 * - Reescritura de consulta
 * - Multi-fuente (Wiki + DDG instant + snippets)
 * - Ranking simple y caché
 */
const { smartKnowledge } = require('./smart-knowledge.cjs');
const searchCache = require('./search-cache.cjs');

function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Limpia la pregunta del usuario para buscar mejor */
function rewriteQuery(raw) {
  let q = String(raw || '').trim();
  q = q
    .replace(/^(oye|hey|eh|por favor|porfa)\s+/i, '')
    .replace(
      /^(dime|cuéntame|cuentame|explícame|explicame|busca|buscar|investiga|información sobre|informacion sobre)\s+/i,
      '',
    )
    .replace(/^(qué|que)\s+(es|son|fue|fueron|significa|pasó|paso|sucedió)\s+/i, (m) => m)
    .replace(/\s+/g, ' ')
    .trim();

  // Variantes útiles para historia / hechos
  const lower = q.toLowerCase();
  const variants = [q];

  if (/segunda guerra|ii guerra|ww2|world war ii/.test(lower)) {
    variants.push('Segunda Guerra Mundial');
    variants.push('Second World War');
  }
  if (/primera guerra|i guerra|ww1/.test(lower)) {
    variants.push('Primera Guerra Mundial');
  }
  if (/quién inventó|quien invento|quién creó|quien creo/.test(lower)) {
    variants.push(q.replace(/quién inventó|quien invento|quién creó|quien creo/gi, 'inventor'));
  }

  // Quitar muletillas finales
  const primary = variants[0].replace(/[¿?¡!]+$/g, '').trim();
  return { primary, variants: [...new Set(variants.map((v) => v.replace(/[¿?¡!]+$/g, '').trim()))] };
}

function scoreText(text, query) {
  if (!text) return 0;
  const t = text.toLowerCase();
  const words = String(query)
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  let score = Math.min(text.length, 400) / 400;
  for (const w of words) {
    if (t.includes(w)) score += 0.35;
  }
  // Penalizar basura de desambiguación
  if (/puede referirse|may refer to|desambiguación/i.test(t)) score -= 1.5;
  if (text.length < 60) score -= 0.3;
  if (text.length > 120 && text.length < 700) score += 0.4;
  return score;
}

async function fetchDDGSnippets(query) {
  const snippets = [];
  try {
    const res = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
    });
    const html = await res.text();
    const reSnippet = /class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td|div)>/gi;
    let sm;
    while ((sm = reSnippet.exec(html)) !== null && snippets.length < 8) {
      const t = stripHtml(sm[1]);
      if (t.length > 45) snippets.push(t);
    }
    if (snippets.length < 2) {
      const reAlt = /class="result__a"[^>]*>([\s\S]*?)<\/a>/gi;
      while ((sm = reAlt.exec(html)) !== null && snippets.length < 6) {
        const t = stripHtml(sm[1]);
        if (t.length > 15) snippets.push(t);
      }
    }
  } catch {}
  return snippets;
}

async function fetchDDGInstant(query) {
  try {
    const res = await fetch(
      'https://api.duckduckgo.com/?q=' +
        encodeURIComponent(query) +
        '&format=json&no_html=1&skip_disambig=1',
      { headers: { 'User-Agent': 'ELYRA/5.2' } },
    );
    const data = await res.json();
    const parts = [];
    if (data.Heading && data.AbstractText) {
      parts.push(data.AbstractText);
    } else if (data.AbstractText) {
      parts.push(data.AbstractText);
    }
    if (data.Answer) parts.push(data.Answer);
    if (data.Definition) parts.push(data.Definition);
    if (Array.isArray(data.RelatedTopics)) {
      for (const t of data.RelatedTopics.slice(0, 4)) {
        if (t && t.Text) parts.push(t.Text);
        if (t && t.Topics) {
          for (const sub of t.Topics.slice(0, 2)) {
            if (sub && sub.Text) parts.push(sub.Text);
          }
        }
      }
    }
    return parts;
  } catch {
    return [];
  }
}

function mergeCandidates(candidates, query) {
  const ranked = candidates
    .filter((c) => c && c.text && c.text.length > 40)
    .map((c) => ({
      ...c,
      score: scoreText(c.text, query) + (c.bonus || 0),
    }))
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) return null;

  // Evitar casi-duplicados
  const picked = [];
  for (const r of ranked) {
    if (picked.some((p) => p.text.slice(0, 80) === r.text.slice(0, 80))) continue;
    picked.push(r);
    if (picked.length >= 3) break;
  }

  let response = picked[0].text;
  if (picked[1] && response.length < 380) {
    const second = picked[1].text;
    if (!response.includes(second.slice(0, 50))) {
      response = response + ' ' + second;
    }
  }

  if (response.length > 900) {
    const cut = response.slice(0, 880);
    const last = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('?'));
    response = last > 250 ? cut.slice(0, last + 1) : cut.replace(/\s+\S*$/, '') + '…';
  }

  return {
    ok: true,
    response,
    source: picked[0].source || 'deep-web',
    score: picked[0].score,
  };
}

async function deepWebSearch(query, options = {}) {
  const raw = String(query || '').trim();
  if (!raw) return { ok: false, response: 'Falta la consulta.' };

  if (!options.skipCache) {
    const cached = searchCache.get(raw);
    if (cached) return cached;
  }

  const { primary, variants } = rewriteQuery(raw);
  const candidates = [];

  // 1) Wikipedia / smart knowledge en variantes
  for (const v of variants.slice(0, 3)) {
    try {
      const sk = await smartKnowledge(v);
      if (sk.ok && sk.response) {
        candidates.push({
          text: sk.response,
          source: sk.source || 'wikipedia',
          bonus: 0.8,
        });
        // Si ya hay un buen extracto de wiki, no hace falta spamear más variantes
        if (sk.response.length > 180) break;
      }
    } catch {}
  }

  // 2) Instant answers
  for (const v of [primary, variants[1]].filter(Boolean)) {
    try {
      const instant = await fetchDDGInstant(v);
      for (const p of instant) {
        candidates.push({ text: p, source: 'ddg-instant', bonus: 0.4 });
      }
    } catch {}
  }

  // 3) Snippets web
  try {
    const snippets = await fetchDDGSnippets(primary);
    for (const s of snippets) {
      candidates.push({ text: s, source: 'ddg-web', bonus: 0.15 });
    }
  } catch {}

  const merged = mergeCandidates(candidates, primary);
  if (!merged) {
    return {
      ok: false,
      response:
        'No hallé un resumen sólido sobre "' +
        primary +
        '". Puedo abrirte Google o YouTube con esa búsqueda.',
      query: primary,
    };
  }

  const result = {
    ok: true,
    response: merged.response,
    source: merged.source,
    query: primary,
  };
  searchCache.set(raw, result);
  searchCache.set(primary, result);
  return result;
}

module.exports = {
  deepWebSearch,
  fetchDDGSnippets,
  rewriteQuery,
  searchCache,
};
