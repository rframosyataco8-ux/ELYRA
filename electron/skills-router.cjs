/**
 * Detecta intenciones multi-paso tipo OpenClaw y las ejecuta nativo (rápido, sin LLM).
 */
const skills = require('./fs-skills.cjs');

async function trySkillIntent(text) {
  const t = (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // "busca/encuentra todos los pdf en descargas y copialos..."
  const collectPdf =
    /\b(pdf|pdfs)\b/.test(t) &&
    /\b(busca|buscar|encuentra|encuentre|lista|listar|copia|copiar|mueve|mover|reune|reunir|colecciona)\b/.test(t);
  if (collectPdf) {
    const root = /descarga/.test(t) ? 'descargas' : /escritorio/.test(t) ? 'escritorio' : /documento/.test(t) ? 'documentos' : 'descargas';
    const r = skills.collectByExtension({ root, ext: 'pdf' });
    return { response: r.result, intelligent: true, via: 'skill-collect-pdf' };
  }

  const collectExcel =
    /\b(excel|xlsx|csv)\b/.test(t) &&
    /\b(busca|buscar|encuentra|copia|copiar|reune)\b/.test(t);
  if (collectExcel) {
    const root = /descarga/.test(t) ? 'descargas' : 'documentos';
    const r = skills.collectByExtension({ root, ext: 'xlsx,xls,csv' });
    return { response: r.result, intelligent: true, via: 'skill-collect-excel' };
  }

  // "busca archivos pdf en descargas"
  const findOnly =
    /\b(busca|buscar|encuentra|lista)\b/.test(t) &&
    /\b(pdf|docx|xlsx|pptx|txt|jpg|png)\b/.test(t) &&
    !/\b(copia|copiar|mueve|mover)\b/.test(t);
  if (findOnly) {
    let ext = 'pdf';
    if (/\bdocx?\b/.test(t)) ext = 'docx,doc';
    else if (/\bxlsx?\b|\bexcel\b/.test(t)) ext = 'xlsx,xls';
    else if (/\bpptx?\b/.test(t)) ext = 'pptx,ppt';
    else if (/\btxt\b/.test(t)) ext = 'txt';
    else if (/\b(jpg|png|imagen)/.test(t)) ext = 'jpg,png,jpeg,webp';
    const root = /descarga/.test(t) ? 'descargas' : /escritorio/.test(t) ? 'escritorio' : 'documentos';
    const r = skills.findFiles({ root, ext, limit: 25 });
    return { response: r.result, intelligent: true, via: 'skill-find' };
  }

  return null;
}

module.exports = { trySkillIntent };
