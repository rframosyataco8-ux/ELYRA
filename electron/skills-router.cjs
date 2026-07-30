/**
 * Skills multi-paso nativos — rápidos, sin LLM.
 */
const skills = require('./fs-skills.cjs');
const { resolveOpenExcelPath } = require('./open-excel-context.cjs');

async function trySkillIntent(text, helpers) {
  const t = (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // PDF colección
  const collectPdf =
    /\b(pdf|pdfs)\b/.test(t) &&
    /\b(busca|buscar|encuentra|encuentre|lista|listar|copia|copiar|mueve|mover|reune|reunir|colecciona)\b/.test(t);
  if (collectPdf) {
    const root = /descarga/.test(t)
      ? 'descargas'
      : /escritorio/.test(t)
        ? 'escritorio'
        : /documento/.test(t)
          ? 'documentos'
          : 'descargas';
    const r = skills.collectByExtension({ root, ext: 'pdf' });
    return { response: r.result, intelligent: true, via: 'skill-collect-pdf' };
  }

  const collectExcel =
    /\b(excel|xlsx|csv)\b/.test(t) &&
    /\b(busca|buscar|encuentra|copia|copiar|reune)\b/.test(t) &&
    !/\banaliza|analizar|resume\b/.test(t);
  if (collectExcel) {
    const root = /descarga/.test(t) ? 'descargas' : 'documentos';
    const r = skills.collectByExtension({ root, ext: 'xlsx,xls,csv' });
    return { response: r.result, intelligent: true, via: 'skill-collect-excel' };
  }

  // Solo listar por tipo
  const findOnly =
    /\b(busca|buscar|encuentra|lista|listar)\b/.test(t) &&
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

  // Crear carpeta Informes
  if (/\b(crea|crear|haz)\b/.test(t) && /\b(carpeta|folder)\b/.test(t) && /\binformes\b/.test(t)) {
    const r = skills.mkdir('informes');
    return { response: r.result, intelligent: true, via: 'skill-mkdir' };
  }

  return null;
}

module.exports = { trySkillIntent };
