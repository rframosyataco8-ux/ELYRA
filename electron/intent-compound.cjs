/**
 * Intenciones compuestas y correcciones — se usa desde main.cjs
 */
function applyTypos(text) {
  return String(text || '')
    .replace(/\bcrhome\b/gi, 'chrome')
    .replace(/\bcrom\b/gi, 'chrome')
    .replace(/\bgrome\b/gi, 'chrome')
    .replace(/\bchroem\b/gi, 'chrome')
    .replace(/\bchorme\b/gi, 'chrome')
    .replace(/\byoutub\b/gi, 'youtube')
    .replace(/\bgogle\b/gi, 'google');
}

/**
 * @returns {{ type: 'compound_search', browser: string, query: string } | { type: 'google_search', query: string } | null}
 */
function parseCompound(text) {
  const t = applyTypos(text).toLowerCase().trim();

  const compound = t.match(
    /\b(?:abre|abrir)\s+(?:el\s+|la\s+)?(chrome|navegador|browser|edge|firefox)?\s*(?:y|,)?\s*(?:me\s+)?(?:busca|buscar|buscame|busca\s+me)\s+(.+)/i,
  );
  if (compound) {
    return {
      type: 'compound_search',
      browser: (compound[1] || 'chrome').trim(),
      query: compound[2].replace(/[?.!]+$/, '').trim(),
    };
  }

  // "abre crhome y buscame python" sin captura de browser explícito tras typo
  const compound2 = t.match(
    /\b(?:abre|abrir)\s+(.+?)\s+y\s+(?:me\s+)?(?:busca|buscar|buscame)\s+(.+)/i,
  );
  if (compound2) {
    const left = compound2[1].trim();
    const query = compound2[2].replace(/[?.!]+$/, '').trim();
    const browser = /chrome|edge|firefox|navegador/.test(left) ? left.split(/\s+/)[0] : 'chrome';
    return { type: 'compound_search', browser, query };
  }

  const searchOnly = t.match(
    /\b(?:busca|buscar|buscame|googlea)\s+(?:en\s+google\s+)?(.+)/i,
  );
  if (searchOnly && !/\b(abre|abrir)\b/.test(t)) {
    const query = searchOnly[1].replace(/[?.!]+$/, '').trim();
    if (query.length > 1 && query.length < 120) {
      return { type: 'google_search', query };
    }
  }

  return null;
}

function cleanOpenName(name) {
  if (!name) return '';
  let n = applyTypos(name);
  n = n.split(/\s+y\s+(?:me\s+)?(?:busca|buscar)/i)[0];
  n = n.replace(/\s+(por favor|please|ahora|ya)$/i, '').trim();
  return n;
}

module.exports = { applyTypos, parseCompound, cleanOpenName };
