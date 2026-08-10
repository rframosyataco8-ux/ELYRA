/**
 * ELYRA 1.6 — Plantillas de laboratorio (cacao / cadmio / AFQ)
 * Genera borradores de informes y prompts de análisis sin inventar datos.
 */
const path = require('path');
const os = require('os');
const fs = require('fs');

function informesDir() {
  const d = path.join(os.homedir(), 'Documents', 'Informes');
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

const TEMPLATES = {
  cadmio_resumen: {
    title: 'Resumen análisis de cadmio',
    body: [
      '## Objetivo',
      'Resumir resultados de cadmio en producto/lote según datos del laboratorio.',
      '',
      '## Datos de entrada',
      '- Producto / lote: [completar]',
      '- Método: [completar]',
      '- Unidades: mg/kg (o indicar)',
      '',
      '## Resultados',
      '| Muestra | Resultado | Límite | Cumple |',
      '|---------|-----------|--------|--------|',
      '| [id] | [valor] | [límite] | Sí/No |',
      '',
      '## Observaciones',
      '- [observaciones]',
      '',
      '## Conclusión',
      '[cumplimiento / acciones]',
      '',
      '_Generado por ELYRA — completar con datos reales del laboratorio._',
    ].join('\n'),
  },
  afq_basico: {
    title: 'Informe AFQ básico',
    body: [
      '## Análisis físico-químico',
      'Producto: [nombre]',
      'Fecha: [fecha]',
      '',
      '### Parámetros',
      '- Humedad: [valor] %',
      '- Grasa: [valor] %',
      '- pH: [valor]',
      '- Otros: [lista]',
      '',
      '### Comentario técnico',
      '[interpretación breve sin inventar cifras]',
      '',
      '_Plantilla ELYRA — rellenar con datos medidos._',
    ].join('\n'),
  },
  cacao_lote: {
    title: 'Ficha de lote de cacao',
    body: [
      '## Identificación',
      '- Lote: [código]',
      '- Origen: [origen]',
      '- Fecha recepción: [fecha]',
      '',
      '## Controles',
      '- Cadmio: [valor] mg/kg',
      '- Plaguicidas: [estado / informe]',
      '- AFQ: [referencia]',
      '',
      '## Decisión',
      '[liberar / retener / reanalizar]',
      '',
      '_Plantilla ELYRA._',
    ].join('\n'),
  },
};

function listTemplates() {
  return {
    ok: true,
    result:
      'Plantillas disponibles: ' +
      Object.keys(TEMPLATES).join(', ') +
      '. Usa lab_template con name=...',
    names: Object.keys(TEMPLATES),
  };
}

function getTemplate(name) {
  const key = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  const t = TEMPLATES[key];
  if (!t) {
    return {
      ok: false,
      result: 'Plantilla desconocida. Disponibles: ' + Object.keys(TEMPLATES).join(', '),
    };
  }
  return { ok: true, result: t.title + '\n\n' + t.body, title: t.title, body: t.body };
}

async function writeTemplateDoc(name) {
  const t = getTemplate(name);
  if (!t.ok) return t;
  const { runPythonTool } = require('./python-bridge.cjs');
  const stamp = new Date().toISOString().slice(0, 10);
  const outName = path.join(
    'Informes',
    `ELYRA_${String(name).replace(/\W+/g, '_')}_${stamp}.docx`,
  );
  return runPythonTool('write_docx', {
    path: outName,
    title: t.title,
    body: t.body,
  });
}

module.exports = {
  TEMPLATES,
  listTemplates,
  getTemplate,
  writeTemplateDoc,
  informesDir,
};
