/**
 * Smoke de integridad ELYRA
 */
function tryRequire(rel) {
  try {
    require(rel);
    return { ok: true, module: rel };
  } catch (err) {
    return { ok: false, module: rel, error: String(err.message || err).slice(0, 200) };
  }
}

function runSmokeIntegrity() {
  const critical = [
    './elyra-version.cjs',
    './elyra-db.cjs',
    './multi-agent.cjs',
    './agent-prompt.cjs',
    './agent.cjs',
    './agent-hooks.cjs',
    './chat-router.cjs',
    './tool-executor.cjs',
    './tools-schema.cjs',
    './pc-control.cjs',
    './tts.cjs',
    './tts-cache.cjs',
    './stt.cjs',
    './web-search-boost.cjs',
    './smart-knowledge.cjs',
    './search-cache.cjs',
    './local-intelligence.cjs',
    './local-math.cjs',
    './memory-cognitive.cjs',
    './intent-compound.cjs',
    './rag-local.cjs',
    './tool-permissions.cjs',
    './llm-resilience.cjs',
    './files-reliability.cjs',
    './vision-engine.cjs',
    './security-harden.cjs',
    './elyra-eval.cjs',
  ];

  const results = critical.map(tryRequire);
  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);

  let version = null;
  try {
    version = require('./elyra-version.cjs');
  } catch {}

  let dbStats = null;
  try {
    dbStats = require('./elyra-db.cjs').stats();
  } catch {}

  let evalSummary = null;
  try {
    if (process.env.ELYRA_RUN_EVAL === '1') {
      evalSummary = require('./elyra-eval.cjs').runEval();
    }
  } catch (e) {
    evalSummary = { ok: false, error: e.message };
  }

  return {
    ok: failed.length === 0,
    passed: passed.length,
    failed: failed.length,
    failures: failed,
    version: version
      ? { platform: version.platform, product: version.product, label: version.label }
      : null,
    db: dbStats,
    eval: evalSummary,
    at: new Date().toISOString(),
  };
}

module.exports = { runSmokeIntegrity };
