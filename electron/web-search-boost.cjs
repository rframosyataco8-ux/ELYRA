/**
 * Búsqueda web enriquecida — DDG HTML + Instant + Wikipedia
 * Para que ELYRA tenga más "conocimiento de internet" sin API de pago.
 */
const { smartKnowledge } = require('./smart-knowledge.cjs');

async function deepWebSearch(query) {
  const q = String(query || '').trim();
  if (!q) return { ok: false, response: 'Falta la consulta.' };

  const parts = [];

  // 1) Resumen estructurado (wiki/ddg)
  try {
    const sk = await smartKnowledge(q);
    if (sk.ok && sk.response) {
      parts.push(sk.response);
    }
  } catch {}

  // 2) Snippets DuckDuckGo HTML
  try {
    const res = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ELYRA/4.2' },
    });
    const html = await res.text();
    const re = /class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td)>/gi;
    let sm;
    const snippets = [];
    while ((sm = re.exec(html)) !== null && snippets.length < 5) {
      const t = sm[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (t.length > 40) snippets.push(t);
    }
    if (snippets.length) {
      parts.push('Fuentes web: ' + snippets.slice(0, 3).join(' · '));
    }
  } catch {}

  // 3) DDG Instant JSON extra
  try {
    const res = await fetch(
      'https://api.duckduckgo.com/?q=' + encodeURIComponent(q) + '&format=json&no_html=1&skip_disambig=1',
      { headers: { 'User-Agent': 'ELYRA/4.2' } },
    );
    const data = await res.json();
    if (data.AbstractText && !parts.some((p) => p.includes(data.AbstractText.slice(0, 40)))) {
      parts.unshift(data.AbstractText);
    }
  } catch {}

  if (!parts.length) {
    return {
      ok: false,
      response:
        'No hallé un resumen sólido sobre "' +
        q +
        '". Puedo abrirte Google o YouTube con esa búsqueda.',
    };
  }

  let response = parts[0];
  if (parts.length > 1 && parts[1].startsWith('Fuentes')) {
    response = parts[0] + '\n\n' + parts[1];
  }
  if (response.length > 900) response = response.slice(0, 880).replace(/\s+\S*$/, '') + '…';

  return { ok: true, response, source: 'deep-web' };
}

module.exports = { deepWebSearch };
