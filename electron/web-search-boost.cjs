/**
 * Búsqueda web enriquecida V2 — DDG + Wikipedia + snippets
 * ELYRA usa esto para conocimiento real de internet sin API de pago.
 */
const { smartKnowledge } = require('./smart-knowledge.cjs');

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
    // result__snippet
    const reSnippet = /class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td|div)>/gi;
    let sm;
    while ((sm = reSnippet.exec(html)) !== null && snippets.length < 6) {
      const t = stripHtml(sm[1]);
      if (t.length > 50) snippets.push(t);
    }
    // fallback: result__a titles + nearby text
    if (snippets.length < 2) {
      const reAlt = /class="result__a"[^>]*>([\s\S]*?)<\/a>/gi;
      while ((sm = reAlt.exec(html)) !== null && snippets.length < 6) {
        const t = stripHtml(sm[1]);
        if (t.length > 20) snippets.push(t);
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
      { headers: { 'User-Agent': 'ELYRA/5.1' } },
    );
    const data = await res.json();
    const parts = [];
    if (data.AbstractText) parts.push(data.AbstractText);
    if (data.Answer) parts.push(data.Answer);
    if (data.Definition) parts.push(data.Definition);
    if (Array.isArray(data.RelatedTopics)) {
      for (const t of data.RelatedTopics.slice(0, 3)) {
        if (t && t.Text) parts.push(t.Text);
      }
    }
    return parts;
  } catch {
    return [];
  }
}

async function deepWebSearch(query) {
  const q = String(query || '').trim();
  if (!q) return { ok: false, response: 'Falta la consulta.' };

  const parts = [];

  // 1) Resumen estructurado (Wikipedia / DDG abstract)
  try {
    const sk = await smartKnowledge(q);
    if (sk.ok && sk.response) {
      parts.push(sk.response);
    }
  } catch {}

  // 2) Instant answers
  try {
    const instant = await fetchDDGInstant(q);
    for (const p of instant) {
      if (p && !parts.some((x) => x.includes(p.slice(0, 40)))) {
        parts.push(p);
      }
    }
  } catch {}

  // 3) Snippets HTML de la web real
  try {
    const snippets = await fetchDDGSnippets(q);
    if (snippets.length) {
      // Tomar los mejores y unir sin ruido
      const unique = [];
      for (const s of snippets) {
        if (!unique.some((u) => u.slice(0, 50) === s.slice(0, 50))) unique.push(s);
      }
      if (unique.length && parts.length === 0) {
        parts.push(unique.slice(0, 3).join(' '));
      } else if (unique.length) {
        parts.push('Más datos: ' + unique.slice(0, 2).join(' · '));
      }
    }
  } catch {}

  if (!parts.length) {
    return {
      ok: false,
      response:
        'No hallé un resumen sólido sobre "' +
        q +
        '". Puedo abrirte Google o YouTube con esa búsqueda.',
      query: q,
    };
  }

  // Respuesta hablable: prioriza el primer bloque sólido
  let response = parts[0];
  if (parts.length > 1) {
    const extra = parts.slice(1).join(' ');
    if (response.length < 400 && extra.length > 40) {
      response = response + ' ' + extra;
    }
  }
  if (response.length > 900) {
    const cut = response.slice(0, 880);
    const last = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('?'));
    response = last > 250 ? cut.slice(0, last + 1) : cut.replace(/\s+\S*$/, '') + '…';
  }

  return { ok: true, response, source: 'deep-web', query: q };
}

module.exports = { deepWebSearch, fetchDDGSnippets };
