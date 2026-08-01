/**
 * Intenciones de búsqueda / apertura compuesta — ELYRA
 */
function applyTypos(text) {
  return String(text || '')
    .replace(/\bcrhome\b/gi, 'chrome')
    .replace(/\bcrom\b/gi, 'chrome')
    .replace(/\bgrome\b/gi, 'chrome')
    .replace(/\bchroem\b/gi, 'chrome')
    .replace(/\bchorme\b/gi, 'chrome')
    .replace(/\byoutub\b/gi, 'youtube')
    .replace(/\byutube\b/gi, 'youtube')
    .replace(/\byutu\b/gi, 'youtube')
    .replace(/\bgogle\b/gi, 'google')
    .replace(/\bgoogel\b/gi, 'google');
}

function cleanQuery(q) {
  return String(q || '')
    .replace(/[?.!]+$/g, '')
    .replace(/\s+(por favor|please|ahora|ya|porfa)$/i, '')
    .replace(/\s+en\s+(youtube|yt|google|wikipedia|wiki|chrome|navegador).*$/i, '')
    .trim();
}

/**
 * Detecta búsquedas en sitios concretos y compuestos navegador+query.
 */
function parseCompound(text) {
  const t = applyTypos(text).toLowerCase().trim();

  const ytPatterns = [
    /\b(?:busca|buscar|buscame|busca\s+me|busca\s+el\s+video|pon|reproduce|play)\s+(.+?)\s+en\s+(?:youtube|yt)\b/i,
    /\b(?:busca|buscar|buscame)\s+en\s+(?:youtube|yt)\s+(.+)/i,
    /\b(?:abre|abrir|abre\s+me|abreme)\s+(?:el\s+)?(?:youtube|yt)\s+(?:y|,)?\s*(?:me\s+)?(?:busca|buscar|buscame|pon|reproduce)?\s*(.+)/i,
    /\b(?:youtube|yt)\s+(?:busca|buscar|buscame|search)\s+(.+)/i,
    /\b(?:video|vídeo)\s+(?:de\s+)?(.+?)\s+en\s+(?:youtube|yt)\b/i,
    /\b(?:pon|poner|reproduce|play|escucha|quiero\s+escuchar)\s+(?:la\s+)?(?:musica|música|cancion|canción|tema|video|vídeo)\s+(?:de\s+)?(.+)/i,
    /\b(?:pon|reproduce|play)\s+(.+?)\s+(?:en\s+youtube|por\s+favor)?$/i,
  ];
  for (const re of ytPatterns) {
    const m = t.match(re);
    if (m && m[1]) {
      let q = cleanQuery(m[1]);
      q = q.replace(/^(el\s+video|la\s+cancion|la\s+canción|un\s+video)\s+/i, '').trim();
      if (q.length > 0 && q.length < 150 && !/^(youtube|yt)$/i.test(q)) {
        return { type: 'youtube_search', query: q };
      }
    }
  }

  const wiki = t.match(
    /\b(?:busca|buscar|buscame|qué es|que es)\s+(.+?)\s+en\s+(?:wikipedia|wiki)\b/i,
  );
  if (wiki && wiki[1]) {
    return { type: 'wiki_search', query: cleanQuery(wiki[1]) };
  }

  const gExplicit = t.match(
    /\b(?:busca|buscar|buscame)\s+(.+?)\s+en\s+google\b/i,
  );
  if (gExplicit && gExplicit[1]) {
    return { type: 'google_search', query: cleanQuery(gExplicit[1]) };
  }

  const compound = t.match(
    /\b(?:abre|abrir)\s+(?:el\s+|la\s+)?(chrome|navegador|browser|edge|firefox)\s*(?:y|,)?\s*(?:me\s+)?(?:busca|buscar|buscame|busca\s+me)\s+(.+)/i,
  );
  if (compound) {
    return {
      type: 'compound_search',
      browser: (compound[1] || 'chrome').trim(),
      query: cleanQuery(compound[2]),
    };
  }

  const compound2 = t.match(
    /\b(?:abre|abrir)\s+(.+?)\s+y\s+(?:me\s+)?(?:busca|buscar|buscame)\s+(.+)/i,
  );
  if (compound2) {
    const left = compound2[1].trim();
    const query = cleanQuery(compound2[2]);
    if (/youtube|\byt\b/.test(left)) {
      return { type: 'youtube_search', query };
    }
    const browser = /chrome|edge|firefox|navegador/.test(left) ? left.split(/\s+/)[0] : 'chrome';
    return { type: 'compound_search', browser, query };
  }

  const searchOnly = t.match(
    /\b(?:busca|buscar|buscame|googlea|investiga)\s+(?:información\s+)?(?:sobre\s+)?(.+)/i,
  );
  if (searchOnly && !/\b(abre|abrir)\b/.test(t)) {
    let query = cleanQuery(searchOnly[1]);
    if (/\ben\s+youtube\b/i.test(searchOnly[1]) || /\byoutube\b/i.test(t)) {
      query = query.replace(/\s*youtube\s*/gi, '').trim();
      if (query) return { type: 'youtube_search', query };
    }
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

function youtubeSearchUrl(query) {
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query) + '&sp=EgIQAQ%253D%253D';
}

function googleSearchUrl(query) {
  return 'https://www.google.com/search?q=' + encodeURIComponent(query);
}

function wikiSearchUrl(query) {
  return 'https://es.wikipedia.org/wiki/Special:Search?search=' + encodeURIComponent(query);
}

module.exports = {
  applyTypos,
  parseCompound,
  cleanOpenName,
  youtubeSearchUrl,
  googleSearchUrl,
  wikiSearchUrl,
  cleanQuery,
};
