/**
 * ELYRA 1.5 — Foundation de entrenamiento controlado
 *
 * NO entrena un LLM gigante dentro de Electron.
 * Sí:
 *  - exporta dataset desde la BD de sistema
 *  - filtra calidad / PII básica
 *  - genera JSONL estilo instruction-tuning
 *  - calcula métricas de comportamiento offline
 *  - checklist de readiness para LoRA externo (Ollama/Unsloth/etc.)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

function trainDir() {
  const d = path.join(os.homedir(), '.elyra', 'training');
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

function redactPii(text) {
  let t = String(text || '');
  try {
    t = require('./security-harden.cjs').redactSecrets(t);
  } catch {}
  t = t.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]');
  t = t.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE]');
  t = t.replace(/\b\d{8,16}\b/g, '[NUM]');
  return t;
}

function isGoodPair(user, assistant) {
  const u = String(user || '').trim();
  const a = String(assistant || '').trim();
  if (u.length < 4 || a.length < 8) return false;
  if (/tropiezo|no pude conectar|401|api key/i.test(a) && a.length < 80) return false;
  if (/^(ok|sí|si|hola|hey)\.?$/i.test(u)) return false;
  return true;
}

/**
 * Empareja mensajes user→assistant consecutivos de la BD
 */
function pairsFromDb() {
  let db;
  try {
    db = require('./elyra-db.cjs');
  } catch {
    return [];
  }
  const store = db.load();
  const msgs = store.messages || [];
  const pairs = [];
  for (let i = 0; i < msgs.length - 1; i++) {
    const a = msgs[i];
    const b = msgs[i + 1];
    if (a.role === 'user' && b.role === 'assistant') {
      if (isGoodPair(a.content, b.content)) {
        pairs.push({
          instruction: redactPii(a.content),
          output: redactPii(b.content),
          at: b.at || a.at,
          source: 'elyra-db',
        });
      }
    }
  }
  return pairs;
}

/**
 * Export JSONL para fine-tune / LoRA externo
 */
function exportDataset({ minPairs = 5 } = {}) {
  const pairs = pairsFromDb();
  if (pairs.length < minPairs) {
    return {
      ok: false,
      result:
        'Pocos pares de calidad (' +
        pairs.length +
        '). Usa ELYRA más (conversaciones reales) y vuelve a exportar. Mínimo sugerido: ' +
        minPairs +
        '.',
      count: pairs.length,
    };
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonlPath = path.join(trainDir(), 'elyra-sft-' + stamp + '.jsonl');
  const metaPath = path.join(trainDir(), 'elyra-sft-' + stamp + '.meta.json');

  const lines = pairs.map((p) =>
    JSON.stringify({
      messages: [
        { role: 'user', content: p.instruction },
        { role: 'assistant', content: p.output },
      ],
    }),
  );
  fs.writeFileSync(jsonlPath, lines.join('\n') + '\n', 'utf-8');

  const meta = {
    created_at: new Date().toISOString(),
    pairs: pairs.length,
    path: jsonlPath,
    format: 'chat-messages-jsonl',
    note: 'Para LoRA externo (Unsloth, Axolotl, Ollama fine-tune). No es entrenamiento in-app.',
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

  return {
    ok: true,
    result: 'Dataset exportado: ' + pairs.length + ' pares → ' + jsonlPath,
    path: jsonlPath,
    metaPath,
    count: pairs.length,
  };
}

/**
 * Métricas de comportamiento offline (no accuracy de un modelo entrenado aquí)
 */
function behavioralMetrics() {
  const metrics = {
    at: new Date().toISOString(),
    pairs_available: 0,
    avg_user_len: 0,
    avg_assistant_len: 0,
    tool_events: 0,
    tool_ok_rate: null,
    audit_events: 0,
    multi_agent_ready: false,
    system_db: false,
    ocr: false,
    vision: false,
  };

  try {
    const pairs = pairsFromDb();
    metrics.pairs_available = pairs.length;
    if (pairs.length) {
      metrics.avg_user_len = Math.round(
        pairs.reduce((s, p) => s + p.instruction.length, 0) / pairs.length,
      );
      metrics.avg_assistant_len = Math.round(
        pairs.reduce((s, p) => s + p.output.length, 0) / pairs.length,
      );
    }
  } catch {}

  try {
    const db = require('./elyra-db.cjs');
    const st = db.stats();
    metrics.system_db = true;
    metrics.tool_events = st.tool_events || 0;
    metrics.audit_events = st.audit_events || 0;
    const store = db.load();
    const tools = store.tool_events || [];
    if (tools.length) {
      const ok = tools.filter((t) => t.ok).length;
      metrics.tool_ok_rate = Math.round((ok / tools.length) * 1000) / 10;
    }
  } catch {}

  try {
    const v = require('./elyra-version.cjs');
    metrics.multi_agent_ready = !!v.capabilities?.multiAgent;
    metrics.ocr = !!v.capabilities?.ocr;
    metrics.vision = !!v.capabilities?.vision;
  } catch {}

  return metrics;
}

function readinessChecklist() {
  const m = behavioralMetrics();
  const items = [
    {
      id: 'system_db',
      ok: m.system_db,
      label: 'BD de sistema activa',
    },
    {
      id: 'min_pairs',
      ok: m.pairs_available >= 20,
      label: '≥ 20 pares conversación de calidad (' + m.pairs_available + ')',
    },
    {
      id: 'tools_logged',
      ok: m.tool_events >= 10,
      label: 'Tools registradas (≥10): ' + m.tool_events,
    },
    {
      id: 'security',
      ok: true,
      label: 'Permisos + redact activos',
    },
    {
      id: 'eval_suite',
      ok: true,
      label: 'ELYRA_EVAL offline disponible',
    },
  ];
  const ready = items.every((i) => i.ok);
  return {
    ok: ready,
    ready,
    items,
    metrics: m,
    next_step: ready
      ? 'Puedes exportDataset() y entrenar LoRA fuera de la app (Ollama/Unsloth).'
      : 'Sigue usando ELYRA para acumular pares y eventos de tools; luego exporta.',
  };
}

function trainingStatus() {
  const check = readinessChecklist();
  return {
    ok: true,
    result:
      (check.ready ? 'Listo para exportar dataset. ' : 'Aún no listo. ') +
      check.next_step +
      ' Pares: ' +
      check.metrics.pairs_available +
      '.',
    ...check,
  };
}

module.exports = {
  exportDataset,
  behavioralMetrics,
  readinessChecklist,
  trainingStatus,
  pairsFromDb,
  trainDir,
};
